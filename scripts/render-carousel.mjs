#!/usr/bin/env node

/**
 * Carousel Renderer — deck JSON → platform-ready PNGs + PDF + captions.
 *
 * Drives the kun render route (src/app/[lang]/carousel/...) with system
 * Chrome via playwright-core and captures each slide's [data-frame] at
 * exact platform sizes. The dev server must already be running on port
 * 3000 (house rule) — this script never spawns it.
 *
 * Usage:
 *   node scripts/render-carousel.mjs hogwarts/hogwarts-intro
 *   node scripts/render-carousel.mjs --brand hogwarts --slug hogwarts-intro \
 *     [--langs ar,en] [--sizes 1080x1350] [--base http://localhost:3000] \
 *     [--out ~/Downloads/carousels] [--scale 2] [--no-pdf] [--validate]
 *
 * Output: <out>/<brand>/<slug>/
 *   <slug>-<lang>-<w>x<h>-NN.png   slides (w*scale px wide)
 *   <slug>-<lang>-<w>x<h>.pdf      LinkedIn / WhatsApp document variant
 *   caption-<lang>-<channel>.txt   per-channel copy with UTM link
 *   manifest.json
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright-core';
import { PDFDocument } from 'pdf-lib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// ── args ────────────────────────────────────────────────────────────────
const args = { _: [] };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const val = argv[i];
  if (val.startsWith('--')) {
    const key = val.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  } else {
    args._.push(val);
  }
}

if (args.help) {
  console.log(
    'Usage: node scripts/render-carousel.mjs <brand>/<slug> [--langs ar,en] [--sizes 1080x1350] [--base http://localhost:3000] [--out ~/Downloads/carousels] [--scale 2] [--no-pdf] [--validate]',
  );
  process.exit(0);
}

const positional = args._[0] || '';
const [posBrand, posSlug] = positional.includes('/') ? positional.split('/') : [];
const brand = args.brand || posBrand;
const slug = args.slug || posSlug;
if (!brand || !slug) {
  console.error('❌ Deck required: render-carousel.mjs <brand>/<slug> (or --brand/--slug)');
  process.exit(1);
}

const langs = String(args.langs || 'ar,en').split(',').map((s) => s.trim()).filter(Boolean);
const sizes = String(args.sizes || '1080x1350').split(',').map((s) => s.trim()).filter(Boolean);
const base = String(args.base || 'http://localhost:3000').replace(/\/$/, '');
const scale = Number(args.scale || 2);
const outRoot = String(args.out || path.join(os.homedir(), 'Downloads', 'carousels')).replace(
  /^~(?=$|\/)/,
  os.homedir(),
);
const wantPdf = !args['no-pdf'];

// ── deck ────────────────────────────────────────────────────────────────
// Decks live with their product (mirrors BRANDS[brand].deckDir in
// src/components/root/carousel/brands.ts); kun's content/carousels/<brand>/
// is the fallback for brands without a repo.
const DECK_DIRS = {
  hogwarts: '/Users/abdout/hogwarts/carousels',
};
const deckPath = DECK_DIRS[brand]
  ? path.join(DECK_DIRS[brand], `${slug}.json`)
  : path.join(rootDir, 'content', 'carousels', brand, `${slug}.json`);
if (!fs.existsSync(deckPath)) {
  console.error(`❌ Deck not found: ${deckPath}`);
  process.exit(1);
}
const deck = JSON.parse(fs.readFileSync(deckPath, 'utf8'));
const total = deck.slides.length;

// ── captions ────────────────────────────────────────────────────────────
const CHANNELS = ['instagram', 'facebook', 'linkedin', 'telegram', 'whatsapp'];

function utmLink(channel) {
  const link = deck.captions.link;
  const sep = link.includes('?') ? '&' : '?';
  return `${link}${sep}utm_source=${channel}&utm_medium=social&utm_campaign=${deck.slug}`;
}

function captionFor(channel, lang) {
  const bodyText = deck.captions.base[lang];
  const tags = deck.captions.hashtags.join(' ');
  const link = utmLink(channel);
  let text;
  switch (channel) {
    case 'linkedin':
      text = `${bodyText}\n\n${link}\n\n${deck.captions.hashtags.slice(0, 3).join(' ')}`;
      break;
    case 'telegram':
      // No hashtags; Telegram album captions cap at 1024 chars.
      text = `${bodyText}\n\n${link}`;
      if (text.length > 1024) text = `${text.slice(0, 1021)}…`;
      break;
    case 'whatsapp':
      text = `${bodyText}\n\n${link}`;
      break;
    default:
      // instagram / facebook
      text = `${bodyText}\n\n${link}\n\n${tags}`;
  }
  return text;
}

// ── render ──────────────────────────────────────────────────────────────
async function main() {
  // Preflight: the server must already be up — never auto-spawn.
  try {
    await fetch(base, { signal: AbortSignal.timeout(4000) });
  } catch {
    console.error(`❌ No server at ${base} — start it first: pnpm dev (port 3000)`);
    process.exit(1);
  }

  const outDir = path.join(outRoot, brand, slug);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`🎠 ${brand}/${slug} — ${total} slides × [${langs}] × [${sizes}] @${scale}x`);

  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  } catch {
    console.error(
      '❌ Could not launch system Chrome. Install Google Chrome, or: pnpm dlx playwright install chromium',
    );
    process.exit(1);
  }

  const files = [];
  try {
    for (const size of sizes) {
      const [w, h] = size.split('x').map(Number);
      if (!w || !h) {
        console.error(`⚠️  Skipping bad size "${size}" (expected WxH)`);
        continue;
      }
      for (const lang of langs) {
        const context = await browser.newContext({
          viewport: { width: w + 120, height: h + 120 },
          deviceScaleFactor: scale,
        });
        const page = await context.newPage();
        const pngs = [];

        for (let i = 1; i <= total; i++) {
          const url = `${base}/${lang}/carousel/${brand}/${slug}?slide=${i}&size=${size}`;
          await page.goto(url, { waitUntil: 'networkidle' });
          const frame = page.locator('[data-frame]');
          await frame.waitFor({ state: 'visible', timeout: 15000 });
          // Fonts + images must be settled or Rubik/Geist fallbacks flash into captures.
          await page.evaluate(async () => {
            await document.fonts.ready;
            await Promise.all(
              Array.from(document.images)
                .filter((img) => !img.complete)
                .map((img) => new Promise((res) => img.addEventListener('load', res, { once: true }))),
            );
          });
          await page.waitForTimeout(150);

          if (args.validate) {
            console.log(`  ✓ ${lang} ${size} slide ${i} renders`);
            continue;
          }

          const nn = String(i).padStart(2, '0');
          const file = path.join(outDir, `${slug}-${lang}-${size}-${nn}.png`);
          await frame.screenshot({ path: file, scale: 'device' });
          pngs.push(file);
          files.push(path.basename(file));
          console.log(`  📸 ${path.basename(file)}`);
        }

        if (wantPdf && !args.validate && pngs.length) {
          const pdf = await PDFDocument.create();
          for (const file of pngs) {
            const img = await pdf.embedPng(fs.readFileSync(file));
            const pdfPage = pdf.addPage([w, h]);
            pdfPage.drawImage(img, { x: 0, y: 0, width: w, height: h });
          }
          const pdfFile = path.join(outDir, `${slug}-${lang}-${size}.pdf`);
          fs.writeFileSync(pdfFile, await pdf.save());
          files.push(path.basename(pdfFile));
          console.log(`  📄 ${path.basename(pdfFile)}`);
        }

        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  if (args.validate) {
    console.log('✅ Deck renders in every language and size.');
    return;
  }

  for (const lang of langs) {
    for (const channel of CHANNELS) {
      const file = path.join(outDir, `caption-${lang}-${channel}.txt`);
      fs.writeFileSync(file, captionFor(channel, lang));
      files.push(path.basename(file));
    }
  }

  const manifest = {
    brand,
    slug,
    langs,
    sizes,
    scale,
    slides: total,
    files,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n✅ ${files.length} files → ${outDir}`);
}

main();
