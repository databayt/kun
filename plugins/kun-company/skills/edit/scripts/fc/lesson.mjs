#!/usr/bin/env node
// lesson.mjs — a narrated lesson video from a lesson script: slides rendered from the brand kit,
// one narration line per slide (the stock Gemini voice), assembled in FilmCraft by assemble.mjs.
//
//   node lesson.mjs <lesson.json> [--slides-only]
//
// The lesson script is written from a catalog textbook twin (catalog/<curriculum>/<grade>/<subject>/
// textbook.md): Claude reads the section, keeps to what the book says, and writes this file beside
// the output (~/media/<repo>/lesson-<id>/lesson.json):
// {
//   "id": "sd-g11-biology-u1-nutrition", "brand": "balqalam", "lang": "ar",
//   "course": "الأحياء — الصف الحادي عشر", "source": "sd/g11/biology/textbook.md — الوحدة الأولى",
//   "slides": [
//     { "kind": "title", "title": "…", "subtitle": "…", "say": "…" },
//     { "kind": "points", "heading": "…", "points": ["…", "…"], "say": "…" },
//     { "kind": "definition", "term": "…", "definition": "…", "say": "…" },
//     { "kind": "fact", "value": "16", "unit": "كيلوجول", "caption": "…", "say": "…" }
//   ]
// }
// `say` carries diacritics where the voice misreads (they are stripped from the captions).
// Output: slides/NN.png, lesson-<id>.video.json, then assemble.mjs's <piece>-<lang>.mp4 (+ .vtt).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { requireRt } from '../media/rt.mjs';

const here = dirname(new URL(import.meta.url).pathname);
const KUN = resolve(here, '../../../../..');
const file = process.argv[2];
if (!file) {
  console.error('usage: lesson.mjs <lesson.json> [--slides-only]');
  process.exit(2);
}
const L = JSON.parse(readFileSync(file, 'utf8'));
const dir = dirname(resolve(file));
const kit = JSON.parse(readFileSync(join(KUN, 'content/media/brand-kit.json'), 'utf8'));
const brand = (kit.production || kit)[L.brand];
if (!brand) throw new Error(`brand ${L.brand} not in brand-kit.json`);
const v = brand.video;
const fonts = join(homedir(), 'Library/Fonts');
const esc = (s = '') => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

const css = `
@font-face { font-family: Head; src: url("file://${fonts}/thmanyah-serif-display-700.ttf"); }
@font-face { font-family: Body; src: url("file://${fonts}/thmanyah-sans-500.ttf"); }
@font-face { font-family: BodyBold; src: url("file://${fonts}/thmanyah-sans-700.ttf"); }
* { margin: 0; box-sizing: border-box; }
html, body { width: 1920px; height: 1080px; background: ${v.canvas}; color: ${v.ink}; }
.frame { position: absolute; inset: 0; padding: 120px 150px 150px; display: flex; flex-direction: column; }
.rtl { direction: rtl; text-align: right; }
.course { position: absolute; top: 56px; right: 150px; left: 150px; display: flex; justify-content: space-between;
  font: 30px Body; opacity: .55; direction: rtl; }
.bar { width: 120px; height: 8px; border-radius: 4px; background: ${v.accent}; margin: 28px 0 44px auto; }
h1 { font: 112px/1.25 Head; }
h2 { font: 76px/1.3 Head; }
.sub { font: 44px/1.5 Body; opacity: .7; margin-top: 24px; }
ul { list-style: none; padding: 0; margin-top: 12px; }
li { font: 50px/1.5 Body; margin: 0 0 30px; padding-right: 62px; position: relative; }
li::before { content: ""; position: absolute; right: 0; top: 26px; width: 22px; height: 22px; border-radius: 50%; background: ${v.accent}; }
.term { font: 96px/1.3 Head; color: ${v.accent}; }
.def { font: 56px/1.6 Body; margin-top: 30px; max-width: 1450px; }
.value { font: 260px/1 Head; color: ${v.accent}; }
.unit { font: 64px Body; margin-top: 10px; }
.cap { font: 50px/1.5 Body; margin-top: 40px; max-width: 1400px; }
.center { align-items: center; justify-content: center; text-align: center; }
`;

function slideHtml(s, i) {
  // The counter in Arabic-Indic digits, kept left-to-right: in an RTL line «2 / 8» reads «8 / 2».
  const ar = (n) => (L.lang === 'en' ? String(n) : String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]));
  const course = `<div class="course"><span>${esc(L.course)}</span><span dir="ltr">${ar(i + 1)} / ${ar(L.slides.length)}</span></div>`;
  let body;
  if (s.kind === 'title') body = `<div class="frame center rtl"><h1>${esc(s.title)}</h1><div class="bar" style="margin:36px auto"></div><div class="sub">${esc(s.subtitle)}</div></div>`;
  else if (s.kind === 'points') body = `<div class="frame rtl"><h2>${esc(s.heading)}</h2><div class="bar"></div><ul>${s.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>`;
  else if (s.kind === 'definition') body = `<div class="frame rtl" style="justify-content:center"><div class="term">${esc(s.term)}</div><div class="bar"></div><div class="def">${esc(s.definition)}</div></div>`;
  else if (s.kind === 'fact') body = `<div class="frame center rtl"><div class="value">${esc(s.value)}</div><div class="unit">${esc(s.unit)}</div><div class="cap">${esc(s.caption)}</div></div>`;
  else throw new Error(`slide ${i + 1}: unknown kind ${s.kind}`);
  return `<!doctype html><html lang="${L.lang || 'ar'}"><meta charset="utf-8"><style>${css}</style><body>${s.kind === 'title' ? '' : course}${body}</body></html>`;
}

const { chromium } = requireRt('playwright-core');
const browser = await chromium.launch(); // headless: no window
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
mkdirSync(join(dir, 'slides'), { recursive: true });
const pngs = [];
for (const [i, s] of L.slides.entries()) {
  const html = join(dir, 'slides', `${String(i + 1).padStart(2, '0')}.html`);
  const png = html.replace(/\.html$/, '.png');
  writeFileSync(html, slideHtml(s, i));
  await page.goto(`file://${html}`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: png });
  pngs.push(png);
}
await browser.close();
console.log(`${pngs.length} slides → ${join(dir, 'slides')}`);
if (process.argv.includes('--slides-only')) process.exit(0);

const piece = `lesson-${L.id}`;
const spec = {
  piece, brand: L.brand, lang: L.lang || 'ar', aspects: ['16:9'], fps: 30,
  voiceStyle: L.voiceStyle || 'a calm, clear teacher explaining to secondary-school students; unhurried',
  items: L.slides.map((s, i) => ({ type: 'still', src: pngs[i], say: s.say })),
  burnCaptions: false,
};
const specPath = join(dir, `${piece}.video.json`);
writeFileSync(specPath, JSON.stringify(spec, null, 2));
execFileSync('node', [join(here, 'assemble.mjs'), specPath], { stdio: 'inherit' });
