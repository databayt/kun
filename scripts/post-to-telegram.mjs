#!/usr/bin/env node

/**
 * Telegram Post Dispatcher — the headless PRE-APPROVED lane, direct Bot API.
 * Runs from terminal, cron, or Git hooks.
 *
 * Doctrine: this script only relays copy that a human already approved.
 * It does NOT draft — Claude writes the copy (the /social skill).
 *
 * Setup (one-time): @BotFather → TELEGRAM_BOT_TOKEN; create the brand
 * channel; add the bot as channel admin; set TELEGRAM_CHANNEL_ID.
 *
 * Usage:
 *   node scripts/post-to-telegram.mjs --text "Approved copy here"
 *   node scripts/post-to-telegram.mjs --text "..." --chat "@databayt"
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Load environment variables manually from .env
function loadEnv() {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return {};

  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};

  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const parts = trimmed.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      env[key] = val;
    }
  });
  return env;
}

const env = { ...loadEnv(), ...process.env };
const TOKEN = (env.TELEGRAM_BOT_TOKEN || '').trim();
const DEFAULT_CHAT = (env.TELEGRAM_CHANNEL_ID || '').trim();

// Parse args
const args = {};
process.argv.slice(2).forEach((val, index, arr) => {
  if (val.startsWith('--')) {
    const key = val.slice(2);
    const nextVal = arr[index + 1];
    if (nextVal && !nextVal.startsWith('--')) {
      args[key] = nextVal;
    } else {
      args[key] = true;
    }
  }
});

async function main() {
  if (args.help || !args.text) {
    console.log(`
Telegram Post Dispatcher (pre-approved copy only — Claude drafts via /social)
------------------------------------------------------------------------------
Options:
  --text "Approved post content"   The content to relay. Required.
  --chat "@channel"                Chat/channel override (default: TELEGRAM_CHANNEL_ID).
  --help                           Show this message.
`);
    process.exit(0);
  }

  if (!TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN not set in .env — see kun.databayt.org/docs/social');
    process.exit(1);
  }

  const chat = (args.chat || DEFAULT_CHAT).trim();
  if (!chat) {
    console.error('❌ TELEGRAM_CHANNEL_ID not set (and no --chat given) — see kun.databayt.org/docs/social');
    process.exit(1);
  }

  const api = `https://api.telegram.org/bot${TOKEN}`;

  // Verify the bot first (never echo the URL — it embeds the token)
  try {
    const meRes = await fetch(`${api}/getMe`, { signal: AbortSignal.timeout(3000) });
    const me = await meRes.json().catch(() => ({}));
    if (!meRes.ok || !me.ok) {
      console.error(`❌ Telegram bot check failed: ${me.description || meRes.status}`);
      process.exit(1);
    }
    console.log(`✅ Bot @${me.result.username} ready`);
  } catch (err) {
    console.error(`❌ Cannot reach the Telegram API: ${err.message}`);
    process.exit(1);
  }

  console.log(`🚀 Dispatching post to ${chat}...`);
  try {
    const res = await fetch(`${api}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Plain text on purpose: parse_mode entities break on arbitrary copy.
      body: JSON.stringify({ chat_id: chat, text: args.text }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.description || `Telegram API error ${res.status}`);
    }
    console.log('🎉 Posted to Telegram!');
  } catch (err) {
    console.error(`❌ Telegram delivery failed: ${err.message}`);
    process.exit(1);
  }
}

main();
