#!/usr/bin/env node
// clone-capture.mjs — deterministic live-URL section capture for /clone url-mode.
//
// Removes the model from the manual "open Inspect, copy HTML + computed styles"
// loop. Navigates a real Chromium (Playwright), resolves the target section,
// and writes a compact, pixel-exact snapshot to <out>/ that the `clone` agent
// translates into house-stack JSX.
//
// Zero model tokens are spent here — this is pure tooling.
//
// Usage:
//   node clone-capture.mjs --url <url> --out <dir> [--section "<text>"] [--pick]
//                          [--breakpoints 375,768,1440] [--devtools] [--node-cap 400]
//
// Selection modes (most → least automated):
//   --section "<text>"  resolve the smallest element containing the copy/heading text,
//                       then climb to the nearest semantic ancestor.
//   (no section)        capture the whole <main>/<body>; also emit sections.json — an
//                       index of top-level sections so a section can be named cheaply.
//   --pick              open a HEADED browser; hover highlights, click selects (watchable).
//
// Output (see references/snapshot-schema.md for the contract):
//   manifest.json  dom.html  styles.json  tokens.json  [sections.json]
//   shots/{bp}.png  assets/{index.json,fonts.json,<files>}

import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// ── Playwright resolution (portable: no install needed where @playwright/mcp exists)
function loadPlaywright() {
  const req = createRequire(import.meta.url);
  const bases = [process.cwd(), import.meta.dirname];
  // @playwright/mcp bundles playwright; find it via the global npm root.
  for (const cmd of ['npm root -g', 'pnpm root -g']) {
    try {
      const root = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (root) bases.push(join(root, '@playwright', 'mcp'));
    } catch { /* ignore */ }
  }
  bases.push('/opt/homebrew/lib/node_modules/@playwright/mcp'); // common macOS fallback
  for (const base of bases) {
    for (const pkg of ['playwright', 'playwright-core']) {
      try {
        return req(req.resolve(pkg, { paths: [base] }));
      } catch { /* try next */ }
    }
  }
  throw new Error(
    'Could not resolve Playwright. Install it once in this skill:\n' +
    '  cd ~/.claude/skills/clone/scripts && npm install playwright && npx playwright install chromium'
  );
}

// ── Mirror ~/.claude/playwright-mcp.config.json so capture == what reconcile sees.
const PW_CONFIG = {
  launchArgs: [
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    '--disable-ipc-flooding-protection',
    '--disable-dev-shm-usage',
  ],
  context: {
    ignoreHTTPSErrors: true,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'Asia/Dubai',
  },
  navigationTimeout: 60000,
};

// ── CLI args
function parseArgs(argv) {
  const a = { breakpoints: [375, 768, 1440], nodeCap: 400 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i];
    if (k === '--url') a.url = next();
    else if (k === '--out') a.out = next();
    else if (k === '--section') a.section = next();
    else if (k === '--pick') a.pick = true;
    else if (k === '--devtools') a.devtools = true;
    else if (k === '--breakpoints') a.breakpoints = next().split(',').map((n) => parseInt(n.trim(), 10)).filter(Boolean);
    else if (k === '--node-cap') a.nodeCap = parseInt(next(), 10);
  }
  if (!a.url) throw new Error('--url is required');
  if (!a.out) {
    const host = (() => { try { return new URL(a.url).hostname.replace(/^www\./, '').replace(/\W+/g, '-'); } catch { return 'site'; } })();
    const tag = a.section ? slug(a.section) : 'page';
    a.out = resolve(process.cwd(), '.clone', `${host}-${tag}`);
  }
  return a;
}
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'section'; }

// ── The curated, layout-critical property set captured per node (≈70 props).
// Anything outside this list never enters the snapshot — that is what keeps it
// to ~10–25 *meaningful* props/node instead of ~350 props of UA noise.
const CAPTURE_PROPS = [
  'display','position','top','right','bottom','left','float','clear','z-index','box-sizing',
  'overflow-x','overflow-y','visibility',
  'flex-direction','flex-wrap','flex-grow','flex-shrink','flex-basis','order',
  'justify-content','align-items','align-self','align-content',
  'gap','row-gap','column-gap',
  'grid-template-columns','grid-template-rows','grid-auto-flow','grid-column','grid-row',
  'width','height','min-width','max-width','min-height','max-height','aspect-ratio',
  'margin-top','margin-right','margin-bottom','margin-left',
  'padding-top','padding-right','padding-bottom','padding-left',
  'border-top-width','border-right-width','border-bottom-width','border-left-width',
  'border-top-style','border-right-style','border-bottom-style','border-left-style',
  'border-top-color','border-right-color','border-bottom-color','border-left-color',
  'border-top-left-radius','border-top-right-radius','border-bottom-right-radius','border-bottom-left-radius',
  'outline-width','outline-style','outline-color','outline-offset',
  'font-family','font-size','font-weight','font-style','line-height','letter-spacing',
  'text-align','text-transform','text-decoration-line','white-space','word-break','text-overflow',
  'color','background-color','background-image','background-size','background-position','background-repeat',
  'box-shadow','opacity','transform','transition','filter','backdrop-filter','mix-blend-mode',
  'cursor','list-style-type','object-fit','object-position',
];

// Compact per-breakpoint signature used to detect responsive changes.
const RESPONSIVE_PROPS = ['display','flex-direction','grid-template-columns','font-size','width','justify-content','align-items'];

// ── In-page extraction (runs in the browser). Pure DOM/CSSOM, no Node APIs.
function pageExtract({ rootSelector, captureProps, nodeCap }) {
  const root = rootSelector ? document.querySelector(rootSelector) : (document.querySelector('main') || document.body);
  if (!root) return { error: 'root not found', rootSelector };

  // Per-tag UA/inherited baseline: a detached element in THIS document's context.
  const baselineHost = document.createElement('div');
  baselineHost.style.cssText = 'position:absolute;left:-99999px;top:0;width:auto;height:auto;';
  document.body.appendChild(baselineHost);
  const baselineCache = {};
  function baselineFor(tag) {
    if (baselineCache[tag]) return baselineCache[tag];
    let el;
    try { el = document.createElement(tag); } catch { el = document.createElement('div'); }
    baselineHost.appendChild(el);
    const cs = getComputedStyle(el);
    const snap = {};
    for (const p of captureProps) snap[p] = cs.getPropertyValue(p);
    baselineHost.removeChild(el);
    baselineCache[tag] = snap;
    return snap;
  }

  function cssPath(el) {
    // Stable-ish path: tag + nth-of-type chain from root, capped depth.
    const parts = [];
    let node = el;
    while (node && node !== root.parentElement && parts.length < 12) {
      const tag = node.tagName.toLowerCase();
      let idx = 1, sib = node;
      while ((sib = sib.previousElementSibling)) if (sib.tagName === node.tagName) idx++;
      parts.unshift(`${tag}:nth-of-type(${idx})`);
      if (node === root) break;
      node = node.parentElement;
    }
    return parts.join(' > ');
  }

  const SKIP = new Set(['SCRIPT','STYLE','NOSCRIPT','TEMPLATE','META','LINK']);
  const nodes = [];
  const tokens = {
    colors: {}, fontFamilies: {}, fontSizes: {}, lineHeights: {}, letterSpacings: {},
    spacings: {}, radii: {}, shadows: {},
  };
  const assets = []; // {originalUrl, kind, role}
  function bump(map, key) { if (key) map[key] = (map[key] || 0) + 1; }
  function isColorMeaningful(v) { return v && v !== 'rgba(0, 0, 0, 0)' && v !== 'transparent' && v !== 'rgb(0, 0, 0)'; }

  let count = 0;
  (function walk(el) {
    if (count >= nodeCap || SKIP.has(el.tagName)) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    count++;

    const base = baselineFor(el.tagName.toLowerCase());
    const styles = {};
    for (const p of captureProps) {
      const v = cs.getPropertyValue(p);
      if (v && v !== base[p]) styles[p] = v;
    }

    // Token harvest
    bump(tokens.colors, isColorMeaningful(cs.color) ? cs.color : null);
    bump(tokens.colors, isColorMeaningful(cs.backgroundColor) ? cs.backgroundColor : null);
    bump(tokens.fontFamilies, cs.fontFamily);
    bump(tokens.fontSizes, cs.fontSize);
    bump(tokens.lineHeights, cs.lineHeight);
    if (cs.letterSpacing && cs.letterSpacing !== 'normal') bump(tokens.letterSpacings, cs.letterSpacing);
    for (const p of ['marginTop','marginRight','marginBottom','marginLeft','paddingTop','paddingRight','paddingBottom','paddingLeft','gap']) {
      const v = cs[p]; if (v && v !== '0px' && v !== 'normal') bump(tokens.spacings, v);
    }
    for (const p of ['borderTopLeftRadius','borderTopRightRadius','borderBottomRightRadius','borderBottomLeftRadius']) {
      const v = cs[p]; if (v && v !== '0px') bump(tokens.radii, v);
    }
    if (cs.boxShadow && cs.boxShadow !== 'none') bump(tokens.shadows, cs.boxShadow);

    // Asset harvest
    if (el.tagName === 'IMG' && el.currentSrc) assets.push({ originalUrl: el.currentSrc, kind: 'img', role: roleOf(el) });
    if (el.tagName === 'IMG' && el.getAttribute('srcset')) styles['__srcset'] = el.getAttribute('srcset');
    if (el.tagName === 'svg') assets.push({ originalUrl: null, kind: 'svg-inline', role: 'icon', svg: el.outerHTML.slice(0, 4000) });
    const bg = cs.backgroundImage;
    if (bg && bg.startsWith('url(')) {
      const m = bg.match(/url\((['"]?)(.*?)\1\)/); if (m && m[2]) assets.push({ originalUrl: m[2], kind: 'background', role: 'background' });
    }

    const directText = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    nodes.push({
      path: cssPath(el),
      tag: el.tagName.toLowerCase(),
      classes: (el.getAttribute('class') || '').trim() || undefined,
      role: el.getAttribute('role') || undefined,
      ariaLabel: el.getAttribute('aria-label') || undefined,
      href: el.tagName === 'A' ? el.getAttribute('href') || undefined : undefined,
      alt: el.tagName === 'IMG' ? el.getAttribute('alt') || undefined : undefined,
      text: directText ? directText.slice(0, 300) : undefined,
      styles,
    });

    for (const child of el.children) walk(child);
  })(root);

  function roleOf(img) {
    const a = (img.alt || '').toLowerCase();
    if (/logo/.test(a)) return 'logo';
    const r = img.getBoundingClientRect();
    if (r.width > 240 && r.height > 160) return 'illustration';
    if (r.width <= 48 && r.height <= 48) return 'icon';
    return 'image';
  }

  // Fonts (@font-face) catalog
  const fonts = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    for (const r of Array.from(rules || [])) {
      if (r.constructor && r.constructor.name === 'CSSFontFaceRule') {
        fonts.push({ family: r.style.getPropertyValue('font-family'), weight: r.style.getPropertyValue('font-weight'), src: r.style.getPropertyValue('src').slice(0, 300) });
      }
    }
  }

  document.body.removeChild(baselineHost);
  return { nodes, tokens, assets, fonts, nodeCount: count, capped: count >= nodeCap, rootRect: root.getBoundingClientRect() };
}

// ── Compact ordinal-walk responsive signature (same walk at every breakpoint so
// keys align and the cross-breakpoint diff is meaningful).
function pageSignature(rootSelector) {
  const props = ['display','flex-direction','grid-template-columns','font-size','width','justify-content','align-items'];
  const root = rootSelector ? document.querySelector(rootSelector) : (document.querySelector('main') || document.body);
  if (!root) return {};
  const out = {};
  (function walk(el, path) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none') return;
    const s = {}; for (const p of props) s[p] = cs.getPropertyValue(p);
    out[path] = s;
    let n = 0; for (const c of el.children) walk(c, path + '/' + (n++));
  })(root, '0');
  return out;
}

// ── Section index for full-page mode (named-section picking).
function pageSectionIndex() {
  const host = document.querySelector('main') || document.body;
  const out = [];
  let i = 0;
  for (const el of Array.from(host.children)) {
    const r = el.getBoundingClientRect();
    if (r.height < 80) continue;
    const heading = el.querySelector('h1,h2,h3,[role=heading]');
    out.push({
      index: i++,
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      classes: (el.getAttribute('class') || '').trim() || undefined,
      heading: heading ? heading.textContent.trim().slice(0, 120) : undefined,
      sampleText: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 160),
      rect: { y: Math.round(r.y + window.scrollY), height: Math.round(r.height) },
    });
  }
  return out;
}

// ── Resolve a section by visible text → nearest semantic ancestor.
function pageResolveByText(text) {
  const SEMANTIC = new Set(['SECTION','HEADER','FOOTER','MAIN','ARTICLE','ASIDE','NAV']);
  const needle = text.toLowerCase().trim();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let best = null, bestLen = Infinity;
  while (walker.nextNode()) {
    const el = walker.currentNode;
    const t = (el.textContent || '').toLowerCase();
    if (t.includes(needle) && t.length < bestLen) { best = el; bestLen = t.length; }
  }
  if (!best) return { error: 'text not found' };
  let node = best;
  for (let depth = 0; node && depth < 12; depth++) {
    if (SEMANTIC.has(node.tagName)) break;
    const r = node.getBoundingClientRect();
    if (r.height >= 120 && node.children.length >= 1 && getComputedStyle(node).display !== 'inline') {
      // a real block container is acceptable if no semantic ancestor is closer
      const semanticAncestor = node.closest('section,header,footer,main,article,aside,nav');
      if (!semanticAncestor || semanticAncestor === document.body) break;
      node = semanticAncestor; break;
    }
    node = node.parentElement;
  }
  // Produce a unique selector for the chosen node.
  function unique(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    let n = el;
    while (n && n !== document.body && parts.length < 8) {
      let idx = 1, sib = n; while ((sib = sib.previousElementSibling)) if (sib.tagName === n.tagName) idx++;
      parts.unshift(`${n.tagName.toLowerCase()}:nth-of-type(${idx})`);
      n = n.parentElement;
    }
    return parts.join(' > ');
  }
  return { selector: unique(node), tag: node.tagName.toLowerCase() };
}

// ── Main
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pw = loadPlaywright();
  mkdirSync(args.out, { recursive: true });
  mkdirSync(join(args.out, 'shots'), { recursive: true });
  mkdirSync(join(args.out, 'assets'), { recursive: true });

  const headed = !!(args.pick || args.devtools);
  const browser = await pw.chromium.launch({ headless: !headed, args: PW_CONFIG.launchArgs });
  const context = await browser.newContext({
    ...PW_CONFIG.context,
    viewport: { width: args.breakpoints[args.breakpoints.length - 1], height: 1080 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  const log = (m) => process.stderr.write(m + '\n');
  log(`▸ navigating ${args.url}`);
  await page.goto(args.url, { waitUntil: 'networkidle', timeout: PW_CONFIG.navigationTimeout }).catch(async () => {
    await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: PW_CONFIG.navigationTimeout });
  });
  await page.waitForTimeout(800); // settle lazy content

  // ── Determine the target selector
  let rootSelector = null;
  let sectionsIndex = null;
  if (args.pick) {
    log('▸ PICK mode — hover to highlight, click the section you want');
    rootSelector = await interactivePick(page);
    log(`▸ picked: ${rootSelector}`);
  } else if (args.section) {
    const r = await page.evaluate(pageResolveByText, args.section);
    if (r.error) { log(`✗ section text not found: "${args.section}" — capturing full page instead`); }
    else { rootSelector = r.selector; log(`▸ resolved "${args.section}" → ${r.tag} (${rootSelector})`); }
  }
  if (!rootSelector) {
    sectionsIndex = await page.evaluate(pageSectionIndex);
    writeFileSync(join(args.out, 'sections.json'), JSON.stringify(sectionsIndex, null, 2));
    log(`▸ full-page mode — wrote sections.json (${sectionsIndex.length} sections). Name one to refine.`);
  }

  // ── Extract at the largest breakpoint (the reference layout)
  const extract = await page.evaluate(pageExtract, {
    rootSelector, captureProps: CAPTURE_PROPS, nodeCap: args.nodeCap,
  });
  if (extract.error) { log(`✗ extraction failed: ${extract.error}`); await browser.close(); process.exit(2); }

  // ── Screenshots + responsive signatures at each breakpoint (same ordinal walk,
  // so keys align and the cross-breakpoint diff is meaningful).
  const largest = args.breakpoints[args.breakpoints.length - 1];
  const sigs = {};
  for (const bp of args.breakpoints) {
    await page.setViewportSize({ width: bp, height: 1080 });
    await page.waitForTimeout(250);
    const shotPath = join(args.out, 'shots', `${bp}.png`);
    try {
      const loc = rootSelector ? page.locator(rootSelector).first() : page.locator('body');
      await loc.screenshot({ path: shotPath, timeout: 8000 });
    } catch {
      await page.screenshot({ path: shotPath, fullPage: false });
    }
    sigs[bp] = await page.evaluate(pageSignature, rootSelector);
    log(`▸ shot @ ${bp}px`);
  }
  // breakpointBehavior: per non-largest bp, only nodes whose signature changed vs largest.
  const breakpointBehavior = {};
  const base = sigs[largest] || {};
  for (const bp of args.breakpoints) {
    if (bp === largest) continue;
    const changed = {};
    for (const k of Object.keys(sigs[bp] || {})) {
      const a = sigs[bp][k], b = base[k];
      if (!b) continue;
      const d = {};
      for (const p of RESPONSIVE_PROPS) if (a[p] !== b[p]) d[p] = a[p];
      if (Object.keys(d).length) changed[k] = d;
    }
    if (Object.keys(changed).length) breakpointBehavior[bp] = changed;
  }

  // ── Pretty DOM
  const domHtml = await page.evaluate((sel) => {
    const root = sel ? document.querySelector(sel) : (document.querySelector('main') || document.body);
    return root ? root.outerHTML : '';
  }, rootSelector);
  writeFileSync(join(args.out, 'dom.html'), prettyHtml(domHtml));

  // ── Download assets
  const assetIndex = [];
  let ai = 0;
  for (const a of extract.assets) {
    if (a.kind === 'svg-inline') { const p = `assets/icon-${ai++}.svg`; writeFileSync(join(args.out, p), a.svg); assetIndex.push({ ...a, localPath: p }); continue; }
    if (!a.originalUrl || a.originalUrl.startsWith('data:')) { assetIndex.push(a); continue; }
    try {
      const url = new URL(a.originalUrl, args.url).href;
      const resp = await context.request.get(url, { timeout: 15000 });
      if (resp.ok()) {
        const buf = await resp.body();
        const ext = (url.split('?')[0].match(/\.(png|jpe?g|webp|svg|gif|avif)$/i) || [,'png'])[1].toLowerCase();
        const p = `assets/asset-${ai++}.${ext}`;
        writeFileSync(join(args.out, p), buf);
        assetIndex.push({ ...a, resolvedUrl: url, localPath: p, bytes: buf.length });
      } else assetIndex.push({ ...a, error: `http ${resp.status()}` });
    } catch (e) { assetIndex.push({ ...a, error: String(e.message || e) }); }
  }
  writeFileSync(join(args.out, 'assets', 'index.json'), JSON.stringify(assetIndex, null, 2));
  writeFileSync(join(args.out, 'assets', 'fonts.json'), JSON.stringify(extract.fonts, null, 2));

  // ── Rank tokens (frequency desc)
  const rank = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
  const tokens = {
    colors: rank(extract.tokens.colors),
    fontFamilies: rank(extract.tokens.fontFamilies),
    fontSizes: rank(extract.tokens.fontSizes),
    lineHeights: rank(extract.tokens.lineHeights),
    letterSpacings: rank(extract.tokens.letterSpacings),
    spacings: rank(extract.tokens.spacings),
    radii: rank(extract.tokens.radii),
    shadows: rank(extract.tokens.shadows),
    breakpointBehavior,
  };
  writeFileSync(join(args.out, 'tokens.json'), JSON.stringify(tokens, null, 2));

  // ── styles.json (the per-node working set)
  writeFileSync(join(args.out, 'styles.json'), JSON.stringify({ rootSelector, nodes: extract.nodes }, null, 2));

  // ── manifest
  const manifest = {
    url: args.url,
    section: args.section || (rootSelector ? 'picked' : 'full-page'),
    rootSelector,
    capturedAt: new Date().toISOString(),
    breakpoints: args.breakpoints,
    deviceScaleFactor: 2,
    playwrightConfig: 'mirrors ~/.claude/playwright-mcp.config.json',
    fidelity: 'pixel-exact',
    nodeCount: extract.nodeCount,
    capped: extract.capped,
    assetCount: assetIndex.length,
    fontCount: extract.fonts.length,
    tokenSummary: {
      colors: tokens.colors.slice(0, 6).map((c) => c.value),
      dominantFont: tokens.fontFamilies[0]?.value,
      fontSizeScale: tokens.fontSizes.map((f) => f.value),
      spacingScale: tokens.spacings.map((s) => s.value),
    },
    files: ['dom.html', 'styles.json', 'tokens.json', ...(sectionsIndex ? ['sections.json'] : []), 'shots/', 'assets/'],
    note: 'breakpointBehavior is best-effort (path heuristics differ across viewports); trust shots/ as ground truth.',
  };
  writeFileSync(join(args.out, 'manifest.json'), JSON.stringify(manifest, null, 2));

  await browser.close();

  // ── stdout summary (this is what the model reads — keep it tight)
  console.log(JSON.stringify({
    ok: true,
    out: args.out,
    nodeCount: extract.nodeCount,
    capped: extract.capped,
    colors: manifest.tokenSummary.colors,
    dominantFont: manifest.tokenSummary.dominantFont,
    fontSizes: tokens.fontSizes.map((f) => f.value),
    spacings: tokens.spacings.slice(0, 10).map((s) => s.value),
    radii: tokens.radii.map((r) => r.value),
    shadows: tokens.shadows.length,
    assets: assetIndex.length,
    fonts: extract.fonts.map((f) => f.family),
    shots: args.breakpoints.map((b) => `shots/${b}.png`),
    sections: sectionsIndex ? sectionsIndex.map((s) => ({ index: s.index, heading: s.heading, sample: s.sampleText })) : undefined,
  }, null, 2));
}

// ── Interactive pick: inject overlay, resolve a unique selector on click.
async function interactivePick(page) {
  await page.evaluate(() => {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #d4a27f;background:rgba(212,162,127,.15);transition:all .03s;';
    document.body.appendChild(box);
    const tip = document.createElement('div');
    tip.style.cssText = 'position:fixed;z-index:2147483647;top:8px;left:8px;background:#141413;color:#fff;font:12px monospace;padding:6px 10px;border-radius:6px;pointer-events:none;';
    tip.textContent = 'clone: hover to highlight · click to select · Esc to cancel';
    document.body.appendChild(tip);
    window.__cloneHover = (e) => {
      const el = e.target; if (!el || el === box || el === tip) return;
      const r = el.getBoundingClientRect();
      Object.assign(box.style, { top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', height: r.height + 'px' });
      tip.textContent = `<${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}> ${Math.round(r.width)}×${Math.round(r.height)}`;
    };
    document.addEventListener('mousemove', window.__cloneHover, true);
  });
  const selector = await new Promise(async (res) => {
    await page.exposeFunction('__clonePicked', (sel) => res(sel));
    await page.evaluate(() => {
      const unique = (el) => {
        if (el.id) return '#' + CSS.escape(el.id);
        const parts = []; let n = el;
        while (n && n !== document.body && parts.length < 8) {
          let i = 1, s = n; while ((s = s.previousElementSibling)) if (s.tagName === n.tagName) i++;
          parts.unshift(`${n.tagName.toLowerCase()}:nth-of-type(${i})`); n = n.parentElement;
        }
        return parts.join(' > ');
      };
      document.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        window.__clonePicked(unique(e.target));
      }, { capture: true, once: true });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.__clonePicked('body'); }, { once: true });
    });
  });
  return selector;
}

// ── Minimal HTML pretty-printer (indentation only; no reformatting of text).
function prettyHtml(html) {
  if (!html) return '';
  const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  let out = '', depth = 0;
  const tokens = html.replace(/>\s+</g, '><').split(/(<[^>]+>)/).filter(Boolean);
  for (const t of tokens) {
    if (t.startsWith('</')) { depth = Math.max(0, depth - 1); out += '  '.repeat(depth) + t + '\n'; }
    else if (t.startsWith('<')) {
      const tag = (t.match(/^<\s*([a-zA-Z0-9-]+)/) || [,''])[1].toLowerCase();
      const selfClose = t.endsWith('/>') || VOID.has(tag);
      out += '  '.repeat(depth) + t + '\n';
      if (!selfClose) depth++;
    } else { out += '  '.repeat(depth) + t.trim() + '\n'; }
  }
  return out;
}

main().catch((e) => { process.stderr.write('clone-capture failed: ' + (e.stack || e) + '\n'); process.exit(1); });
