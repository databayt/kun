#!/usr/bin/env node

/**
 * web — web seats: text tasks run on the free daily quota of ChatGPT, DeepSeek, GLM and Gemini,
 * driven in Abdout's own signed-in vault Chrome (CDP :9222), $0.
 *
 * Why: the plan's quota is for judging; a second opinion, a critique or a draft is just text in, text out.
 * The four chat sites each hand a free allowance to a signed-in person. This drives them the way he does by
 * hand, at a person's pace (one ask at a time per seat, a gap between asks, a daily cap). He accepted the
 * ToS risk (2026-11-24). Own data and internal output only — never client data or secrets. Text in, text
 * out: never a coding agent.
 *
 * Usage:
 *   node scripts/web/web.mjs ask <provider|auto> "<prompt>" [--file <path>] [--chat new|last] [--json]
 *   node scripts/web/web.mjs status
 *   node scripts/web/web.mjs transcript <provider> [--chat <url>]
 *
 * Exit: 0 ok · 1 error · 75 = limit hit / needs sign-in / capped today / CAPTCHA (callers fall back).
 *
 * Each seat is a plain browser script in scripts/web/adapters/<id>.js (the desktop app loads the same files);
 * this host owns the polling: after send, wait until !busy() and lastAnswer() holds still for 3 s (180 s cap).
 * The page is a hidden quietPage (never a visible tab, never focus); sign in once with
 *   bash ~/.claude/bin/chrome-debug.sh 9222 <site url>
 *
 * Knobs (engine.json → web): order, gap_s (45, plus 0–15 s jitter), caps (asks per seat per local day).
 * Env: KUN_VAULT_CDP, WEB_STATE_DIR (default ~/.claude/state/web), RUNS_LEDGER, KUN_JOB, WEB_NO_GAP=1 (tests).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright-core';
import { quietPage } from '../lib/vault-page.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KUN = path.resolve(HERE, '../..');
const CDP = process.env.KUN_VAULT_CDP || 'http://127.0.0.1:9222';
const STATE = process.env.WEB_STATE_DIR || path.join(os.homedir(), '.claude/state/web');
const LEDGER = process.env.RUNS_LEDGER || path.join(os.homedir(), '.claude/logs/runs.jsonl');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SEATS = JSON.parse(fs.readFileSync(path.join(HERE, 'adapters/index.json'), 'utf8'));
const seat = (id) => SEATS.find((s) => s.id === id);

let engineWeb = {};
try { engineWeb = JSON.parse(fs.readFileSync(path.join(KUN, '.claude/engine.json'), 'utf8')).web || {}; } catch {}
const ORDER = engineWeb.order || SEATS.map((s) => s.id);
const GAP_S = Number(engineWeb.gap_s ?? 45);
const CAPS = engineWeb.caps || {};

const SETTLE_MS = 3000; // the answer must hold still this long
const ANSWER_TIMEOUT_MS = 180000;

class Park extends Error { // exit 75: the seat says no (or needs a person); callers fall back
  constructor(status, msg) { super(msg); this.status = status; } // status: limit | login
}

const signIn = (s) => `${s.name} needs sign-in once: bash ~/.claude/bin/chrome-debug.sh 9222 ${s.url}`;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// ---- state: ~/.claude/state/web/<id>.json {day, count, last_ok, last_ask, chat_url, limit_note} -------------
function readState(id) {
  let s = {};
  try { s = JSON.parse(fs.readFileSync(path.join(STATE, `${id}.json`), 'utf8')); } catch {}
  if (s.day !== today()) s = { ...s, day: today(), count: 0 };
  return s;
}
function writeState(id, patch) {
  fs.mkdirSync(STATE, { recursive: true });
  const s = { ...readState(id), ...patch };
  fs.writeFileSync(path.join(STATE, `${id}.json`), JSON.stringify(s, null, 1));
  return s;
}
const capLeft = (id) => (CAPS[id] ?? Infinity) - readState(id).count;

// ---- one ask at a time per seat: a pid lock file, waited for ---------------------------------------------
async function takeLock(id) {
  fs.mkdirSync(STATE, { recursive: true });
  const f = path.join(STATE, `${id}.lock`);
  for (let t = 0; t < 600; t++) { // up to 10 minutes
    try { fs.writeFileSync(f, String(process.pid), { flag: 'wx' }); return () => fs.rmSync(f, { force: true }); } catch {}
    try { process.kill(Number(fs.readFileSync(f, 'utf8')), 0); } catch { fs.rmSync(f, { force: true }); continue; } // stale
    await wait(1000);
  }
  throw new Error(`${id}: another ask held the seat for over 10 minutes`);
}

const gapLeftMs = (id) => {
  if (process.env.WEB_NO_GAP) return 0;
  const s = readState(id);
  if (!s.last_ask) return 0;
  return Math.max(0, s.last_ask + (s.gap_ms ?? GAP_S * 1000) - Date.now());
};

// ---- ledger -----------------------------------------------------------------------------------------------
function ledger(row) {
  try {
    fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
    const ts = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    fs.appendFileSync(LEDGER, JSON.stringify({ ts, kind: 'web', job: process.env.KUN_JOB || 'web:ask', ...row }) + '\n');
  } catch {}
}

// ---- browser ----------------------------------------------------------------------------------------------
let browser = null;
let page = null;
async function openPage() {
  if (page) return page;
  try { browser = await chromium.connectOverCDP(CDP, { timeout: 10000 }); }
  catch { throw new Error(`no vault Chrome on ${CDP}: run bash ~/.claude/bin/chrome-debug.sh 9222`); }
  page = await quietPage(browser, { width: 1440, height: 900 }); // hidden: no tab, no focus
  return page;
}
async function closePage() { if (page) await page.close().catch(() => {}); page = null; }

const CHALLENGE = /(verify (that )?you are (a )?human|are you (a )?(human|robot)|captcha|unusual (traffic|activity)|checking your browser|just a moment\.\.\.|security check|press (and|&) hold|security verification|drag the slider|complete the puzzle|verify you are not a robot)/i;

// Load the seat's page and its adapter; resolve once the composer is there.
async function load(s, url, { needReady = true } = {}) {
  const p = await openPage();
  const src = fs.readFileSync(path.join(HERE, `adapters/${s.id}.js`), 'utf8');
  await p.goto(url || s.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const t0 = Date.now();
  let probe = {};
  while (Date.now() - t0 < (needReady ? 30000 : 12000)) {
    await p.evaluate(src).catch(() => {}); // a redirect can reload the page mid-wait: inject again
    probe = await p.evaluate(() => {
      const k = window.__kunWeb;
      if (!k) return {};
      return { ready: k.ready(), login: k.needsLogin(), limit: k.limitHit(), text: document.body ? document.body.innerText.slice(0, 3000) : '' };
    }).catch(() => ({}));
    if (probe.login || probe.limit || (probe.ready && needReady) || (probe.ready && !needReady && Date.now() - t0 > 4000)) break;
    if (probe.text && CHALLENGE.test(probe.text) && !probe.ready) break;
    await wait(700);
  }
  if (probe.ready && !probe.login && !probe.limit) { // the composer renders before the header: give the sign-in link time to show, then look again
    await wait(3000);
    probe = await p.evaluate(() => {
      const k = window.__kunWeb;
      return k ? { ready: k.ready(), login: k.needsLogin(), limit: k.limitHit(), text: document.body.innerText.slice(0, 3000) } : probe;
    }).catch(() => probe);
  }
  const challenge = !probe.ready && probe.text && CHALLENGE.test(probe.text);
  return { ...probe, challenge: !!challenge, url: p.url() };
}

function guard(s, r) { // throws Park for anything that says "not now"
  if (r.challenge) throw new Park('limit', `${s.name} shows a challenge (CAPTCHA): a person must clear it in the vault Chrome (bash ~/.claude/bin/chrome-debug.sh 9222 ${s.url})`);
  if (r.login) throw new Park('login', signIn(s));
  if (r.limit) throw new Park('limit', `${s.name} limit: ${r.limit}`);
  if (!r.ready) throw new Error(`${s.name}: the composer never appeared (page: ${r.url})`);
}

const call = (fn, ...args) => page.evaluate(([f, a]) => window.__kunWeb[f](...a), [fn, args]);

async function askOne(s, prompt, { chat }) {
  const t0 = Date.now();
  const row = { provider: s.id, prompt_chars: prompt.length };
  const release = await takeLock(s.id);
  try {
    if (capLeft(s.id) <= 0) throw new Park('limit', `${s.name} is capped today (${CAPS[s.id]} asks)`);
    const gap = gapLeftMs(s.id);
    if (gap > 0) { process.stderr.write(`web: ${s.id} waits ${Math.ceil(gap / 1000)}s (gap between asks)\n`); await wait(gap); }
    const st = readState(s.id);
    const url = chat === 'last' && st.chat_url ? st.chat_url : s.url;
    const r = await load(s, url);
    guard(s, r);
    // count the ask as it goes out: a hung answer still used the seat; a parked one (login, limit) did not
    writeState(s.id, { last_ask: Date.now(), gap_ms: (GAP_S + Math.random() * 15) * 1000, count: st.count + 1 });
    await wait(1500); // the composer shows before the page has wired its handlers
    const turns0 = (await call('transcript')).length;
    for (let attempt = 1; ; attempt++) { // a send into a page that has not wired its handlers does nothing: look for the turn, retry once
      await call('send', prompt);
      let took = false;
      for (let i = 0; i < 12 && !took; i++) { await wait(700); took = await page.evaluate((n) => window.__kunWeb.busy() || window.__kunWeb.transcript().length > n, turns0); }
      if (took) break;
      if (attempt >= 2) throw new Error(`${s.name}: the prompt did not go out (send had no effect)`);
      await wait(2000);
    }
    let last = '', since = Date.now(), seen = false, polls = 0;
    const start = Date.now();
    for (;;) {
      await wait(1000);
      const k = await page.evaluate(() => ({ busy: window.__kunWeb.busy(), answer: window.__kunWeb.lastAnswer(), limit: window.__kunWeb.limitHit() })).catch(() => null);
      if (!k) continue; // a navigation in flight
      if (!seen && ++polls % 4 === 0) { // a slider / CAPTCHA sits in front of the answer: stop now, not in 180 s
        const t = await page.evaluate(() => document.body.innerText.slice(0, 4000)).catch(() => '');
        if (CHALLENGE.test(t)) throw new Park('limit', `${s.name} shows a challenge (CAPTCHA): a person must clear it in the vault Chrome (bash ~/.claude/bin/chrome-debug.sh 9222 ${s.url})`);
      }
      if (k.answer !== last) { last = k.answer; since = Date.now(); if (k.answer) seen = true; }
      if (!k.busy && seen && Date.now() - since >= SETTLE_MS) break;
      if (!k.busy && !seen && Date.now() - start > 25000) {
        const q = await page.evaluate(() => ({ text: document.body.innerText.slice(0, 3000), limit: window.__kunWeb.limitHit() }));
        if (CHALLENGE.test(q.text)) throw new Park('limit', `${s.name} shows a challenge (CAPTCHA): a person must clear it in the vault Chrome`);
        if (q.limit) throw new Park('limit', `${s.name} limit: ${q.limit}`);
        throw new Error(`${s.name}: no answer after sending`);
      }
      if (Date.now() - start > ANSWER_TIMEOUT_MS) {
        if (last) break; // took the long way but there is text: return it
        throw new Error(`${s.name}: no answer in ${ANSWER_TIMEOUT_MS / 1000}s`);
      }
    }
    const lim = await call('limitHit');
    if (lim && !last) throw new Park('limit', `${s.name} limit: ${lim}`);
    const chatUrl = page.url();
    writeState(s.id, { last_ok: new Date().toISOString(), chat_url: chatUrl, limit_note: null });
    const out = { provider: s.id, chat_url: chatUrl, answer: last };
    ledger({ ...row, status: 'ok', answer_chars: last.length, duration_s: Math.round((Date.now() - t0) / 1000), chat_url: chatUrl });
    return out;
  } catch (e) {
    const status = e instanceof Park ? e.status : 'fail';
    if (e instanceof Park && e.status === 'limit') writeState(s.id, { limit_note: e.message, limit_at: new Date().toISOString() });
    ledger({ ...row, status, answer_chars: 0, duration_s: Math.round((Date.now() - t0) / 1000), chat_url: page ? page.url() : null, error: e.message.split('\n')[0].slice(0, 200) });
    throw e;
  } finally {
    release();
  }
}

// ---- commands ---------------------------------------------------------------------------------------------
async function cmdAsk(a) {
  const target = a._[1];
  // --file alone is the whole prompt; with text as well, the text is the instruction and the file follows it
  const text = a._.slice(2).join(' ').trim();
  const fromFile = a.file ? fs.readFileSync(a.file.replace(/^~/, os.homedir()), 'utf8') : '';
  let prompt = text && fromFile ? `${text}\n\n---\n\n${fromFile}` : text || fromFile;
  if (prompt === '-' ) prompt = fs.readFileSync(0, 'utf8');
  prompt = prompt.trim();
  if (!target || !prompt) throw new Error('usage: web ask <provider|auto> "<prompt>" [--file <path>] [--chat new|last] [--json]');
  const chat = a.chat === 'last' ? 'last' : 'new';
  let ids;
  if (target === 'auto') {
    ids = ORDER.filter((id) => seat(id) && capLeft(id) > 0);
    // a seat still inside its gap goes after the ready ones
    ids = [...ids.filter((id) => gapLeftMs(id) === 0), ...ids.filter((id) => gapLeftMs(id) > 0)];
    if (!ids.length) throw new Park('limit', 'every web seat is capped today');
  } else {
    if (!seat(target)) throw new Error(`unknown provider "${target}" (${SEATS.map((s) => s.id).join(', ')}, auto)`);
    ids = [target];
  }
  const skipped = [];
  for (const id of ids) {
    const s = seat(id);
    try {
      const r = await askOne(s, prompt, { chat });
      process.stdout.write(a.json ? JSON.stringify(r) + '\n' : r.answer + '\n');
      if (target === 'auto') process.stderr.write(`web: answered by ${id}${skipped.length ? ` (skipped: ${skipped.join('; ')})` : ''}\n`);
      return 0;
    } catch (e) {
      if (e instanceof Park && target === 'auto') { skipped.push(`${id}: ${e.message}`); await closePage(); continue; }
      throw e;
    }
  }
  throw new Park('limit', `no web seat available: ${skipped.join('; ')}`);
}

async function cmdStatus() {
  const rows = [];
  for (const s of SEATS) {
    const st = readState(s.id);
    const row = { seat: s.id, logged_in: null, limit: null, count: st.count, cap: CAPS[s.id] ?? null, last_ok: st.last_ok || null };
    try {
      const r = await load(s, s.url, { needReady: false });
      row.logged_in = r.challenge ? null : !r.login;
      row.limit = r.limit || null;
      if (r.challenge) row.note = 'challenge (CAPTCHA)';
      else if (!r.ready && !r.login) row.note = 'composer not found';
    } catch (e) { row.note = e.message.split('\n')[0]; }
    rows.push(row);
    await closePage();
  }
  const mark = (v) => (v === null ? '?' : v ? 'yes' : 'no');
  console.log('seat      logged in  limit hit  today      last ok');
  for (const r of rows) {
    console.log(`${r.seat.padEnd(9)} ${mark(r.logged_in).padEnd(10)} ${(r.limit ? 'yes' : 'no').padEnd(10)} ${`${r.count}/${r.cap ?? '-'}`.padEnd(10)} ${r.last_ok || '-'}${r.limit ? `  [${r.limit}]` : ''}${r.note ? `  (${r.note})` : ''}`);
    if (r.logged_in === false) console.log(`          sign in once: bash ~/.claude/bin/chrome-debug.sh 9222 ${seat(r.seat).url}`);
  }
  return 0;
}

async function cmdTranscript(a) {
  const s = seat(a._[1]);
  if (!s) throw new Error('usage: web transcript <provider> [--chat <url>]');
  const url = a.chat || readState(s.id).chat_url;
  if (!url) throw new Error(`${s.id}: no chat url: pass --chat <url> (none stored from an earlier ask)`);
  const r = await load(s, url);
  guard(s, r);
  await wait(1500);
  const t = await call('transcript');
  console.log(JSON.stringify({ provider: s.id, chat_url: page.url(), transcript: t }, null, 2));
  return 0;
}

function parse(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--json') a.json = true;
    else if (k === '--file' || k === '--chat') { a[k.slice(2)] = argv[++i]; if (a[k.slice(2)] === undefined) throw new Error(`${k} needs a value`); }
    else a._.push(k);
  }
  return a;
}

let code = 0;
try {
  const a = parse(process.argv.slice(2));
  const cmd = a._[0];
  if (cmd === 'ask') code = await cmdAsk(a);
  else if (cmd === 'status') code = await cmdStatus();
  else if (cmd === 'transcript') code = await cmdTranscript(a);
  else throw new Error('usage: web ask <provider|auto> "<prompt>" | web status | web transcript <provider> [--chat <url>]');
} catch (e) {
  console.error(`web: ${e.message}`);
  code = e instanceof Park ? 75 : 1;
} finally {
  await closePage();
}
process.exit(code); // leaves the vault Chrome and its other tabs as they were
