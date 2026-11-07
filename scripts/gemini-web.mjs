#!/usr/bin/env node

/**
 * gemini-web — run a Nano Banana pack in the Gemini app, in the session-vault Chrome, on Abdout's own plan, at $0.
 *
 * Why this exists: the Gemini API key gets `limit: 0` on every image model until billing is on, and generation is
 * never paid for (Abdout, 2026-10-07). Antigravity's image tool (agy-image.mjs) waits on an account check. The
 * Gemini app itself works: the session-vault Chrome (~/.claude/bin/chrome-debug.sh, CDP on :9222) is signed in to
 * the Google plan that has Nano Banana. This drives that app the way he does by hand: attach the files in order,
 * choose Create image and the shape, paste the prompt, send, and save the full-size result (2K, 2752 x 1536 at
 * 16:9). Claude then checks each result by eye (/higgs pack mode).
 *
 * Usage:
 *   node scripts/gemini-web.mjs <pack-dir> [--only 06,07] [--force] [--dry-run]
 *   node scripts/gemini-web.mjs <pack-dir> --fix 02 --note "<what to change>"
 *     (--fix sends the note as a follow-up in that job's last chat and saves the new image over its result)
 *   node scripts/gemini-web.mjs <pack-dir> --fetch 06 [--chat <url>]
 *     (--fetch saves the newest image already in that job's chat, without making a new one)
 *
 * <pack-dir>/pack.json is the contract in lib/media-pack.mjs. One JSON line per job, appended to runs.jsonl with
 * the chat's address. Exit 0 = every job ok or skipped · 1 = a job failed · 2 = stopped: the plan's image limit
 * (the line says when it resets) or no signed-in vault Chrome.
 *
 * Local only: it drives a personal seat at a person's pace, one picture at a time; never behind a server.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { chromium } from 'playwright-core';
import { home, loadPack, log, lastChat, plan, print, saveAs } from './lib/media-pack.mjs';

const CDP = process.env.KUN_VAULT_CDP || 'http://127.0.0.1:9222';
const APP = 'https://gemini.google.com/app';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const a = { only: null, note: '', fix: null, fetch: null, chat: null, force: false, dry: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${k} needs a value`);
      return v;
    };
    if (k === '--only') a.only = value().split(',').map((s) => s.trim());
    else if (k === '--fix') a.fix = value();
    else if (k === '--fetch') a.fetch = value();
    else if (k === '--chat') a.chat = value();
    else if (k === '--note') a.note = value();
    else if (k === '--force') a.force = true;
    else if (k === '--dry-run') a.dry = true;
    else if (!k.startsWith('--') && !a.dir) a.dir = k;
    else throw new Error(`unknown argument ${k}`);
  }
  return a;
}

class Stop extends Error {} // the account or the plan says no: end the whole run

async function limitReached(page) {
  const text = await page.locator('body').innerText().catch(() => '');
  const m = text.match(/Limit reached[^\n]*/);
  if (m) throw new Stop(m[0].trim());
}

// Open the "Upload & tools" menu; it closes itself after each choice.
// (the phone layout has the same choices as tiles, "Files" for "Upload files")
async function menu(page) {
  await page.getByRole('button', { name: 'Upload & tools' }).click();
  await page.getByRole('menu', { name: 'Menu options' }).or(page.getByRole('button', { name: /^Files$/ })).first().waitFor({ timeout: 10000 });
}
const uploadItem = (page) => page.getByRole('menuitem', { name: /^Upload files/ }).or(page.getByRole('button', { name: /^Files$/ })).first();

async function attach(page, files) {
  for (const [i, file] of files.entries()) {
    let chooser;
    for (let tries = 1; !chooser; tries++) {
      // the picker sometimes fails to open on the first click; close the menu and try once more
      try {
        await menu(page);
        [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 15000 }), uploadItem(page).click()]);
      } catch (e) {
        if (tries >= 2) throw e;
        await page.keyboard.press('Escape');
        await wait(1500);
      }
    }
    await chooser.setFiles(file);
    // wait until this file has its chip and no image is still loading
    for (let t = 0; t < 120; t++) {
      const chips = await page.getByRole('button', { name: 'close attachment' }).count();
      const loading = await page.getByRole('progressbar', { name: 'Loading image' }).count();
      if (chips >= i + 1 && loading === 0) break;
      await wait(500);
    }
  }
}

async function imageMode(page, ratio) {
  const on = page.getByRole('button', { name: 'Deselect Images' });
  for (let tries = 0; tries < 2 && !(await on.count()); tries++) {
    await menu(page);
    const item = page.getByRole('menuitemcheckbox', { name: /Create image/ });
    if (await item.isDisabled()) {
      await page.keyboard.press('Escape');
      await limitReached(page);
      throw new Stop('Create image is switched off for this account right now');
    }
    await item.click();
    await on.waitFor({ timeout: 5000 }).catch(() => {});
  }
  // without the image tool Gemini answers in words (it wrote a prompt for picture 08 once)
  if (!(await on.count())) throw new Error('could not switch on Create image');
  if (ratio) {
    const shape = page.getByRole('button', { name: /^Aspect ratio/ });
    await shape.waitFor({ timeout: 10000 });
    if (!(await shape.getAttribute('aria-label'))?.includes(ratio)) {
      await shape.click();
      await page.getByRole('menuitemradio', { name: ratio, exact: true }).click();
    }
  }
}

const downloadButtons = (page) => page.getByRole('button', { name: 'Download full size image' });

// Send, then wait for one more finished image than before.
async function sendAndWait(page, text, before) {
  const box = page.getByRole('textbox', { name: 'Enter a prompt for Gemini' });
  await box.fill(text);
  await box.press('Enter');
  const t0 = Date.now();
  while (Date.now() - t0 < 6 * 60 * 1000) {
    await wait(2000);
    const stop = await page.getByRole('button', { name: 'Stop response' }).count();
    const n = await downloadButtons(page).count();
    if (!stop && n > before && (await downloadButtons(page).last().isEnabled())) {
      await wait(3000); // the full-size file settles a moment after the button wakes
      return Math.round((Date.now() - t0) / 1000);
    }
    if (!stop && Date.now() - t0 > 30000 && n <= before) {
      await limitReached(page);
      const said = (await page.locator('message-content').last().innerText().catch(() => '')).trim();
      if (said) throw new Error(`no image came back; Gemini said: ${said.slice(0, 300)}`);
    }
  }
  throw new Error('no image after 6 minutes');
}

// Save the newest image's full-size download as the job's result. Over CDP, Playwright takes the browser's
// downloads into its own folder, so the file comes from the download event, not from ~/Downloads.
async function download(page, dest) {
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 90000 }),
    downloadButtons(page).last().click(),
  ]);
  const tmp = path.join(os.tmpdir(), `gemini-web-${Date.now()}-${dl.suggestedFilename() || 'image.jpg'}`);
  await dl.saveAs(tmp);
  const size = saveAs(tmp, dest);
  fs.rmSync(tmp, { force: true });
  return size;
}

async function open(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByRole('textbox', { name: 'Enter a prompt for Gemini' }).waitFor({ timeout: 30000 });
}

async function run(page, job, dir) {
  const t0 = Date.now();
  const files = job.attach.map((f) => path.resolve(dir, home(f)));
  const missing = files.filter((f) => !fs.existsSync(f));
  if (missing.length) return { id: job.id, status: 'failed', error: `missing ${missing.map((f) => path.basename(f)).join(', ')}` };
  const dest = path.resolve(dir, home(job.save));
  let last;
  for (let attempt = 1; attempt <= 2; attempt++) {
    await open(page, APP);
    await limitReached(page);
    await attach(page, files);
    await imageMode(page, job.ratio);
    try {
      const seconds = await sendAndWait(page, job.prompt, 0);
      const size = await download(page, dest);
      return { id: job.id, status: 'ok', file: dest, ...size, seconds, total: Math.round((Date.now() - t0) / 1000), attempt, chat: page.url() };
    } catch (e) {
      if (e instanceof Stop) throw e;
      // keep the chat: the image may be there even when its download failed (--fetch)
      last = { id: job.id, status: 'failed', error: e.message.split('\n')[0], attempt, chat: page.url() };
      if (!/^no image came back/.test(e.message)) break; // a words-only answer gets one fresh try
    }
  }
  return last;
}

async function fix(page, job, dir, note, chat) {
  if (!chat) return { id: job.id, status: 'failed', error: 'no chat recorded for this job in runs.jsonl (pass --chat <url>)' };
  await open(page, chat);
  await limitReached(page);
  await downloadButtons(page).first().waitFor({ timeout: 30000 });
  const before = await downloadButtons(page).count();
  const seconds = await sendAndWait(page, note, before);
  const size = await download(page, path.resolve(dir, home(job.save)));
  return { id: job.id, status: 'ok', fixed: note, file: path.resolve(dir, home(job.save)), ...size, seconds, chat: page.url() };
}

async function fetchLast(page, job, dir, chat) {
  if (!chat) return { id: job.id, status: 'failed', error: 'no chat recorded for this job in runs.jsonl (pass --chat <url>)' };
  await open(page, chat);
  await downloadButtons(page).first().waitFor({ timeout: 30000 });
  const asked = await page.locator('body').innerText();
  const size = await download(page, path.resolve(dir, home(job.save)));
  // the chat's own prompt should be this job's; say so if it is not
  const mine = asked.includes(job.prompt.slice(0, 160)) || asked.includes(job.prompt.split('. ').slice(-6).join('. ').slice(0, 120));
  return { id: job.id, status: 'ok', fetched: true, promptMatches: mine, file: path.resolve(dir, home(job.save)), ...size, chat: page.url() };
}

// ------------------------------------------------------------------------------------------------
let a;
try {
  a = parseArgs(process.argv.slice(2));
  if (!a.dir) throw new Error('usage: node scripts/gemini-web.mjs <pack-dir> [--only 01,02] [--fix 02 --note "..."] [--fetch 06 [--chat <url>]] [--force] [--dry-run]');
  if (a.fix && !a.note) throw new Error('--fix needs --note "<what to change>"');
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
const dir = path.resolve(home(a.dir));
const pack = loadPack(dir);

if (a.dry) {
  const { rows, missing } = plan(dir, pack, a.only);
  rows.forEach(print);
  process.exit(missing ? 1 : 0);
}

let browser;
try {
  browser = await chromium.connectOverCDP(CDP, { timeout: 10000 });
} catch {
  print({ status: 'stopped', error: `no vault Chrome on ${CDP}: run bash ~/.claude/bin/chrome-debug.sh` });
  process.exit(2);
}
const page = await browser.contexts()[0].newPage();
// a new tab over CDP can open at phone width, and Gemini then serves its phone layout
await page.setViewportSize({ width: 1440, height: 900 });
let code = 0;
try {
  if (a.fix || a.fetch) {
    const id = a.fix || a.fetch;
    const job = pack.jobs.find((j) => j.id === id);
    if (!job) throw new Error(`no job ${id}`);
    const chat = a.chat || lastChat(dir, id);
    const r = a.fix ? await fix(page, job, dir, a.note, chat) : await fetchLast(page, job, dir, chat);
    print(r);
    log(dir, r);
    if (r.status === 'failed') code = 1;
  } else {
    for (const job of pack.jobs.filter((j) => !a.only || a.only.includes(j.id))) {
      const dest = path.resolve(dir, home(job.save));
      if (fs.existsSync(dest) && !a.force && !a.only) {
        print({ id: job.id, status: 'skipped', file: dest });
        continue;
      }
      let r;
      try {
        r = await run(page, job, dir);
      } catch (e) {
        if (e instanceof Stop) throw e;
        r = { id: job.id, status: 'failed', error: e.message.split('\n')[0] };
      }
      print(r);
      log(dir, r);
      if (r.status === 'failed') code = 1;
    }
  }
} catch (e) {
  const r = { status: 'stopped', error: e.message.split('\n')[0] };
  print(r);
  log(dir, r);
  code = e instanceof Stop ? 2 : 1;
} finally {
  await page.close().catch(() => {});
}
process.exit(code); // leaves the vault Chrome and its other tabs as they were
