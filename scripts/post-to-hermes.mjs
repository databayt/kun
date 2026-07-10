#!/usr/bin/env node

/**
 * Hermes Social Post Dispatcher — the headless PRE-APPROVED lane.
 * Runs from terminal, cron, or Git hooks.
 *
 * Doctrine: this script only relays copy that a human already approved.
 * It does NOT draft — Claude writes the copy (the /social skill), Hermes
 * relays it. The old --prompt draft-and-blast lane was removed on purpose.
 *
 * Usage:
 *   node scripts/post-to-hermes.mjs --text "Approved copy here" --channels "slack"
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
const HERMES_API_URL = (env.HERMES_API_URL || '').trim().replace(/\/$/, '');
const HERMES_API_KEY = (env.HERMES_API_KEY || '').trim();

if (!HERMES_API_URL) {
  console.error('❌ HERMES_API_URL not set in .env — see kun.databayt.org/docs/hermes');
  process.exit(1);
}

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
  const channelsStr = args.channels || 'slack';
  const channels = channelsStr.split(',').map(c => c.trim()).filter(Boolean);

  if (args.help || !args.text) {
    console.log(`
Hermes Post Dispatcher (pre-approved copy only — Claude drafts via /social)
---------------------------------------------------------------------------
Options:
  --text "Approved post content"   The content to relay. Required.
  --channels "slack,telegram"      Comma separated channels (default: slack).
  --help                           Show this message.
`);
    process.exit(0);
  }

  // Headers
  const headers = {
    'Content-Type': 'application/json',
  };
  if (HERMES_API_KEY) {
    headers['Authorization'] = `Bearer ${HERMES_API_KEY}`;
  }

  // Verify health first
  try {
    const healthRes = await fetch(`${HERMES_API_URL}/health`, { headers, signal: AbortSignal.timeout(3000) });
    if (!healthRes.ok) {
      console.error(`❌ Cannot connect to Hermes gateway at ${HERMES_API_URL} (Status: ${healthRes.status})`);
      process.exit(1);
    }
    const health = await healthRes.json().catch(() => ({}));
    console.log(`✅ Connected to Hermes gateway v${health.version || 'unknown'} at ${HERMES_API_URL}`);
  } catch (err) {
    console.error(`❌ Hermes connection failed at ${HERMES_API_URL}: ${err.message}`);
    process.exit(1);
  }

  console.log(`🚀 Dispatching post to platforms: ${channels.join(', ')}...`);
  await publishDirectly(args.text, channels, headers);
}

async function publishDirectly(text, channels, headers) {
  try {
    const res = await fetch(`${HERMES_API_URL}/webhook`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event: 'social_post',
        timestamp: new Date().toISOString(),
        data: { text, channels }
      })
    });

    if (!res.ok) {
      throw new Error(`Webhook error ${res.status}: ${await res.text()}`);
    }

    console.log('🎉 Successfully posted to social media!');
  } catch (err) {
    console.error(`❌ Webhook post delivery failed: ${err.message}`);
    process.exit(1);
  }
}

main();
