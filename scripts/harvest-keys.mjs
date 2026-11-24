#!/usr/bin/env node
// harvest-keys.mjs — see which provider sign-in pages are already logged in, in the session
// vault Chrome (:9222), on hidden pages (quietPage: no tab, no focus). Read-only: it opens each
// providers.json `signup` URL and reports where it landed, so a person (or /behalf) knows which
// keys need a sign-in first. It never creates or reads a key.
//
//   node scripts/harvest-keys.mjs [providerId…]
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright-core';
import { quietPage } from './lib/vault-page.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { providers } = JSON.parse(readFileSync(path.join(root, '.claude/machine/providers.json'), 'utf8'));
const want = process.argv.slice(2);
const rows = providers.filter((p) => p.signup && p.keychain && p.tier !== 'paid' && (!want.length || want.includes(p.id)));

const browser = await chromium.connectOverCDP(process.env.KUN_CDP || 'http://127.0.0.1:9222', { timeout: 60000 });
const out = [];
for (const p of rows) {
  const page = await quietPage(browser);
  try {
    await page.goto(p.signup, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);
    const url = page.url();
    const text = (await page.evaluate(() => document.body?.innerText || '')).slice(0, 400);
    const signin = /sign[ -]?in|log[ -]?in|sign up|create account|continue with google/i.test(text) || /login|signin|auth|accounts\.google/i.test(url);
    out.push({ id: p.id, url: url.slice(0, 120), state: signin ? 'needs-sign-in' : 'signed-in?', head: text.replace(/\s+/g, ' ').slice(0, 140) });
  } catch (e) {
    out.push({ id: p.id, state: 'error', error: String(e.message || e).slice(0, 120) });
  } finally {
    await page.close().catch(() => {});
  }
}
await browser.close().catch(() => {});
console.log(JSON.stringify(out, null, 2));
