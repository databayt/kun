#!/usr/bin/env node

/**
 * Gemini media — the Google renderer for the raster lane.
 *
 * Why this exists: the showroom's raster lane has been running through
 * Higgsfield, whose `nano_banana_pro` / `nano_banana_flash` job types are
 * resold Google models. The account sits at 0.7 credits, so the lane is
 * effectively dead. This script calls the same models at the source — no
 * reseller margin, no credit ceiling, pay per image.
 *
 * Three lanes, two API shapes:
 *   image → POST /v1beta/interactions          (nano banana family, synchronous)
 *   omni  → POST /v1beta/interactions          (video, same shape as image)
 *   video → POST /v1beta/models/<id>:predictLongRunning + poll  (Veo)
 *
 * Usage:
 *   node scripts/gemini-media.mjs image --prompt "..." [--model flash|lite|pro|legacy]
 *          [--ratio 16:9] [--size 1K|2K|4K] [--ref a.png --ref b.png] [--out path]
 *   node scripts/gemini-media.mjs video --prompt "..." [--model veo|veo-fast|veo-lite]
 *          [--seconds 4|6|8] [--res 720p|1080p|4k] [--ratio 16:9|9:16] [--start-image f.png]
 *   node scripts/gemini-media.mjs omni  --prompt "..." [--ratio 16:9|9:16]
 *   node scripts/gemini-media.mjs cost  --kind image|video|omni [--model M] [--size S]
 *          [--seconds N] [--count N]
 *   node scripts/gemini-media.mjs models
 *
 * Spending is gated the way /higgs gates it: every generate prints the estimate
 * first and refuses to spend without --yes (or KUN_GEMINI_AUTOSPEND=1).
 *
 * Every command prints JSON on the last line so callers can parse it.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(os.homedir(), 'Downloads', 'gemini');

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

// ---------------------------------------------------------------------------
// Model catalogue — IDs, limits and prices verified against
// ai.google.dev/gemini-api/docs/{image-generation,veo,omni,pricing} on 2026-08-05.
// Prices are USD, standard (non-batch) tier. Re-verify when Google ships a model;
// `models` prints this table so the skill never hardcodes a number.
// ---------------------------------------------------------------------------

const IMAGE_MODELS = {
  lite: {
    id: 'gemini-3.1-flash-lite-image',
    label: 'Nano Banana 2 Lite',
    sizes: ['1K'],
    price: { '1K': 0.0336 },
    refs: 'up to 14 object images; no character/style references',
  },
  flash: {
    id: 'gemini-3.1-flash-image',
    label: 'Nano Banana 2',
    sizes: ['512px', '1K', '2K', '4K'],
    price: { '512px': 0.045, '1K': 0.067, '2K': 0.101, '4K': 0.151 },
    refs: 'up to 10 object + 4 character + 3 style references',
  },
  pro: {
    id: 'gemini-3-pro-image',
    label: 'Nano Banana Pro',
    sizes: ['1K', '2K', '4K'],
    price: { '1K': 0.134, '2K': 0.134, '4K': 0.24 },
    refs: 'up to 6 object + 5 character references',
  },
  // The only image model with a documented free lane (~500 images/day at 1K on
  // an AI Studio key). Unverified against our own key — see `cost --kind image`.
  legacy: {
    id: 'gemini-2.5-flash-image',
    label: 'Nano Banana (original)',
    sizes: ['1K', '2K', '4K'],
    price: { '1K': 0.039, '2K': 0.039, '4K': 0.039 },
    refs: 'reference images supported',
  },
};

const VIDEO_MODELS = {
  veo: {
    id: 'veo-3.1-generate-preview',
    label: 'Veo 3.1',
    perSecond: { '720p': 0.4, '1080p': 0.4, '4k': 0.6 },
  },
  'veo-fast': {
    id: 'veo-3.1-fast-generate-preview',
    label: 'Veo 3.1 Fast',
    perSecond: { '720p': 0.1, '1080p': 0.12, '4k': 0.3 },
  },
  'veo-lite': {
    id: 'veo-3.1-lite-generate-preview',
    label: 'Veo 3.1 Lite',
    perSecond: { '720p': 0.05, '1080p': 0.08 }, // 4k unsupported on Lite
  },
};

const OMNI_MODEL = {
  id: 'gemini-omni-flash-preview',
  label: 'Gemini Omni Flash',
  perSecond: 0.1, // ~$0.10/s of 720p, billed as $17.50 / 1M output tokens
};

// Ratios the nano banana family accepts. Uppercase K on sizes is mandatory —
// the API rejects "1k".
const IMAGE_RATIOS = ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
const VIDEO_RATIOS = ['16:9', '9:16'];

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------

/** Parse `--flag value` / `--flag` argv into an object; repeated flags collect. */
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      out._.push(a);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    const value = next && !next.startsWith('--') ? (i++, next) : true;
    if (key in out) out[key] = [].concat(out[key], value);
    else out[key] = value;
  }
  return out;
}

const first = (v) => (Array.isArray(v) ? v[0] : v);
const list = (v) => (v === undefined ? [] : [].concat(v));

/**
 * Read the key from the process env, falling back to the repo's central .env.
 * Trimmed on purpose: env values pasted through Vercel carry a trailing newline
 * that turns the auth header into a 400 with an unhelpful message. That bug
 * already cost us once (kun report-issue, PR #97).
 */
function apiKey() {
  let key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
  if (!key) {
    const envPath = path.join(rootDir, '.env');
    if (fs.existsSync(envPath)) {
      const line = fs
        .readFileSync(envPath, 'utf8')
        .split('\n')
        .find((l) => /^\s*(GEMINI_API_KEY|GOOGLE_GENAI_API_KEY)\s*=/.test(l));
      if (line) key = line.slice(line.indexOf('=') + 1).replace(/^["']|["']$/g, '');
    }
  }
  key = key.trim();
  if (!key) {
    fail(
      'GEMINI_API_KEY is not set.\n' +
        '  Create a key at https://aistudio.google.com/apikey, then add to kun/.env:\n' +
        '    GEMINI_API_KEY=...\n' +
        '  (central .env only — never .env.local)',
    );
  }
  return key;
}

function fail(message, extra = {}) {
  console.error(`\n✗ ${message}\n`);
  console.log(JSON.stringify({ ok: false, error: message, ...extra }));
  process.exit(1);
}

async function postJSON(url, body, key) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) fail(`${res.status} ${res.statusText} — ${text.slice(0, 600)}`);
  try {
    return JSON.parse(text);
  } catch {
    return fail(`Unparseable response: ${text.slice(0, 400)}`);
  }
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function outputPath(explicit, prompt, ext) {
  if (explicit && explicit !== true) return path.resolve(String(explicit));
  fs.mkdirSync(outDir, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  const stem = `${day}-${slugify(prompt) || 'gemini'}`;
  let file = path.join(outDir, `${stem}.${ext}`);
  let n = 2;
  while (fs.existsSync(file)) file = path.join(outDir, `${stem}-${n++}.${ext}`);
  return file;
}

/**
 * Walk an Interactions response for the first inline blob of `kind`.
 * The documented shape is steps[].content[] with {type, mime_type, data}; the
 * fallback covers keys that still answer on the older :generateContent surface.
 */
function extractInline(payload, kind) {
  for (const step of payload?.steps ?? []) {
    for (const block of step?.content ?? []) {
      if (block?.type === kind && block?.data) {
        return { data: block.data, mime: block.mime_type ?? null };
      }
      // delivery="uri" hands back a link instead of bytes for large outputs.
      if (block?.type === kind && block?.uri) {
        return { uri: block.uri, mime: block.mime_type ?? null };
      }
    }
  }
  for (const cand of payload?.candidates ?? []) {
    for (const part of cand?.content?.parts ?? []) {
      const inline = part?.inlineData ?? part?.inline_data;
      if (inline?.data) return { data: inline.data, mime: inline.mimeType ?? inline.mime_type ?? null };
    }
  }
  return null;
}

function extToken(mime, fallback) {
  if (!mime) return fallback;
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('mp4')) return 'mp4';
  return fallback;
}

/** Print the estimate and stop unless the caller opted into spending. */
function gateSpend(estimate, args, detail) {
  const cleared = args.yes === true || process.env.KUN_GEMINI_AUTOSPEND === '1';
  console.error(`  estimate: $${estimate.toFixed(4)} — ${detail}`);
  if (cleared) return;
  console.error('  (dry run — re-run with --yes to spend)');
  console.log(JSON.stringify({ ok: true, spent: false, estimateUsd: Number(estimate.toFixed(4)), detail }));
  process.exit(0);
}

function saveBase64(file, b64) {
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  return fs.statSync(file).size;
}

// ---------------------------------------------------------------------------
// image — nano banana family, Interactions API, synchronous
// ---------------------------------------------------------------------------

async function cmdImage(args) {
  const prompt = first(args.prompt);
  if (!prompt || prompt === true) fail('--prompt is required');

  const alias = String(first(args.model) ?? 'flash');
  const model = IMAGE_MODELS[alias];
  if (!model) fail(`Unknown image model "${alias}". One of: ${Object.keys(IMAGE_MODELS).join(', ')}`);

  // Normalise the size token — the API rejects lowercase "1k".
  let size = String(first(args.size) ?? model.sizes[0]).replace(/^(\d+)k$/i, (_, n) => `${n}K`);
  if (size.toLowerCase() === '512px') size = '512px';
  if (!model.sizes.includes(size)) {
    fail(`${model.label} supports ${model.sizes.join(', ')} — got "${size}"`);
  }

  const ratio = String(first(args.ratio) ?? '16:9');
  if (!IMAGE_RATIOS.includes(ratio)) fail(`Unsupported ratio "${ratio}". One of: ${IMAGE_RATIOS.join(', ')}`);

  const refs = list(args.ref).filter((r) => r !== true);
  const input = [{ type: 'text', text: prompt }];
  for (const ref of refs) {
    const p = path.resolve(String(ref));
    if (!fs.existsSync(p)) fail(`Reference image not found: ${p}`);
    input.push({
      type: 'image',
      mime_type: p.endsWith('.jpg') || p.endsWith('.jpeg') ? 'image/jpeg' : 'image/png',
      data: fs.readFileSync(p).toString('base64'),
    });
  }

  const price = model.price[size] ?? 0;
  gateSpend(price, args, `${model.label} @ ${size} ${ratio}${refs.length ? ` + ${refs.length} ref(s)` : ''}`);

  const body = {
    model: model.id,
    input,
    response_format: { type: 'image', aspect_ratio: ratio, image_size: size },
  };
  if (args.thinking) body.generation_config = { thinking_level: String(first(args.thinking)) };
  if (args.search) body.tools = [{ type: 'google_search', search_types: ['web_search', 'image_search'] }];

  const payload = await postJSON(`${BASE}/interactions`, body, apiKey());
  const blob = extractInline(payload, 'image');
  if (!blob?.data) fail('No image in response', { status: payload?.status, id: payload?.id });

  const file = outputPath(args.out, prompt, extToken(blob.mime, 'png'));
  const bytes = saveBase64(file, blob.data);

  console.error(`  ✓ ${file} (${(bytes / 1024).toFixed(0)} KB)`);
  console.log(
    JSON.stringify({
      ok: true,
      spent: true,
      kind: 'image',
      file,
      bytes,
      model: model.id,
      modelLabel: model.label,
      ratio,
      size,
      refs: refs.length,
      costUsd: price,
      interactionId: payload?.id ?? null,
      synthid: true,
    }),
  );
}

// ---------------------------------------------------------------------------
// video — Veo, long-running operation + poll + download
// ---------------------------------------------------------------------------

async function cmdVideo(args) {
  const prompt = first(args.prompt);
  if (!prompt || prompt === true) fail('--prompt is required');

  const alias = String(first(args.model) ?? 'veo-lite');
  const model = VIDEO_MODELS[alias];
  if (!model) fail(`Unknown video model "${alias}". One of: ${Object.keys(VIDEO_MODELS).join(', ')}`);

  const seconds = Number(first(args.seconds) ?? 8);
  if (![4, 6, 8].includes(seconds)) fail('--seconds must be 4, 6 or 8');

  const res = String(first(args.res) ?? '720p').toLowerCase();
  if (!model.perSecond[res]) {
    fail(`${model.label} supports ${Object.keys(model.perSecond).join(', ')} — got "${res}"`);
  }
  // 1080p and 4k are 8-second-only, and reference images force 8s too.
  const startImage = first(args['start-image']);
  if ((res === '1080p' || res === '4k') && seconds !== 8) {
    fail(`${res} requires --seconds 8`);
  }

  const ratio = String(first(args.ratio) ?? '16:9');
  if (!VIDEO_RATIOS.includes(ratio)) fail(`Veo supports ${VIDEO_RATIOS.join(', ')} — got "${ratio}"`);

  const price = model.perSecond[res] * seconds;
  gateSpend(price, args, `${model.label} ${seconds}s @ ${res} ${ratio}`);

  const key = apiKey();
  const instance = { prompt };
  if (startImage && startImage !== true) {
    const p = path.resolve(String(startImage));
    if (!fs.existsSync(p)) fail(`Start image not found: ${p}`);
    instance.image = {
      bytesBase64Encoded: fs.readFileSync(p).toString('base64'),
      mimeType: p.endsWith('.jpg') || p.endsWith('.jpeg') ? 'image/jpeg' : 'image/png',
    };
  }

  const op = await postJSON(
    `${BASE}/models/${model.id}:predictLongRunning`,
    {
      instances: [instance],
      parameters: { durationSeconds: seconds, resolution: res, aspectRatio: ratio },
    },
    key,
  );
  if (!op?.name) fail('Veo did not return an operation name', { op });
  console.error(`  operation ${op.name} — polling (video takes minutes)`);

  // Poll until done. Veo keeps the render for 2 days, so we download immediately.
  const deadline = Date.now() + 20 * 60 * 1000;
  let done = null;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 10_000));
    const res2 = await fetch(`${BASE}/${op.name}`, { headers: { 'x-goog-api-key': key } });
    const poll = await res2.json();
    if (poll?.error) fail(`Veo failed: ${JSON.stringify(poll.error).slice(0, 400)}`);
    if (poll?.done) {
      done = poll;
      break;
    }
    process.stderr.write('.');
  }
  process.stderr.write('\n');
  if (!done) fail('Timed out after 20 minutes waiting for Veo');

  const uri = done?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (!uri) fail('Veo finished but returned no video URI', { response: done?.response });

  const file = outputPath(args.out, prompt, 'mp4');
  const dl = await fetch(uri, { headers: { 'x-goog-api-key': key } });
  if (!dl.ok) fail(`Download failed: ${dl.status} ${dl.statusText}`);
  fs.writeFileSync(file, Buffer.from(await dl.arrayBuffer()));
  const bytes = fs.statSync(file).size;

  console.error(`  ✓ ${file} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
  console.log(
    JSON.stringify({
      ok: true,
      spent: true,
      kind: 'video',
      file,
      bytes,
      model: model.id,
      modelLabel: model.label,
      seconds,
      resolution: res,
      ratio,
      costUsd: Number(price.toFixed(4)),
      audio: true,
      synthid: true,
    }),
  );
}

// ---------------------------------------------------------------------------
// omni — Gemini Omni Flash video through the same Interactions surface
// ---------------------------------------------------------------------------

async function cmdOmni(args) {
  const prompt = first(args.prompt);
  if (!prompt || prompt === true) fail('--prompt is required');

  const ratio = String(first(args.ratio) ?? '16:9');
  if (!VIDEO_RATIOS.includes(ratio)) fail(`Omni supports ${VIDEO_RATIOS.join(', ')} — got "${ratio}"`);

  // Omni bills by output tokens, so the estimate is a ~$0.10/s-of-720p proxy.
  const seconds = Number(first(args.seconds) ?? 8);
  gateSpend(OMNI_MODEL.perSecond * seconds, args, `${OMNI_MODEL.label} ~${seconds}s @ ${ratio} (token-billed estimate)`);

  const body = {
    model: OMNI_MODEL.id,
    input: [{ type: 'text', text: prompt }],
    response_format: { type: 'video', aspect_ratio: ratio },
  };
  if (args.continue && args.continue !== true) body.previous_interaction_id = String(first(args.continue));

  const payload = await postJSON(`${BASE}/interactions`, body, apiKey());
  const blob = extractInline(payload, 'video');
  if (!blob) fail('No video in response', { status: payload?.status, id: payload?.id });

  const file = outputPath(args.out, prompt, 'mp4');
  let bytes;
  if (blob.data) {
    bytes = saveBase64(file, blob.data);
  } else {
    const dl = await fetch(blob.uri, { headers: { 'x-goog-api-key': apiKey() } });
    if (!dl.ok) fail(`Download failed: ${dl.status} ${dl.statusText}`);
    fs.writeFileSync(file, Buffer.from(await dl.arrayBuffer()));
    bytes = fs.statSync(file).size;
  }

  console.error(`  ✓ ${file} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
  console.log(
    JSON.stringify({
      ok: true,
      spent: true,
      kind: 'video',
      file,
      bytes,
      model: OMNI_MODEL.id,
      modelLabel: OMNI_MODEL.label,
      ratio,
      // Stateful editing: feed this back via --continue to revise the same clip.
      interactionId: payload?.id ?? null,
      audio: true,
      synthid: true,
    }),
  );
}

// ---------------------------------------------------------------------------
// cost / models — free, local, no network
// ---------------------------------------------------------------------------

function cmdCost(args) {
  const kind = String(first(args.kind) ?? 'image');
  const count = Number(first(args.count) ?? 1);

  if (kind === 'image') {
    const model = IMAGE_MODELS[String(first(args.model) ?? 'flash')];
    if (!model) fail(`Unknown image model. One of: ${Object.keys(IMAGE_MODELS).join(', ')}`);
    const size = String(first(args.size) ?? model.sizes[0]).replace(/^(\d+)k$/i, (_, n) => `${n}K`);
    const unit = model.price[size];
    if (unit === undefined) fail(`${model.label} supports ${model.sizes.join(', ')}`);
    const total = unit * count;
    console.error(`  ${model.label} @ ${size} × ${count} = $${total.toFixed(4)}`);
    console.log(JSON.stringify({ ok: true, kind, model: model.id, size, count, unitUsd: unit, totalUsd: Number(total.toFixed(4)) }));
    return;
  }

  const seconds = Number(first(args.seconds) ?? 8);
  if (kind === 'omni') {
    const total = OMNI_MODEL.perSecond * seconds * count;
    console.error(`  ${OMNI_MODEL.label} ${seconds}s × ${count} ≈ $${total.toFixed(4)}`);
    console.log(JSON.stringify({ ok: true, kind, model: OMNI_MODEL.id, seconds, count, totalUsd: Number(total.toFixed(4)) }));
    return;
  }

  const model = VIDEO_MODELS[String(first(args.model) ?? 'veo-lite')];
  if (!model) fail(`Unknown video model. One of: ${Object.keys(VIDEO_MODELS).join(', ')}`);
  const res = String(first(args.res) ?? '720p').toLowerCase();
  const unit = model.perSecond[res];
  if (unit === undefined) fail(`${model.label} supports ${Object.keys(model.perSecond).join(', ')}`);
  const total = unit * seconds * count;
  console.error(`  ${model.label} ${seconds}s @ ${res} × ${count} = $${total.toFixed(4)}`);
  console.log(
    JSON.stringify({ ok: true, kind, model: model.id, resolution: res, seconds, count, perSecondUsd: unit, totalUsd: Number(total.toFixed(4)) }),
  );
}

function cmdModels() {
  const rows = [];
  for (const [alias, m] of Object.entries(IMAGE_MODELS)) {
    rows.push({ alias, kind: 'image', id: m.id, label: m.label, sizes: m.sizes, price: m.price, refs: m.refs });
  }
  for (const [alias, m] of Object.entries(VIDEO_MODELS)) {
    rows.push({ alias, kind: 'video', id: m.id, label: m.label, perSecondUsd: m.perSecond, durations: [4, 6, 8] });
  }
  rows.push({ alias: 'omni', kind: 'video', id: OMNI_MODEL.id, label: OMNI_MODEL.label, perSecondUsd: OMNI_MODEL.perSecond });

  for (const r of rows) {
    console.error(`  ${r.alias.padEnd(10)} ${r.kind.padEnd(6)} ${r.id}`);
  }
  console.log(JSON.stringify({ ok: true, verifiedOn: '2026-08-05', models: rows }));
}

// ---------------------------------------------------------------------------

const [, , command, ...rest] = process.argv;
const args = parseArgs(rest);

const commands = { image: cmdImage, video: cmdVideo, omni: cmdOmni, cost: cmdCost, models: cmdModels };

if (!command || !commands[command]) {
  console.error(`Usage: node scripts/gemini-media.mjs <${Object.keys(commands).join('|')}> [options]`);
  console.error('See the header of this file, or .claude/skills/higgs/SKILL.md § Gemini lane.');
  process.exit(command ? 1 : 0);
}

await commands[command](args);
