#!/usr/bin/env node

/**
 * Higgs Asset Library — generate once, reuse forever.
 *
 * Every paid Higgsfield job is fingerprinted by (prompt, model, ratio, resolution).
 * Before spending credits, `lookup` answers "do we already own this shot?". After
 * spending, `add` records it. `push` mirrors the file to cdn.databayt.org so the
 * asset outlives ~/Downloads and is reachable from any machine.
 *
 * Usage:
 *   node scripts/higgs-library.mjs lookup --prompt "..." [--model M] [--ratio 16:9] [--resolution 2k]
 *   node scripts/higgs-library.mjs add <file> --prompt "..." --model M [--brand b] [--ratio r] [--credits n] [--type t] [--source s]
 *     --type: canonical asset type (hero|og|banner|logo|product|lifestyle|mockup|
 *     infographic|split|testimonial|carousel|reel|story — see
 *     src/components/root/social/showroom/taxonomy.ts); the showroom filters by it.
 *     --source: which renderer made it (higgsfield|chatgpt|template). Defaults to
 *     higgsfield; the showroom badges it.
 *   node scripts/higgs-library.mjs import [--dir ~/Downloads/higgs] [--source s]
 *   node scripts/higgs-library.mjs push [--dry-run]
 *   node scripts/higgs-library.mjs list [--brand b]
 *   node scripts/higgs-library.mjs stats
 *
 * Every command prints JSON on the last line so callers can parse it.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const manifestPath = path.join(rootDir, 'content', 'media', 'library.json');
const defaultInbox = path.join(os.homedir(), 'Downloads', 'higgs');

const BUCKET = 'hogwarts-databayt';
const PREFIX = 'media';

// cdn.databayt.org (CloudFront E3PHDXTDSBCQSJ) currently 403s on EVERY key in this
// bucket, including objects that predate this library — so we serve from the S3
// origin, which is public and verified. Uploads are unaffected: when the
// distribution is fixed, `push --base https://cdn.databayt.org` re-links every URL
// in place. No re-upload needed.
const CDN_BASE = `https://${BUCKET}.s3.amazonaws.com`;

// Filename prefixes we've used in ~/Downloads/higgs, mapped to their brand.
const BRAND_HINTS = { mkan: 'mkan', db: 'databayt', hw: 'hogwarts', ml: 'moallimee', sj: 'sijillee' };

const CONTENT_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.gif': 'image/gif',
};

// ── manifest ────────────────────────────────────────────────────────────────

function emptyManifest() {
  return { version: 1, cdnBase: CDN_BASE, bucket: BUCKET, prefix: PREFIX, assets: [] };
}

function loadManifest() {
  if (!fs.existsSync(manifestPath)) return emptyManifest();
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!Array.isArray(parsed.assets)) throw new Error('assets is not an array');
    return { ...emptyManifest(), ...parsed };
  } catch (err) {
    // A corrupt manifest must never be silently replaced with an empty one —
    // that would discard the record of everything we have already paid for.
    throw new Error(`Manifest at ${manifestPath} is unreadable (${err.message}). Fix or delete it deliberately.`);
  }
}

function saveManifest(manifest) {
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  manifest.assets.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.file.localeCompare(b.file));
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

// ── fingerprinting ──────────────────────────────────────────────────────────

/** Normalize a prompt so trivial rewording still hits the same cached asset. */
function normalizePrompt(prompt) {
  return String(prompt)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?"']/g, '')
    .trim();
}

function fingerprint({ prompt, model, ratio, resolution }) {
  if (!prompt || !model) return null;
  const basis = [normalizePrompt(prompt), model, ratio || 'default', resolution || 'default'].join('|');
  return crypto.createHash('sha256').update(basis).digest('hex').slice(0, 16);
}

function fileHash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

// ── args ────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const val = argv[i];
    if (val.startsWith('--')) {
      const key = val.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(val);
    }
  }
  return args;
}

function brandFromFilename(name) {
  // 2026-07-22-hw-classroom.png -> hw -> hogwarts
  const stripped = name.replace(/^\d{4}-\d{2}-\d{2}-/, '');
  const token = stripped.split('-')[0];
  return BRAND_HINTS[token] || null;
}

function dateFromFilename(name, fallbackPath) {
  const match = name.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  return fs.statSync(fallbackPath).mtime.toISOString().slice(0, 10);
}

// ── commands ────────────────────────────────────────────────────────────────

function cmdLookup(args) {
  const manifest = loadManifest();
  const fp = fingerprint({
    prompt: args.prompt,
    model: args.model,
    ratio: args.ratio,
    resolution: args.resolution,
  });

  if (!fp) {
    return { hit: false, reason: 'lookup needs both --prompt and --model' };
  }

  const asset = manifest.assets.find((a) => a.fingerprint === fp);
  if (!asset) return { hit: false, fingerprint: fp };

  asset.reuseCount = (asset.reuseCount || 0) + 1;
  asset.lastReusedAt = new Date().toISOString().slice(0, 10);
  saveManifest(manifest);

  const localPath = path.join(defaultInbox, asset.file);
  return {
    hit: true,
    fingerprint: fp,
    file: asset.file,
    localPath: fs.existsSync(localPath) ? localPath : null,
    cdnUrl: asset.cdnUrl || null,
    model: asset.model,
    credits: asset.credits ?? null,
    creditsSaved: asset.credits ?? null,
    reuseCount: asset.reuseCount,
  };
}

function cmdAdd(args) {
  const file = args._[0];
  if (!file) throw new Error('add needs a file path: higgs-library.mjs add <file> --prompt "..." --model M');

  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) throw new Error(`No such file: ${abs}`);

  const manifest = loadManifest();
  const name = path.basename(abs);
  const sha = fileHash(abs);

  const existing = manifest.assets.find((a) => a.sha256 === sha);
  if (existing) {
    // Same bytes already tracked — enrich the record rather than duplicating it.
    if (args.prompt && !existing.prompt) existing.prompt = args.prompt;
    if (args.model && !existing.model) existing.model = args.model;
    if (args.brand && !existing.brand) existing.brand = args.brand;
    if (args.ratio && !existing.ratio) existing.ratio = args.ratio;
    if (args.credits && existing.credits == null) existing.credits = Number(args.credits);
    if (args.type && !existing.assetType) existing.assetType = args.type;
    if (args.source && !existing.source) existing.source = args.source;
    existing.fingerprint = fingerprint(existing) || existing.fingerprint;
    saveManifest(manifest);
    return { ok: true, deduped: true, id: existing.id, file: existing.file };
  }

  const asset = {
    id: sha.slice(0, 12),
    file: name,
    sha256: sha,
    brand: args.brand || brandFromFilename(name),
    prompt: args.prompt || null,
    model: args.model || null,
    ratio: args.ratio || null,
    resolution: args.resolution || null,
    credits: args.credits != null ? Number(args.credits) : null,
    assetType: args.type || null,
    // Which renderer made it. Defaults to higgsfield because that is what every
    // row predating this field came from — the showroom reads the same default,
    // so untagged history keeps its correct badge while a ChatGPT-seat render
    // (--source chatgpt) no longer inherits a Higgsfield credit it never spent.
    source: args.source || 'higgsfield',
    bytes: fs.statSync(abs).size,
    createdAt: dateFromFilename(name, abs),
    cdnUrl: null,
    reuseCount: 0,
  };
  asset.fingerprint = fingerprint(asset);

  manifest.assets.push(asset);
  saveManifest(manifest);
  return { ok: true, deduped: false, id: asset.id, file: asset.file, fingerprint: asset.fingerprint };
}

function cmdImport(args) {
  const dir = args.dir ? path.resolve(String(args.dir).replace(/^~/, os.homedir())) : defaultInbox;
  if (!fs.existsSync(dir)) return { ok: false, reason: `No such directory: ${dir}` };

  const manifest = loadManifest();
  const known = new Set(manifest.assets.map((a) => a.sha256));
  const added = [];
  let skipped = 0;

  for (const name of fs.readdirSync(dir).sort()) {
    const abs = path.join(dir, name);
    if (!fs.statSync(abs).isFile()) continue;
    if (!CONTENT_TYPES[path.extname(name).toLowerCase()]) continue;

    const sha = fileHash(abs);
    if (known.has(sha)) {
      skipped += 1;
      continue;
    }
    known.add(sha);

    // Imported files carry no prompt — we never invent one, so they stay in the
    // inventory (and get a CDN URL) but are deliberately not reuse-matchable.
    manifest.assets.push({
      id: sha.slice(0, 12),
      file: name,
      sha256: sha,
      brand: brandFromFilename(name),
      prompt: null,
      model: null,
      ratio: null,
      resolution: null,
      credits: null,
      source: args.source || 'higgsfield',
      bytes: fs.statSync(abs).size,
      createdAt: dateFromFilename(name, abs),
      cdnUrl: null,
      fingerprint: null,
      reuseCount: 0,
    });
    added.push(name);
  }

  saveManifest(manifest);
  return { ok: true, dir, added: added.length, skipped, total: manifest.assets.length };
}

function cmdPush(args) {
  const manifest = loadManifest();
  const dryRun = Boolean(args['dry-run']);
  const pushed = [];
  const missing = [];
  let relinked = 0;

  // --base swaps the serving origin (e.g. back to CloudFront once it is fixed).
  // Keys are immutable, so this is a pure re-link — nothing is re-uploaded.
  if (args.base) manifest.cdnBase = String(args.base).replace(/\/$/, '');

  for (const asset of manifest.assets) {
    if (asset.key) {
      // Already uploaded — just make sure its URL matches the current origin.
      const url = `${manifest.cdnBase}/${asset.key}`;
      if (asset.cdnUrl !== url) {
        asset.cdnUrl = url;
        relinked += 1;
      }
      continue;
    }

    const abs = path.join(defaultInbox, asset.file);
    if (!fs.existsSync(abs)) {
      missing.push(asset.file);
      continue;
    }

    const ext = path.extname(asset.file).toLowerCase();
    const key = `${PREFIX}/${asset.brand || 'unsorted'}/${asset.id}-${asset.file}`;
    const url = `${manifest.cdnBase}/${key}`;

    if (dryRun) {
      pushed.push({ file: asset.file, key, url, dryRun: true });
      continue;
    }

    // Content-addressed key -> the object is immutable, so cache it hard.
    execFileSync('aws', [
      's3', 'cp', abs, `s3://${BUCKET}/${key}`,
      '--content-type', CONTENT_TYPES[ext] || 'application/octet-stream',
      '--cache-control', 'public, max-age=31536000, immutable',
      '--only-show-errors',
    ], { stdio: ['ignore', 'pipe', 'inherit'] });

    asset.key = key;
    asset.cdnUrl = url;
    pushed.push({ file: asset.file, key, url });
  }

  if (!dryRun) saveManifest(manifest);
  return { ok: true, pushed: pushed.length, relinked, missing: missing.length, missingFiles: missing, base: manifest.cdnBase, assets: pushed, dryRun };
}

function cmdList(args) {
  const manifest = loadManifest();
  const assets = args.brand ? manifest.assets.filter((a) => a.brand === args.brand) : manifest.assets;
  for (const a of assets) {
    const size = `${(a.bytes / 1024 / 1024).toFixed(1)}MB`;
    const cdn = a.cdnUrl ? 'cdn' : '   ';
    const reuse = a.reuseCount ? `×${a.reuseCount}` : '  ';
    console.log(`${a.createdAt}  ${cdn} ${reuse}  ${(a.brand || 'unsorted').padEnd(10)} ${(a.model || '—').padEnd(18)} ${size.padStart(7)}  ${a.file}`);
  }
  return { ok: true, count: assets.length };
}

function cmdStats() {
  const manifest = loadManifest();
  const assets = manifest.assets;
  const spent = assets.reduce((sum, a) => sum + (a.credits || 0), 0);
  const reuses = assets.reduce((sum, a) => sum + (a.reuseCount || 0), 0);
  const saved = assets.reduce((sum, a) => sum + (a.credits || 0) * (a.reuseCount || 0), 0);
  const bytes = assets.reduce((sum, a) => sum + (a.bytes || 0), 0);
  const onCdn = assets.filter((a) => a.cdnUrl).length;
  const matchable = assets.filter((a) => a.fingerprint).length;

  const byBrand = {};
  for (const a of assets) {
    const b = a.brand || 'unsorted';
    byBrand[b] = (byBrand[b] || 0) + 1;
  }

  console.log(`Assets            ${assets.length}`);
  console.log(`  reuse-matchable ${matchable}  (need prompt + model)`);
  console.log(`  on CDN          ${onCdn}`);
  console.log(`Total size        ${(bytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Credits recorded  ${spent.toFixed(2)}`);
  console.log(`Reuse hits        ${reuses}`);
  console.log(`Credits saved     ${saved.toFixed(2)}`);
  console.log(`By brand          ${Object.entries(byBrand).map(([k, v]) => `${k}:${v}`).join('  ')}`);

  return { ok: true, assets: assets.length, matchable, onCdn, creditsRecorded: spent, reuses, creditsSaved: saved };
}

// ── main ────────────────────────────────────────────────────────────────────

const COMMANDS = { lookup: cmdLookup, add: cmdAdd, import: cmdImport, push: cmdPush, list: cmdList, stats: cmdStats };

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const askedForHelp = !cmd || cmd === '--help' || cmd === '-h';

  if (askedForHelp || !COMMANDS[cmd]) {
    console.log(`Higgs asset library — generate once, reuse forever.

  lookup  --prompt "..." --model M [--ratio r] [--resolution r]   is this shot already paid for?
  add     <file> --prompt "..." --model M [--brand b] [--credits n]
  import  [--dir ~/Downloads/higgs]                               register untracked local assets
  push    [--dry-run]                                             mirror to cdn.databayt.org
  list    [--brand b]
  stats

Manifest: content/media/library.json`);
    // Asking for help is success; an unknown command is not.
    process.exit(askedForHelp ? 0 : 1);
  }

  try {
    const result = COMMANDS[cmd](parseArgs(rest));
    console.log(JSON.stringify(result));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    console.log(JSON.stringify({ ok: false, error: err.message }));
    process.exit(1);
  }
}

main();
