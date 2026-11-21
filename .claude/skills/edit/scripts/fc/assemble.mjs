#!/usr/bin/env node
// assemble.mjs — build a branded video from a piece spec with FilmCraft (headless), for any brand.
//
//   node assemble.mjs <piece.video.json> [--aspect 16:9|9:16] [--no-export] [--frames] [--deliver]
//
// Spec (paths relative to the spec's folder):
// {
//   "piece": "attendance-explainer", "brand": "hogwarts", "lang": "ar",
//   "aspects": ["16:9", "9:16"], "fps": 30,
//   "items": [
//     { "type": "card",  "title": "…", "subtitle": "…", "seconds": 3 },
//     { "type": "clip",  "src": "take.mp4", "in": 2.5, "out": 14, "mute": true, "label": "…" },
//     { "type": "still", "src": "slide-01.png", "seconds": 6, "label": "…" }
//   ],
//   "voice": "vo.wav", "music": "bed.m4a", "musicDb": -18,
//   "captions": "vo.srt", "burnCaptions": true,          // default: burned on 9:16 only
//   "endCard": { "title": "…", "subtitle": "ed.databayt.org" },
//   "end": 6                                              // trim the whole piece to 6 s (optional)
// }
// Item extras:
//   card.image   absolute path to an svg/png (e.g. a currency mark) placed beside the card title (RTL: left),
//                at ~14% of the short side. SVG is rasterised (sips, else ffmpeg) with currentColor → brand ink,
//                into a cache dir (<spec>/.cache/img). Put it after the figure in reading order: below the title.
//   still.move   { "from": [cx, cy, zoom], "to": [cx, cy, zoom], "ease": "inOutSine|linear|outCubic|inCubic" }
//                Ken Burns by Motion keyframes: (cx, cy) = the picture point (0..1) held at the frame
//                centre, zoom = x the size the frame mode gave it (1 = as placed). No Blender needed.
//   transition   { "type": "cross_dissolve", "frames": 12 }  dissolve into this item from the previous one
//                (centred on the cut; the previous clip needs a handle past its out, else it starts at the cut)
//   src          a path, or { "16:9": path, "9:16": path } (also "landscape"/"portrait") for a per-aspect take
// Spec extras:
//   music        "bed.m4a" or { "src", "db", "fadeIn", "fadeOut", "start" } (seconds; start = source offset)
//   canvas       { "16:9": [1920,1072], "9:16": [1080,2332] }  override an aspect's frame size
//   master       FilmCraft file.exportMedia settings for the master (default h264, crf 12, high)
//   a piece needs no voice, no card, no brand text: clips/stills + music (or silence) is fine.
// Loudness has ONE owner: media.sh encode (two-pass EBU R128, true-peak safe). FilmCraft exports the
// master un-normalised (a -4 dB limiter on the mix bus stays). `loudness` in a spec is ignored.
// --deliver  after each export: media.sh encode (web for 16:9, reel for 9:16; --max = real duration,
//            --box = the canvas) then media.sh qa-pack; prints the delivered paths and the verdict.
// A clip/still `label` becomes a lower third over that item. Any item (and endCard) may carry
// `say`, a narration line: then voice/captions are generated (see narrate) and stills/cards last
// as long as their line.
//
// Output, beside the spec: <piece>.fcproj (one project, one sequence per aspect),
// <piece>-<lang>.mp4 (16:9), <piece>-<lang>.reel.mp4 (9:16), and with --frames a mid-frame PNG per
// aspect for review. Encode/QA/publish stay with media.sh — this only edits.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join, basename } from 'node:path';
import { homedir } from 'node:os';

const CLI = process.env.FILMCRAFT_CLI || join(homedir(), '.local/bin/filmcraft-cli');
const TPS = 254016000000; // FilmCraft ticks per second
const KUN = resolve(dirname(new URL(import.meta.url).pathname), '../../../../..');

const args = process.argv.slice(2);
const specPath = args.find((a) => !a.startsWith('--') && !/^\d+:\d+$/.test(a));
if (!specPath) {
  console.error('usage: assemble.mjs <piece.video.json> [--aspect 16:9|9:16] [--no-export] [--frames]');
  process.exit(2);
}
const flag = (f) => args.includes(f);
const KUN_EDIT = join(KUN, '.claude/skills/edit/scripts');
const onlyAspect = args.includes('--aspect') ? args[args.indexOf('--aspect') + 1] : null;

const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const dir = dirname(resolve(specPath));
const at = (p) => (p ? resolve(dir, p) : null);
const piece = spec.piece || 'piece';
const lang = spec.lang || 'ar';
const rtl = lang === 'ar';
const project = join(dir, `${piece}.fcproj`);
const FPS = spec.fps || 30;
// Every length on the frame grid, so a label or a title never shows one frame early.
const snap = (sec) => Math.round(sec * FPS) / FPS;

// ---- brand ---------------------------------------------------------------------------------
const kit = JSON.parse(readFileSync(join(KUN, 'content/media/brand-kit.json'), 'utf8'));
const brand = (kit.production || kit)[spec.brand];
if (!brand || brand.status !== 'ready') throw new Error(`brand "${spec.brand}" is not ready in brand-kit.json`);
const v = brand.video;
const headFont = rtl ? 'Thmanyah Serif Display' : 'Geist';
const bodyFont = rtl ? 'Thmanyah Sans' : 'Geist';
const repoDir = join(homedir(), brand.repo);
const kitLogo = brand.logo && existsSync(join(repoDir, brand.logo)) ? join(repoDir, brand.logo) : null;
const logo = spec.logo ? resolve(dirname(resolve(specPath)), spec.logo) : kitLogo;

// ---- narration -----------------------------------------------------------------------------
// Items (and endCard) may carry `say`: one narration line each. All lines go to the stock Gemini
// voice in ONE batched request (free tier: 10/day; cached by text), then the voice sets the clock:
// a card or still lasts as long as its line needs, a clip keeps its own length (a longer line
// runs on into the next item, never over the next line). Writes <piece>-<lang>.vo.wav, .srt, .vtt.
const fmt = (s, sep) => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}${sep}${p(ms % 1000, 3)}`;
};
function narrate() {
  const slots = [...(spec.items || []), ...(spec.endCard ? [spec.endCard] : [])];
  const says = slots.filter((it) => it.say);
  if (!says.length || spec.voice) return;
  const vdir = join(dir, '.voice');
  const script = join(vdir, 'script.json');
  mkdirSync(vdir, { recursive: true });
  writeFileSync(script, JSON.stringify({ engine: 'gemini', voice: spec.voiceName || 'Charon', lang, style: spec.voiceStyle, lines: says.map((it) => it.say) }));
  execFileSync('node', [join(KUN, '.claude/skills/edit/scripts/media/voice.mjs'), 'gen', script, '--out', vdir], { stdio: 'inherit' });
  const got = JSON.parse(readFileSync(join(vdir, 'voice.json'), 'utf8')).lines;
  const lines = [];
  let t = 0;
  let vEnd = 0;
  let k = 0;
  for (const it of slots) {
    const natural = it.type === 'clip' ? (it.out ?? probeSeconds(at(srcFor(it.src, '16:9')))) - (it.in ?? 0) : (it.seconds ?? (it === spec.endCard ? 3 : 0));
    let len = natural;
    if (it.say) {
      const g = got[k++];
      if (!g?.ok) throw new Error(`narration line failed: ${it.say}`);
      const file = resolve(vdir, g.file);
      const d = probeSeconds(file);
      const start = Math.max(t + 0.35, vEnd + 0.25);
      vEnd = start + d;
      lines.push({ file, start, end: vEnd, text: it.say });
      if (it.type !== 'clip') len = Math.max(natural, vEnd + 0.45 - t);
      else if (vEnd > t + natural) console.warn(`  … narration over a ${natural.toFixed(1)} s clip runs on: "${it.say.slice(0, 40)}…"`);
    }
    if (it.type !== 'clip') it.seconds = snap(len);
    else len = snap(len);
    t += len;
  }
  const vo = join(dir, `${piece}-${lang}.vo.wav`);
  const inputs = lines.flatMap((l) => ['-i', l.file]);
  const delays = lines.map((l, i) => `[${i}:a]adelay=${Math.round(l.start * 1000)}:all=1[a${i}]`).join(';');
  const mix = `${lines.map((_, i) => `[a${i}]`).join('')}amix=inputs=${lines.length}:normalize=0,apad=whole_dur=${t.toFixed(2)}[o]`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', `${delays};${mix}`, '-map', '[o]', '-ac', '2', '-ar', '48000', vo]);
  // The diacritics steer the voice (بِالقَلَم, اخترْ); on screen they are clutter. Shadda and tanween stay.
  const plain = (x) => x.replace(/[\u064E-\u0650\u0652\u0670]/g, '');
  const srt = lines.map((l, i) => `${i + 1}\n${fmt(l.start, ',')} --> ${fmt(l.end, ',')}\n${plain(l.text)}\n`).join('\n');
  writeFileSync(join(dir, `${piece}-${lang}.srt`), srt);
  writeFileSync(join(dir, `${piece}-${lang}.vtt`), `WEBVTT\n\n${lines.map((l) => `${fmt(l.start, '.')} --> ${fmt(l.end, '.')}\n${plain(l.text)}\n`).join('\n')}`);
  spec.voice = vo;
  if (spec.captions !== false) spec.captions = join(dir, `${piece}-${lang}.srt`);
}

// ---- FilmCraft -----------------------------------------------------------------------------
function fc(id, params = {}, { save = true } = {}) {
  const a = ['--project', project];
  if (save) a.push('--save');
  a.push('exec', id, JSON.stringify(params));
  const out = execFileSync(CLI, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try { return out ? JSON.parse(out) : null; } catch { return out; }
}
const ticks = (s) => Math.round(s * TPS);

function probeSeconds(file) {
  const out = execFileSync(CLI, ['probe', file], { encoding: 'utf8' });
  const j = JSON.parse(out);
  const d = j.duration ?? j.durationSeconds ?? j.format?.duration;
  if (typeof d === 'number') return d > 1e6 ? d / TPS : d;
  if (j.durationTicks) return j.durationTicks / TPS;
  throw new Error(`cannot read duration of ${file}`);
}

// ---- captions burn (libass) ----------------------------------------------------------------
const FFMPEG_FULL = '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg';
const ass = (hex) => `&H00${hex.slice(5, 7)}${hex.slice(3, 5)}${hex.slice(1, 3)}`.toUpperCase();
function burnCaptions(input, srt, out, tall) {
  // Solid brand box, Thmanyah Sans Bold; on a reel kept inside x 100–940 (clear of the right rail)
  // and above the bottom 20% where the platform UI sits. Units are libass's 384×288 script space.
  const style = [
    `FontName=${bodyFont}`, `FontSize=${tall ? 15 : 13}`, 'Bold=1',
    `PrimaryColour=${ass(v.captionInk)}`, `BackColour=${ass(v.captionBg)}`, `OutlineColour=${ass(v.captionBg)}`,
    'BorderStyle=3', 'Outline=5', 'Shadow=0', 'Alignment=2',
    `MarginV=${tall ? 62 : 18}`, `MarginL=${tall ? 36 : 40}`, `MarginR=${tall ? 52 : 40}`,
  ].join(',');
  const esc = (x) => x.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
  const vf = `subtitles='${esc(srt)}':fontsdir='${esc(join(homedir(), 'Library/Fonts'))}':force_style='${style.replace(/,/g, '\\,')}'`;
  execFileSync(existsSync(FFMPEG_FULL) ? FFMPEG_FULL : 'ffmpeg', ['-v', 'error', '-y', '-i', input, '-vf', vf, '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-c:a', 'copy', '-movflags', '+faststart', out]);
}

// ---- build ---------------------------------------------------------------------------------
const ASPECTS_DEFAULT = { '16:9': [1920, 1080], '9:16': [1080, 1920] };
const ASPECTS = { '16:9': [1920, 1080], '9:16': [1080, 1920], ...(spec.canvas || {}) };
const aspects = (onlyAspect ? [onlyAspect] : spec.aspects || ['16:9']).filter((a) => ASPECTS[a]);

if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
execFileSync(CLI, ['--save-as', project, 'exec', 'file.newProject', JSON.stringify({ name: piece })], { stdio: 'ignore' });

// A per-aspect source: "src" may be { "16:9": …, "9:16": … } (or landscape/portrait).
function srcFor(src, aspect) {
  if (!src || typeof src === 'string') return src;
  const alias = aspect === '9:16' ? 'portrait' : 'landscape';
  return src[aspect] ?? src[alias] ?? Object.values(src)[0];
}

const imported = new Map();
function importItem(file) {
  if (imported.has(file)) return imported.get(file);
  if (!existsSync(file)) throw new Error(`missing media: ${file}`);
  const r = fc('file.import', { paths: [file] }) ?? {};
  const first = (r.items || [])[0];
  const id = typeof first === 'object' ? first.item : first;
  imported.set(file, id);
  return id;
}

// Template graphics arrive at the template's own length (5–6 s): trim each to its slot.
function fit(clip, seconds) {
  const have = fc('graphics.list', { clip }, { save: false }).duration;
  const delta = ticks(seconds) - have;
  if (delta) fc('timeline.trim', { clip, edge: 'out', mode: 'regular', delta });
}


// An svg is rasterised once (currentColor → brand ink) into <spec>/.cache/img; a png/jpg is used as is.
function rasterise(file) {
  if (!existsSync(file)) throw new Error(`missing card image: ${file}`);
  if (!/\.svg$/i.test(file)) return file;
  const cdir = join(dir, '.cache/img');
  mkdirSync(cdir, { recursive: true });
  const out = join(cdir, `${basename(file, '.svg')}-${String(v.ink).replace('#', '')}.png`);
  if (existsSync(out)) return out;
  const svg = join(cdir, `${basename(file, '.svg')}-${String(v.ink).replace('#', '')}.svg`);
  writeFileSync(svg, readFileSync(file, 'utf8').replace(/currentColor/g, v.ink));
  let r = spawnSync('sips', ['-s', 'format', 'png', '-Z', '512', svg, '--out', out], { encoding: 'utf8' });
  if (r.status !== 0 || !existsSync(out)) r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', svg, '-vf', 'scale=-1:512', out], { encoding: 'utf8' });
  if (!existsSync(out)) throw new Error(`could not rasterise ${file}: ${(r.stderr || '').slice(-200)}`);
  return out;
}

function card(t, seconds, title, subtitle, tall, image) {
  const m = fc('file.newColorMatte', { color: v.canvas, seconds });
  fc('timeline.place', { item: m.item, track: 'V1', seconds: t, duration: { seconds } });
  const g = fc('graphics.template.apply', {
    template: 'builtin:title-centered', time: ticks(t),
    values: { title: title || '', subtitle: subtitle || '', title_color: v.ink, accent: v.accent, font: headFont, title_size: tall ? 170 : 140 },
  });
  // The template's subtitle is styled for dark grounds: give it the brand ink and body face, and
  // clear Arabic descenders: subtitle down, the accent rule between the two lines.
  const latin = subtitle && !/[\u0600-\u06FF]/.test(subtitle);
  fc('graphics.set', { clip: g.clip, layer: 'Subtitle', props: { fill_color: v.ink, font: latin ? 'Geist' : bodyFont, font_style: 'Regular', size: tall ? 64 : 54, opacity: 80 } });
  fc('graphics.moveLayers', { clip: g.clip, layers: [2], delta: [0, 45] });
  fc('graphics.moveLayers', { clip: g.clip, layers: [1], delta: [0, 22] });
  // A long title on a reel runs off the frame: shrink it to 86% of the width.
  for (const name of ['Title', 'Subtitle']) {
    const l = fc('graphics.list', { clip: g.clip }, { save: false }).layers.find((x) => x.name === name);
    const xs = l?.quad.map((q) => q[0]) ?? [];
    const span = xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
    const max = (tall ? 1080 : 1920) * 0.86;
    if (span > max) fc('graphics.set', { clip: g.clip, layer: name, props: { size: Math.floor(((name === 'Title' ? (tall ? 170 : 140) : tall ? 64 : 54) * max) / span) } });
  }
  fit(g.clip, seconds);
  if (image) {
    // The mark follows the figure in reading order, on the title's line: to its left in Arabic
    // (RTL, «٢٥ ⃁»), to its right in Latin («25 ⃁»). Sized to the figure's cap height.
    const png = rasterise(image);
    const frameW = tall ? 1080 : 1920, frameH = tall ? 1920 : 1080;
    const tl = fc('graphics.list', { clip: g.clip }, { save: false }).layers.find((x) => x.name === 'Title');
    const xs = tl?.quad.map((q) => q[0]) ?? [frameW / 2, frameW / 2];
    const ys = tl?.quad.map((q) => q[1]) ?? [frameH / 2, frameH / 2];
    const capH = Math.max(Math.max(...ys) - Math.min(...ys), Math.min(frameW, frameH) * 0.1);
    const size = capH * 0.8;
    const rtl = /[؀-ۿ]/.test(title || '');
    const gap = size * 0.25;
    const x = rtl ? Math.min(...xs) - gap - size / 2 : Math.max(...xs) + gap + size / 2;
    const y = (Math.min(...ys) + Math.max(...ys)) / 2;
    const l = fc('timeline.place', { item: importItem(png), track: 'new', seconds: t, duration: { seconds } });
    fc('effects.setParam', { clip: l.clips[0], effect: 'motion', param: 'scale', value: (size / 512) * 100 });
    fc('effects.setParam', { clip: l.clips[0], effect: 'motion', param: 'position', value: [x, y] });
  }
  return g.clip;
}

// A label (lower-third slab) goes where the picture is empty. `labelPos` per item or spec:
// "top-left" | "top-right" | "bottom-left" | "bottom-right". Defaults: a wide film top-left (an RTL
// page has its title top-right), a reel top-right under the platform's top bar — the captions own
// the lower half. Pins bind x only (Slab → Name, Accent → Slab), so a horizontal move takes the free
// layers and the pinned ones follow; a vertical move takes every layer.
function lowerThird(t, seconds, text, width, height, pos) {
  const tall = height > width;
  const g = fc('graphics.template.apply', {
    template: 'builtin:lower-third-slab', time: ticks(t),
    values: { name: text, show_role: false, slab_color: v.captionBg, accent_color: v.accent, text_color: v.captionInk, font: bodyFont },
  });
  fc('graphics.set', { clip: g.clip, layer: 'Slab', props: { opacity: 100 } });
  // A reel is 1080 wide but the template is drawn for 1920: a bigger name; the slab follows.
  if (tall) fc('graphics.set', { clip: g.clip, layer: 'Name', props: { size: 84 } });
  const [vert, side] = (pos || (tall ? 'top-right' : 'top-left')).split('-');
  const layers = fc('graphics.list', { clip: g.clip }, { save: false }).layers.filter((l) => l.enabled !== false);
  const xs = layers.flatMap((l) => l.quad.map((q) => q[0]));
  const ys = layers.flatMap((l) => l.quad.map((q) => q[1]));
  const margin = width * 0.04;
  const dx = Math.round(side === 'right' ? width - margin - Math.max(...xs) : margin - Math.min(...xs));
  const dy = Math.round(vert === 'top' ? height * (tall ? 0.13 : 0.14) - Math.min(...ys) : 0);
  const loose = layers.filter((l) => !l.pin).map((l) => l.layer);
  if (dx) fc('graphics.moveLayers', { clip: g.clip, layers: loose, delta: [dx, 0] });
  if (dy) fc('graphics.moveLayers', { clip: g.clip, layers: layers.map((l) => l.layer), delta: [0, dy] });
  fit(g.clip, seconds);
  return g.clip;
}

// ---- deliver: media.sh encode + qa-pack --------------------------------------------------------
// The reel profile caps at 60 s unless told otherwise, so every encode gets the piece's real length.
function deliver(master, aspect, w, h, seconds) {
  const media = join(KUN_EDIT, 'media.sh');
  const tall = aspect === '9:16';
  const dest = master.replace(/\.mp4$/, '.final.mp4');
  const std = ASPECTS_DEFAULT[aspect];
  const enc = ['encode', tall ? 'reel' : 'web', master, dest, '--max', String(Math.round(seconds * 100) / 100 + 0.02)];
  if (!std || std[0] !== w || std[1] !== h) enc.push('--box', `${w}x${h}`);
  execFileSync('bash', [media, ...enc], { stdio: ['ignore', 'ignore', 'inherit'] });
  const qa = spawnSync('bash', [media, 'qa-pack', dest], { encoding: 'utf8' });
  console.error(qa.stdout || '', qa.stderr || '');
  report.delivered.push({ aspect, master, file: dest, qa: (qa.stdout || '').trim().split('\n').slice(-12).join('\n'), qaExit: qa.status });
}
narrate();
const report = { project, outputs: [], delivered: [], frames: [] };

for (const aspect of aspects) {
  const [w, h] = ASPECTS[aspect];
  const seq = fc('file.newSequence', { name: `${piece} ${aspect}`, width: w, height: h, fps: spec.fps || 30 }).sequence;
  let t = 0;
  const videoClips = [];
  const reframes = [];

  const END = spec.end != null ? snap(spec.end) : Infinity;
  const moves = [];
  const dissolves = [];
  for (const it of spec.items || []) {
    if (t >= END) break;
    const secs = it.seconds ?? it.voiceSeconds;
    if (it.type === 'card') {
      const cs = snap(Math.min(secs ?? 3, END - t));
      card(t, cs, it.title, it.subtitle, h > w, it.image ? at(it.image) : null);
      t += cs;
      continue;
    }
    const file = at(srcFor(it.src, aspect));
    const item = importItem(file);
    let len;
    // A reframed picture in a reel may not cover the frame: it rides on V2 over a brand-canvas matte.
    const onCanvas = h > w && it.reel;
    const place = { item, track: onCanvas ? 'V2' : 'V1', seconds: t };
    if (it.type === 'clip') {
      const inS = it.in ?? 0;
      len = snap(Math.min((it.out ?? probeSeconds(file)) - inS, END - t));
      place.sourceIn = { seconds: inS };
      place.duration = { seconds: len };
      if (it.mute || spec.voice) place.audio = false;
    } else {
      len = snap(Math.min(secs ?? 5, END - t));
      place.duration = { seconds: len };
    }
    const r = fc('timeline.place', place);
    videoClips.push(...(r.clips || []));
    if (onCanvas) {
      const m = fc('file.newColorMatte', { color: v.canvas, seconds: len });
      fc('timeline.place', { item: m.item, track: 'V1', seconds: t, duration: { seconds: len } });
    }
    if (it.type === 'still' && it.move) moves.push({ clip: (r.clips || [])[0], file, move: it.move, t, len, onCanvas });
    if (it.transition && t > 0) dissolves.push({ clip: (r.clips || [])[0], ...it.transition });
    if (h > w && it.reel) reframes.push({ clip: (r.clips || [])[0], file, ...it.reel });
    if (it.label) lowerThird(t, Math.min(len, 4), it.label, w, h, it.labelPos ?? spec.labelPos);
    t += len;
  }

  if (spec.endCard && t < END) {
    const s = snap(Math.min(spec.endCard.seconds || 3, END - t));
    card(t, s, spec.endCard.title || '', spec.endCard.subtitle || brand.hosts?.prod?.replace(/^https?:\/\//, ''), h > w);
    if (logo) {
      // The mark above the title: a 512 px square at ~22% of the short side, centred.
      const l = fc('timeline.place', { item: importItem(logo), track: 'new', seconds: t, duration: { seconds: s } });
      const size = Math.min(w, h) * 0.22;
      fc('effects.setParam', { clip: l.clips[0], effect: 'motion', param: 'scale', value: (size / 512) * 100 });
      fc('effects.setParam', { clip: l.clips[0], effect: 'motion', param: 'position', value: [w / 2, h / 2 - size * 1.1] });
    }
    t += s;
  }

  // Size every picture to the frame: a reel fills (crops the sides of a 16:9 take), a wide film
  // fits (a phone still keeps its aspect). `"frame": "fill"|"fit"` in the spec overrides.
  const sized = videoClips.length ? fc((spec.frame ?? (h > w ? 'fill' : 'fit')) === 'fill' ? 'clip.fillFrame' : 'clip.fitToFrame', { clips: videoClips }) : null;
  // A wide screenshot in a reel: `"reel": {"cx": 0.4, "cy": 0.55, "width": 1.6}` puts the source
  // point (cx, cy) — fractions of the picture — at the frame's centre, the picture spanning 1.6
  // frame widths, centred at 42% of the height (`at`) to clear the captions. Without it the reel
  // fills (centre crop), which can miss what the line names.
  // Motion scale is relative to how FilmCraft sized the clip, so it is read off fillFrame's result.
  const fillScale = new Map((sized?.clips || []).map((c) => [c.clip, c.scale]));
  for (const f of reframes) {
    const src = JSON.parse(execFileSync(CLI, ['probe', f.file], { encoding: 'utf8' }));
    const W = src.video?.width ?? src.width;
    const H = src.video?.height ?? src.height;
    const F = fillScale.get(f.clip);
    if (!W || !H || !F) continue;
    const filledW = Math.max(w, (h * W) / H); // the picture's width on screen at the fill scale
    const Wd = (f.width ?? 1.6) * w;
    const Hd = (Wd * H) / W;
    fc('effects.setParam', { clip: f.clip, effect: 'motion', param: 'scale', value: (F * Wd) / filledW });
    fc('effects.setParam', { clip: f.clip, effect: 'motion', param: 'position', value: [w / 2 - ((f.cx ?? 0.5) - 0.5) * Wd, h * (f.at ?? 0.42) - ((f.cy ?? 0.5) - 0.5) * Hd] });
  }

  // Ken Burns: still.move keys Motion scale + position. Scale is FilmCraft's own value (percent of the
  // size the frame mode gave the picture, `fillScale`), so zoom z -> scale F*z; position puts the picture
  // point (cx, cy) at the frame centre. Easing: linear, or auto-bezier (a soft in/out) unless the
  // ease asks for outCubic (easeOut) / inCubic (easeIn).
  const interp = { linear: 'linear', outCubic: 'easeOut', inCubic: 'easeIn' };
  for (const m of moves) {
    const src = JSON.parse(execFileSync(CLI, ['probe', m.file], { encoding: 'utf8' }));
    const W = src.video?.width ?? src.width;
    const H = src.video?.height ?? src.height;
    const F = fillScale.get(m.clip);
    if (!W || !H || !F) continue;
    const fill = (spec.frame ?? (h > w ? 'fill' : 'fit')) === 'fill';
    const baseW = fill ? Math.max(w, (h * W) / H) : Math.min(w, (h * W) / H);
    const baseH = (baseW * H) / W;
    const key = (time, [cx, cy, z]) => {
      const dW = baseW * z, dH = baseH * z;
      fc('effects.setParam', { clip: m.clip, effect: 'motion', param: 'scale', value: F * z, time: ticks(time), keyframe: true });
      fc('effects.setParam', { clip: m.clip, effect: 'motion', param: 'position', value: [w / 2 - (cx - 0.5) * dW, h / 2 - (cy - 0.5) * dH], time: ticks(time), keyframe: true });
    };
    const last = m.t + m.len - 1 / FPS; // the clip's last frame
    key(m.t, m.move.from);
    key(last, m.move.to);
    const mode = interp[m.move.ease] ?? 'autoBezier';
    for (const param of ['scale', 'position']) {
      for (const time of [m.t, last]) { // setInterpolation's mediaTime is clip-relative (source time of a still)
        fc('effects.setInterpolation', { clip: m.clip, effect: 'motion', param, mediaTime: ticks(time - m.t), interpolation: mode });
      }
    }
  }
  for (const d of dissolves) {
    const params = { clip: d.clip, effect: d.type || 'cross_dissolve', frames: d.frames ?? 12, edge: 'in' };
    try { fc('sequence.applyVideoTransition', { ...params, align: d.align ?? 'center' }); }
    catch { fc('sequence.applyVideoTransition', { ...params, align: 'start' }); } // no handle to straddle the cut
  }

  if (spec.voice) {
    const vo = fc('timeline.place', { item: importItem(at(spec.voice)), track: 'A2', seconds: 0, video: false });
    fc('essentialSound.setType', { clips: vo.clips, type: 'dialogue' });
  }
  if (spec.music) {
    // "bed.m4a" or { src, db, fadeIn, fadeOut, start } — fades in seconds, start = offset into the source.
    const M = typeof spec.music === 'string' ? { src: spec.music } : spec.music;
    const mplace = { item: importItem(at(M.src)), track: 'A3', seconds: 0, video: false, duration: { seconds: Math.min(t, END) } };
    if (M.start) mplace.sourceIn = { seconds: M.start };
    const mu = fc('timeline.place', mplace);
    fc('essentialSound.setType', { clips: mu.clips, type: 'music' });
    fc('essentialSound.set', { clips: mu.clips, key: 'volume.levelDb', value: M.db ?? spec.musicDb ?? -18 });
    for (const [edge, secs] of [['in', M.fadeIn], ['out', M.fadeOut]]) {
      if (secs > 0) fc('sequence.applyAudioTransition', { clip: mu.clips[0], effect: 'constant_power', frames: Math.round(secs * FPS), edge, align: edge === 'in' ? 'start' : 'end' });
    }
    if (spec.voice) fc('essentialSound.generateDucking', { clips: mu.clips });
  }
  // A true-peak ceiling on the mix bus: the export's loudness gain and a music bed's transients
  // otherwise clip the master, and no later encode can take that back (budget: ≤ −1.5 dBTP). −4 leaves
  // media.sh encode (loudnorm TP −2.5) room to stay linear; at −2 it went dynamic and overshot.
  if (spec.voice || spec.music || (spec.items || []).some((i) => i.type === 'clip' && !i.mute)) {
    const ins = fc('mixer.addInsert', { strip: 'Mix', effect: 'hard_limiter' });
    fc('mixer.setInsert', { strip: 'Mix', slot: ins?.slot ?? 0, params: { max: -4 } });
  }
  if (spec.captions) {
    fc('captions.import', { path: at(spec.captions), language: lang });
    fc('captions.setStyle', {
      track: 'C1', font: bodyFont, fontStyle: 'Bold', size: aspect === '9:16' ? 54 : 44,
      color: v.captionInk, background: true, backgroundColor: `${v.captionBg}ff`,
      anchor: 'bottom', margin: aspect === '9:16' ? 0.2 : 0.08,
    });
  }

  if (flag('--frames')) {
    const png = join(dir, `${piece}-${lang}.${aspect === '9:16' ? 'reel' : 'wide'}.frame.png`);
    execFileSync(CLI, ['--project', project, 'render', '--seconds', String(Math.max(0.5, t / 2)), '--out', png, '--scale', '0.5'], { stdio: 'ignore' });
    report.frames.push(png);
  }
  if (!flag('--no-export')) {
    const out = join(dir, `${piece}-${lang}${aspect === '9:16' ? '.reel' : ''}.mp4`);
    // Narrated wide videos carry the .vtt sidecar (no captions on screen); reels play muted, so they
    // burn. FilmCraft's caption renderer drops the dots of a final ي in Thmanyah (its graphics engine
    // does not), so captions burn through libass, the house path, after the export.
    const burn = !!spec.captions && (spec.burnCaptions ?? aspect === '9:16');
    const clean = burn ? out.replace(/\.mp4$/, '.nocap.mp4') : out;
    // No loudnessLufs here: media.sh encode owns loudness (see the header).
    // The master is a mezzanine: media.sh encodes the deliverable from it, so it must not lose detail.
    // FilmCraft's default h264 bitrate smears fine texture (grass, leaves: 7/255 off on a held frame),
    // so export CRF 12 High unless the spec's `master` says otherwise.
    const master = { format: 'h264', bitrateMode: 'crf', crf: 12, h264Profile: 'high', ...(spec.master || {}) };
    fc('file.exportMedia', { path: clean, ...master, sequence: seq, wait: true }, { save: false });
    if (burn) {
      burnCaptions(clean, at(spec.captions), out, h > w);
      rmSync(clean, { force: true });
    }
    report.outputs.push(out);
    if (flag('--deliver')) deliver(out, aspect, w, h, Math.min(t, END));
  }
  report[aspect] = { seconds: Number(t.toFixed(2)), sequence: seq };
}

console.log(JSON.stringify(report, null, 2));
