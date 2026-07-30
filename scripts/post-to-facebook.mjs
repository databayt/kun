#!/usr/bin/env node

/**
 * Facebook Post Dispatcher — the headless PRE-APPROVED lane, direct Graph API.
 * Runs from terminal, cron, or Git hooks.
 *
 * Doctrine: this script only relays copy that a human already approved.
 * It does NOT draft — Claude writes the copy (the /draft skill).
 *
 * Per-brand, matching the app. Each product has its own Page and its own
 * permanent Page token, resolved from FACEBOOK_PAGE_ID_<PRODUCT> /
 * FACEBOOK_PAGE_ACCESS_TOKEN_<PRODUCT> exactly as src/lib/facebook.ts does —
 * the unsuffixed vars are hogwarts's legacy fallback and NO other brand's.
 * Without --product this script used to post to whichever Page the unsuffixed
 * pair named, i.e. Hogwarts, whatever brand you meant — a silent wrong-brand
 * publish, which on a public page is the worst failure this system has.
 *
 * Setup (one-time, Abdout): create the Facebook Page; create a Meta app (dev
 * mode is enough to post to a Page you admin — no App Review); generate a
 * long-lived Page access token; set the suffixed vars for the brand.
 * See /docs/social/channels/facebook.
 *
 * Usage:
 *   node scripts/post-to-facebook.mjs --product mkan --text "Approved copy here"
 *   node scripts/post-to-facebook.mjs --product hogwarts --text "..." --link "https://hogwarts.databayt.org"
 *   node scripts/post-to-facebook.mjs --product databayt --photo ./card.png --text "Caption"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// v25.0 matches src/lib/facebook.ts — Meta silently serves sub-floor versions
// from the app's configured version, so a stale pin here never errors, it lies.
const GRAPH_VERSION = 'v25.0';
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

const args = {};
process.argv.slice(2).forEach((val, index, arr) => {
  if (val.startsWith('--')) {
    const key = val.slice(2);
    const nextVal = arr[index + 1];
    args[key] = nextVal && !nextVal.startsWith('--') ? nextVal : true;
  }
});

// Resolve the Page and token the way src/lib/facebook.ts getFacebookConfig
// does: suffixed vars per product, with the unsuffixed pair as hogwarts's
// legacy fallback and no other brand's. Default product is hogwarts, matching
// the app.
const PRODUCT = (typeof args.product === 'string' ? args.product : 'hogwarts').trim();
const PRODUCT_ID = PRODUCT.toUpperCase();
const legacy = PRODUCT_ID === 'HOGWARTS';
const TOKEN = (
  env[`FACEBOOK_PAGE_ACCESS_TOKEN_${PRODUCT_ID}`] ||
  (legacy ? env.FACEBOOK_PAGE_ACCESS_TOKEN : '') ||
  ''
).trim();
const PAGE_ID = (
  env[`FACEBOOK_PAGE_ID_${PRODUCT_ID}`] ||
  (legacy ? env.FACEBOOK_PAGE_ID : '') ||
  ''
).trim();

// UTM at delivery, mirroring src/lib/social-utm.ts: tag every untagged link so a
// post sent by this script is attributable at our own site, exactly like one
// sent through the app. Idempotent — a hand-tagged link is left alone.
function applyUtm(text, channel, brand) {
  if (!text) return text;
  const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?]/g;
  return text.replace(URL_PATTERN, (raw) => {
    let url;
    try {
      url = new URL(raw);
    } catch {
      return raw;
    }
    if (url.searchParams.has('utm_source')) return raw;
    url.searchParams.set('utm_source', channel);
    url.searchParams.set('utm_medium', 'social');
    url.searchParams.set('utm_campaign', brand);
    return url.toString();
  });
}

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
Facebook Post Dispatcher (pre-approved copy only — Claude drafts via /draft)
------------------------------------------------------------------------------
Options:
  --product <brand>                hogwarts | mkan | databayt | sijillee | moalimee.
                                   Default hogwarts. Resolves that brand's own Page.
  --text "Approved post content"   Text post, or the caption for a photo.
  --link "https://..."             Attach a link (text posts only).
  --photo <file.png>               Post a single photo with --text as caption.
  --caption-file <caption.txt>     Read the message from a file (beats --text).
  --help                           Show this message.
`);
    process.exit(0);
  }

  if (!TOKEN || !PAGE_ID) {
    // Refuse rather than fall back. A given --product with no suffixed pair used
    // to silently post to the legacy Hogwarts Page — the wrong-brand publish
    // this flag exists to prevent.
    console.error(
      `❌ FACEBOOK_PAGE_ID_${PRODUCT_ID} / FACEBOOK_PAGE_ACCESS_TOKEN_${PRODUCT_ID} not set in .env` +
        (legacy ? '' : ` (and there is no legacy fallback for ${PRODUCT} — only hogwarts falls back)`) +
        ' — see /docs/social/channels/facebook',
    );
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
    // Name the Page the token resolved to — the same crossed-token check the
    // app's Egress panel does, so a wrong-brand publish is caught before it
    // happens rather than after.
    console.log(`✅ ${PRODUCT} → Page "${me.name}" ready`);
  } catch (err) {
    console.error(`❌ Cannot reach the Facebook Graph API: ${err.message}`);
    process.exit(1);
  }

  const text = applyUtm(resolveText(), 'facebook', PRODUCT);

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
      console.log(`✅ Photo posted to ${PRODUCT}'s Facebook Page`);
      return;
    }

    const body = { message: text, access_token: TOKEN };
    if (typeof args.link === 'string') body.link = applyUtm(args.link, 'facebook', PRODUCT);
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
    console.log(`✅ Posted to ${PRODUCT}'s Facebook Page`);
  } catch (err) {
    console.error(`❌ Send failed: ${err.message}`);
    process.exit(1);
  }
}

main();
