#!/usr/bin/env node

/**
 * agy-image — Nano Banana through Antigravity, on Abdout's own Google account, at $0.
 *
 * Why this exists: the Gemini API key gets `limit: 0` on every image model until billing is
 * turned on, and generation is never paid for (Abdout, 2026-10-07). Antigravity's CLI (`agy`,
 * kun's `a` lane) carries a built-in `generate_image` tool that reaches Nano Banana on the
 * signed-in Google account. So Claude runs the packs he used to paste into the Gemini app.
 *
 * Usage:
 *   node scripts/agy-image.mjs <pack-dir> [--only 01,08] [--note "<follow-up>"] [--force] [--dry-run]
 *   node scripts/agy-image.mjs --prompt "..." [--ref a.jpg]... [--ratio 16:9] --out file.jpg
 *   (either form: [--model gemini-3.8-flash-low], the agent model that places the one tool call)
 *
 * <pack-dir>/pack.json:
 *   { "title": "...", "followUps": ["..."],
 *     "jobs": [{ "id": "01", "title": "...", "attach": ["01-x.jpg", "A.jpg"],
 *                "prompt": "...", "ratio": "16:9", "save": "01-after.jpg" }] }
 * Jobs run in order, one at a time, so a later job can attach an earlier job's `save`. A job
 * whose `save` exists is skipped unless --force, or --only names it. --note is appended to the
 * prompt (a follow-up from the pack, for a retry).
 *
 * Limits: at most 3 images per job (the tool's own limit); the image comes back at the tool's
 * size (Nano Banana's 1K class). Local only: it drives a personal seat, so it is never called
 * from a server or a public endpoint.
 *
 * Prints one JSON line per job and appends it to <pack-dir>/runs.jsonl. Exit 0 = every job ok,
 * drift or skipped · 1 = a job failed · 2 = the account or the quota stopped the run (sign-in,
 * verification, quota): never retried.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { home, loadPack as load, log, plan, print, saveAs } from './lib/media-pack.mjs';

const BRAIN = path.join(os.homedir(), '.gemini', 'antigravity-cli', 'brain');
const MODEL = process.env.KUN_AGY_MODEL || 'gemini-3.8-flash-low';
const MAX_REFS = 3;
const IMAGE = /\.(jpe?g|png|webp)$/i;
// an account or quota problem: stop the whole run and say so, never loop on it
const FATAL =
  /verify your account|not eligible|eligibility|PERMISSION_DENIED|RESOURCE_EXHAUSTED|quota|rate limit|\b429\b|unauthenticated|not signed in|sign in again|login required/i;


function parseArgs(argv) {
  const a = { refs: [], only: null, note: '', force: false, dry: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${k} needs a value`);
      return v;
    };
    if (k === '--only') a.only = value().split(',').map((s) => s.trim());
    else if (k === '--note') a.note = value();
    else if (k === '--force') a.force = true;
    else if (k === '--dry-run') a.dry = true;
    else if (k === '--prompt') a.prompt = value();
    else if (k === '--ref') a.refs.push(value());
    else if (k === '--ratio') a.ratio = value();
    else if (k === '--out') a.out = value();
    else if (k === '--model') a.model = value();
    else if (!k.startsWith('--') && !a.dir) a.dir = k;
    else throw new Error(`unknown argument ${k}`);
  }
  return a;
}

const loadPack = (dir) => load(dir, { maxRefs: MAX_REFS });

// The one instruction agy gets: place a single generate_image call with our words, unchanged.
function wrapper({ prompt, paths, ratio, name }) {
  const lines = [
    'Call the generate_image tool exactly once, with these arguments:',
    '- Prompt: everything between the lines <<<PROMPT and PROMPT>>> below, copied exactly, character for ' +
      'character. Do not rewrite, shorten, translate, reorder or add to it.',
  ];
  if (paths.length) {
    lines.push(
      `- ImagePaths: ${JSON.stringify(paths)} (keep this order: the first is image 1, the second image 2, ` +
        'the third image 3)',
    );
  }
  if (ratio) lines.push(`- AspectRatio: "${ratio}"`);
  lines.push(`- ImageName: "${name}"`);
  lines.push(
    '',
    'Use no other tool: do not read, list, open, write, copy or move any file, and run no command. When ' +
      'generate_image returns, reply with the single word DONE. If it fails, reply with FAILED and its error text.',
    '',
    '<<<PROMPT',
    prompt,
    'PROMPT>>>',
  );
  return lines.join('\n');
}

function runAgy(text, cwd, dirs, model) {
  const args = ['-p', text, '--dangerously-skip-permissions', '--output-format', 'json', '--model', model];
  args.push('--print-timeout', '10m');
  for (const d of new Set(dirs)) args.push('--add-dir', d);
  const r = spawnSync('agy', args, { cwd, encoding: 'utf8', timeout: 12 * 60 * 1000, maxBuffer: 64 << 20 });
  if (r.error) return { status: 'ERROR', error: r.error.message };
  const out = (r.stdout || '').trim();
  try {
    return JSON.parse(out.slice(out.indexOf('{')));
  } catch {
    return { status: 'ERROR', error: (r.stderr || out || `agy exited ${r.status}`).trim().slice(0, 2000) };
  }
}

// The tool saves into the conversation's folder as <ImageName>_<ms>.<ext>; fall back to any image
// written anywhere in brain/ since the run began.
function findImage(conv, name, since) {
  const own = conv && fs.existsSync(path.join(BRAIN, conv));
  const dirs = own ? [path.join(BRAIN, conv)] : fs.readdirSync(BRAIN).map((d) => path.join(BRAIN, d));
  const hits = [];
  for (const d of dirs) {
    let files;
    try {
      files = fs.readdirSync(d);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!IMAGE.test(f)) continue;
      const p = path.join(d, f);
      const t = fs.statSync(p).mtimeMs;
      if (t >= since) hits.push({ p, named: f.startsWith(name) ? 1 : 0, t });
    }
  }
  hits.sort((a, b) => b.named - a.named || b.t - a.t);
  return hits[0]?.p ?? null;
}

// Did agy pass our words and our images, unchanged? The transcript keeps each argument as a
// JSON literal inside a string.
const unquote = (v) => {
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
};
const squash = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

function checkCall(conv, want) {
  const file = conv && path.join(BRAIN, conv, '.system_generated', 'logs', 'transcript.jsonl');
  if (!file || !fs.existsSync(file)) return { verified: null, why: 'no transcript to check' };
  const calls = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.includes('generate_image')) continue;
    try {
      for (const c of JSON.parse(line).tool_calls ?? []) if (c.name === 'generate_image') calls.push(c.args ?? {});
    } catch {
      /* a partial line */
    }
  }
  if (!calls.length) return { verified: false, why: 'no generate_image call in the transcript' };
  const args = calls.at(-1);
  const paths = unquote(args.ImagePaths) ?? [];
  const samePrompt = squash(unquote(args.Prompt)) === squash(want.prompt);
  const samePaths = JSON.stringify((Array.isArray(paths) ? paths : [paths]).map(String)) === JSON.stringify(want.paths);
  const why = !samePrompt ? 'the prompt was rewritten' : !samePaths ? `ImagePaths were ${JSON.stringify(paths)}` : undefined;
  return { verified: samePrompt && samePaths, calls: calls.length, why };
}

function render(job, { dir, note, model }) {
  const paths = job.attach.map((f) => path.resolve(dir, home(f)));
  const missing = paths.filter((p) => !fs.existsSync(p));
  if (missing.length) {
    return { id: job.id, status: 'failed', error: `missing ${missing.map((p) => path.basename(p)).join(', ')}` };
  }
  const prompt = note ? `${job.prompt} ${note}` : job.prompt;
  const name = `pack_${job.id.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`.slice(0, 40);
  const dest = path.resolve(dir, home(job.save));
  let last;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const since = Date.now() - 1000;
    const res = runAgy(wrapper({ prompt, paths, ratio: job.ratio, name }), dir, [dir, ...paths.map(path.dirname)], model);
    const seconds = Math.round((Date.now() - since) / 1000);
    const conversation = res.conversation_id || null;
    const said = String(res.error || res.response || '').trim();
    if (res.status === 'ERROR' || res.error) {
      if (FATAL.test(said)) return { id: job.id, status: 'stopped', error: said, conversation, fatal: true };
      last = { id: job.id, status: 'failed', error: said || 'agy failed', conversation, seconds, attempt };
      continue;
    }
    const img = findImage(conversation, name, since);
    if (!img) {
      if (FATAL.test(said)) return { id: job.id, status: 'stopped', error: said, conversation, fatal: true };
      last = { id: job.id, status: 'failed', error: `no image came back; agy said: ${said.slice(0, 400)}`, conversation, seconds, attempt };
      continue;
    }
    const check = checkCall(conversation, { prompt, paths });
    const size = saveAs(img, dest);
    last = {
      id: job.id,
      status: check.verified === false ? 'drift' : 'ok',
      file: dest,
      ...size,
      seconds,
      attempt,
      verified: check.verified,
      ...(check.why ? { why: check.why } : {}),
      conversation,
      source: img,
    };
    if (check.verified !== false) break; // drift: one more try with the same words
  }
  return last;
}

// ------------------------------------------------------------------------------------------------
let a;
try {
  a = parseArgs(process.argv.slice(2));
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
const model = a.model || MODEL;

if (a.prompt) {
  if (!a.out) throw new Error('--out is required with --prompt');
  if (a.refs.length > MAX_REFS) throw new Error(`at most ${MAX_REFS} --ref images`);
  const out = path.resolve(home(a.out));
  const job = {
    id: path.basename(out).replace(/\.[^.]+$/, ''),
    attach: a.refs.map((r) => path.resolve(home(r))),
    prompt: a.prompt,
    ratio: a.ratio,
    save: out,
  };
  const r = render(job, { dir: path.dirname(out), note: a.note, model });
  print(r);
  process.exit(r.fatal ? 2 : r.status === 'failed' ? 1 : 0);
}

if (!a.dir) {
  console.error('usage: node scripts/agy-image.mjs <pack-dir> [--only 01,08] [--note "..."] [--force] [--dry-run]');
  console.error('       node scripts/agy-image.mjs --prompt "..." [--ref a.jpg]... [--ratio 16:9] --out file.jpg');
  process.exit(1);
}

const dir = path.resolve(home(a.dir));
const pack = loadPack(dir);
const jobs = pack.jobs.filter((j) => !a.only || a.only.includes(j.id));
if (!jobs.length) throw new Error(`no job matches --only ${a.only}`);

if (a.dry) {
  const { rows, missing } = plan(dir, pack, a.only);
  rows.forEach(print);
  process.exit(missing ? 1 : 0);
}

let code = 0;
for (const j of jobs) {
  const dest = path.resolve(dir, home(j.save));
  if (fs.existsSync(dest) && !a.force && !a.only) {
    print({ id: j.id, status: 'skipped', file: dest });
    continue;
  }
  const r = render(j, { dir, note: a.note, model });
  print(r);
  log(dir, r);
  if (r.fatal) {
    code = 2;
    break;
  }
  if (r.status === 'failed') code = 1;
}
process.exit(code);
