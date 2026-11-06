/**
 * media-pack — the pack contract shared by the Nano Banana runners (gemini-web.mjs, agy-image.mjs).
 *
 * A pack is one folder: the photos and references, a prompt.txt for a person, and pack.json for a runner:
 *   { "title": "...", "followUps": ["..."],
 *     "jobs": [{ "id": "01", "title": "...", "attach": ["01-x.jpg", "A.jpg"],
 *                "prompt": "...", "ratio": "16:9", "save": "01-after.jpg" }] }
 * Jobs run in order, so a later job may attach an earlier job's `save`.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';

export const home = (p) => (p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p);
export const print = (o) => console.log(JSON.stringify(o));

export function loadPack(dir, { maxRefs = Infinity } = {}) {
  const file = path.join(dir, 'pack.json');
  if (!fs.existsSync(file)) {
    throw new Error(`no pack.json in ${dir}: write one from its prompt.txt first (/higgs references/pack.md)`);
  }
  const pack = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(pack.jobs) || !pack.jobs.length) throw new Error('pack.json has no jobs');
  for (const j of pack.jobs) {
    for (const k of ['id', 'prompt', 'save']) if (!j[k]) throw new Error(`job ${j.id ?? '?'} lacks "${k}"`);
    j.id = String(j.id);
    j.attach ??= [];
    if (j.attach.length > maxRefs) {
      throw new Error(`job ${j.id} attaches ${j.attach.length} images; this renderer takes ${maxRefs} at most`);
    }
  }
  return pack;
}

// What a dry run shows: each job's files, and whether each is there or made by an earlier job.
export function plan(dir, pack, only) {
  const made = new Set();
  const rows = [];
  let missing = false;
  for (const j of pack.jobs) {
    const attach = j.attach.map((f) => {
      if (fs.existsSync(path.resolve(dir, home(f)))) return f;
      if (made.has(f)) return `${f} (made by an earlier job)`;
      missing = true;
      return `${f} (MISSING)`;
    });
    made.add(j.save);
    if (only && !only.includes(j.id)) continue;
    const done = fs.existsSync(path.resolve(dir, home(j.save)));
    rows.push({ id: j.id, title: j.title, attach, ratio: j.ratio, save: j.save, done, words: j.prompt.split(/\s+/).length });
  }
  return { rows, missing };
}

// Copy or convert a result into place (JPEG unless the name says PNG) and read its size.
export function saveAs(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const ext = (p) => path.extname(p).toLowerCase().replace('jpeg', 'jpg');
  if (ext(src) === ext(dest)) fs.copyFileSync(src, dest);
  else {
    const format = ext(dest) === '.png' ? 'png' : 'jpeg';
    execFileSync('sips', ['-s', 'format', format, '-s', 'formatOptions', '92', src, '--out', dest], { stdio: 'ignore' });
  }
  const o = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', dest], { encoding: 'utf8' });
  return { width: Number(o.match(/pixelWidth: (\d+)/)?.[1]), height: Number(o.match(/pixelHeight: (\d+)/)?.[1]) };
}

export function log(dir, r) {
  fs.appendFileSync(path.join(dir, 'runs.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...r }) + '\n');
}

// The last run of a job that left a chat behind (gemini-web), for a follow-up in the same chat.
export function lastChat(dir, id) {
  const file = path.join(dir, 'runs.jsonl');
  if (!fs.existsSync(file)) return null;
  const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  return rows.filter((r) => r.id === id && r.chat).at(-1)?.chat ?? null;
}
