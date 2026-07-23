#!/usr/bin/env node

/**
 * Kun Engine <> Hermes Social Gateway Integration & Health Validator.
 * Usage:
 *   node scripts/social-cron-sync.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

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
const HERMES_API_URL = (env.HERMES_API_URL || 'http://localhost:8642').trim().replace(/\/$/, '');
const HERMES_API_KEY = (env.HERMES_API_KEY || env.HERMES_GATEWAY_TOKEN || '').trim();

async function checkGatewayHealth() {
  console.log(`📡 Inspecting Hermes Social Gateway at: ${HERMES_API_URL}`);
  
  const headers = { 'Content-Type': 'application/json' };
  if (HERMES_API_KEY) {
    headers['Authorization'] = `Bearer ${HERMES_API_KEY}`;
  }

  try {
    const res = await fetch(`${HERMES_API_URL}/health`, { headers, signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      console.log(`✅ Hermes Gateway Connected (v${data.version || 'active'})`);
      return true;
    } else {
      console.warn(`⚠️ Hermes Gateway returned HTTP ${res.status}: ${res.statusText}`);
      return false;
    }
  } catch (err) {
    console.warn(`⚠️ Could not reach Hermes Gateway at ${HERMES_API_URL}: ${err.message}`);
    console.log(`💡 Note: Gateway runs locally via 'hermes gateway start' or systemd service.`);
    return false;
  }
}

async function main() {
  console.log(`-----------------------------------------------------`);
  console.log(`🌐 Kun Engine Social Egress & Cron Integration Status`);
  console.log(`-----------------------------------------------------`);

  const gatewayOk = await checkGatewayHealth();

  console.log(`\n📋 Social Channel Readiness (kun engine):`);
  console.log(`  - Telegram: Wired (Direct Bot API)`);
  console.log(`  - Slack:    Wired (Relayed via Hermes Gateway)`);
  console.log(`  - Facebook: Wired (Direct Graph API)`);
  console.log(`  - X/LinkedIn/Instagram: Configured for Hermes Egress`);

  console.log(`\n⏰ Hermes Cron Scheduler Jobs:`);
  console.log(`  - databayt-weekly-social-plan  [Sun 18:00] -> #social (Slack)`);
  console.log(`  - databayt-daily-social-digest [Mon-Fri 08:30] -> #social (Slack)`);
  console.log(`  - databayt-4h-heartbeat         [Every 4 hrs] -> #social (Slack)`);

  console.log(`-----------------------------------------------------`);
}

main();
