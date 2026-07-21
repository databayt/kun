#!/usr/bin/env node

/**
 * Facebook Post Dispatcher — the headless PRE-APPROVED lane, direct Graph API.
 * Runs from terminal, cron, or Git hooks.
 *
 * Doctrine: this script only relays copy that a human already approved.
 * It does NOT draft — Claude writes the copy (the /social skill).
 *
 * Setup (one-time, Abdout): create the Facebook Page; create a Meta app (dev
 * mode is enough to post to a Page you admin — no App Review); generate a
 * long-lived Page access token; set FACEBOOK_PAGE_ID + FACEBOOK_PAGE_ACCESS_TOKEN.
 * See twenty-deploy/SOCIAL-SETUP.md.
 *
 * Usage:
 *   node scripts/post-to-facebook.mjs --text "Approved copy here"
 *   node scripts/post-to-facebook.mjs --text "..." --link "https://hogwarts.databayt.org"
 *   node scripts/post-to-facebook.mjs --photo ./card.png --text "Caption"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const GRAPH_VERSION = 'v21.0';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function loadEnv() {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      }
    });
  return env;
}

const env = { ...loadEnv(), ...process.env };
const TOKEN = (env.FACEBOOK_PAGE_ACCESS_TOKEN || '').trim();
const PAGE_ID = (env.FACEBOOK_PAGE_ID || '').trim();

const args = {};
process.argv.slice(2).forEach((val, index, arr) => {
  if (val.startsWith('--')) {
    const key = val.slice(2);
    const nextVal = arr[index + 1];
    args[key] = nextVal && !nextVal.startsWith('--') ? nextVal : true;
  }
});

function resolveText() {
  if (args['caption-file']) {
    if (!fs.existsSync(args['caption-file'])) {
      console.error(`❌ Caption file not found: ${args['caption-file']}`);
      process.exit(1);
    }
    return fs.readFileSync(args['caption-file'], 'utf8').trim();
  }
  return typeof args.text === 'string' ? args.text : '';
}

async function graphError(res) {
  const body = await res.json().catch(() => null);
  return body?.error?.message ?? `Graph API error ${res.status}`;
}

async function main() {
  if (args.help || (!args.text && !args.photo && !args['caption-file'])) {
    console.log(`
Facebook Post Dispatcher (pre-approved copy only — Claude drafts via /social)
------------------------------------------------------------------------------
Options:
  --text "Approved post content"   Text post, or the caption for a photo.
  --link "https://..."             Attach a link (text posts only).
  --photo <file.png>               Post a single photo with --text as caption.
  --caption-file <caption.txt>     Read the message from a file (beats --text).
  --help                           Show this message.
`);
    process.exit(0);
  }

  if (!TOKEN || !PAGE_ID) {
    console.error('❌ FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN not set in .env — see twenty-deploy/SOCIAL-SETUP.md');
    process.exit(1);
  }

  // Verify the token + page first (never echo the URL — it embeds the token).
  try {
    const meUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${PAGE_ID}`);
    meUrl.searchParams.set('fields', 'name');
    meUrl.searchParams.set('access_token', TOKEN);
    const meRes = await fetch(meUrl, { signal: AbortSignal.timeout(4000) });
    if (!meRes.ok) {
      console.error(`❌ Facebook page check failed: ${await graphError(meRes)}`);
      process.exit(1);
    }
    const me = await meRes.json().catch(() => ({}));
    console.log(`✅ Page "${me.name}" ready`);
  } catch (err) {
    console.error(`❌ Cannot reach the Facebook Graph API: ${err.message}`);
    process.exit(1);
  }

  const text = resolveText();

  try {
    if (args.photo) {
      const file = String(args.photo);
      if (!fs.existsSync(file)) {
        console.error(`❌ Photo not found: ${file}`);
        process.exit(1);
      }
      const form = new FormData();
      form.append('source', new Blob([fs.readFileSync(file)]), path.basename(file));
      if (text) form.append('caption', text);
      form.append('access_token', TOKEN);
      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${PAGE_ID}/photos`,
        { method: 'POST', body: form, signal: AbortSignal.timeout(30000) },
      );
      if (!res.ok) {
        console.error(`❌ Photo post failed: ${await graphError(res)}`);
        process.exit(1);
      }
      console.log('✅ Photo posted to Facebook Page');
      return;
    }

    const body = { message: text, access_token: TOKEN };
    if (typeof args.link === 'string') body.link = args.link;
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PAGE_ID}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error(`❌ Post failed: ${await graphError(res)}`);
      process.exit(1);
    }
    console.log('✅ Posted to Facebook Page');
  } catch (err) {
    console.error(`❌ Send failed: ${err.message}`);
    process.exit(1);
  }
}

main();
