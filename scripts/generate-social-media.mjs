#!/usr/bin/env node

/**
 * Social Media Visual Generator — Higgsfield AI Integration with Fallback.
 * Generates text-free social cards, OG images, and visual assets per brand.
 *
 * Usage:
 *   node scripts/generate-social-media.mjs --product hogwarts --prompt "School admission dashboard" --format 16:9
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, execFileSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outputDir = path.join(rootDir, 'public', 'social', 'media');
const libraryScript = path.join(__dirname, 'higgs-library.mjs');

// Cheapest model that still produces a publishable card. nano_banana_flash (1.5cr)
// was the old default; nano_banana_2_lite is 1cr for the same job.
const CARD_MODEL = 'nano_banana_2_lite';
const CARD_COST = 1;

// Per-brand visual style tokens (text-free as per /higgs doctrine)
const BRAND_PRESETS = {
  databayt: {
    name: 'Databayt',
    bg: '#0F172A',
    accent: '#06B6D4',
    secondary: '#3B82F6',
    promptSuffix: 'minimal premium developer tool aesthetic, deep charcoal background, generous negative space, soft studio light, restrained cyan accent, text-free',
  },
  hogwarts: {
    name: 'Hogwarts',
    bg: '#064E3B',
    accent: '#10B981',
    secondary: '#059669',
    promptSuffix: 'clean educational management dashboard interface mockup, glassmorphism panels, deep emerald green ambient light, modern minimalist UI, text-free',
  },
  mkan: {
    name: 'Mkan',
    bg: '#451A03',
    accent: '#F59E0B',
    secondary: '#D97706',
    promptSuffix: 'modern architectural workspace interior, warm ambient natural light, glass and stone texture, luxury real estate presentation, text-free',
  },
  moallimee: {
    name: 'Moallimee',
    bg: '#312E81',
    accent: '#6366F1',
    secondary: '#818CF8',
    promptSuffix: 'futuristic digital learning hub, vibrant indigo and violet lighting, holographic glass panels, text-free',
  },
  sijillee: {
    name: 'Sijillee',
    bg: '#1E1B4B',
    accent: '#EAB308',
    secondary: '#CA8A04',
    promptSuffix: 'trusted legal document registry aesthetic, deep navy background with golden stamp rim light, security watermark grid, text-free',
  },
};

function ensureOutputDir() {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

function parseArgs() {
  const args = { product: 'databayt', prompt: 'Brand showcase', format: '16:9' };
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
  return args;
}

function generateSvgFallback(product, title, filename) {
  const preset = BRAND_PRESETS[product] || BRAND_PRESETS.databayt;
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${preset.bg}"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${preset.accent}"/>
      <stop offset="100%" stop-color="${preset.secondary}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <!-- Glassmorphic panel -->
  <rect x="80" y="80" width="1040" height="470" rx="24" fill="#ffffff" fill-opacity="0.04" stroke="#ffffff" stroke-opacity="0.1" stroke-width="2"/>
  <circle cx="950" cy="180" r="140" fill="${preset.accent}" fill-opacity="0.15" filter="blur(40px)"/>
  <line x1="80" y1="546" x2="1120" y2="546" stroke="url(#accent)" stroke-width="8" stroke-linecap="round"/>
  <!-- Brand logo mark -->
  <rect x="140" y="140" width="60" height="60" rx="16" fill="url(#accent)"/>
  <text x="220" y="180" fill="#F8FAFC" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="32">${preset.name}</text>
  <text x="140" y="320" fill="#E2E8F0" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="44" width="800">${title.substring(0, 50)}</text>
  <text x="140" y="460" fill="#94A3B8" font-family="system-ui, -apple-system, sans-serif" font-size="20">databayt.org · Open Source SaaS Ecosystem</text>
</svg>`;

  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, svgContent, 'utf8');
  return `/social/media/${filename}`;
}

function runLibrary(argv) {
  try {
    const out = execFileSync('node', [libraryScript, ...argv], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return JSON.parse(out.trim().split('\n').pop());
  } catch {
    return null; // library is an optimization, never a hard dependency
  }
}

/**
 * Why can't we generate? Returns null when the account is ready to spend, or a
 * {code, message} explaining what is actually wrong. The old code collapsed every
 * cause into "unavailable or unauthed" and shipped a placeholder marked ✅.
 */
function diagnoseAccount(needed) {
  let status;
  try {
    status = execFileSync('higgsfield', ['account', 'status'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    const text = `${err.stderr || ''}${err.stdout || ''}`;
    if (err.code === 'ENOENT') return { code: 'cli-missing', message: 'higgsfield CLI is not installed (brew install higgsfield)' };
    if (/not authenticated|unauthorized|login/i.test(text)) return { code: 'unauthed', message: 'higgsfield is not authenticated — run: higgsfield auth login' };
    if (/workspace/i.test(text)) return { code: 'no-workspace', message: 'no workspace selected — run: higgsfield workspace set <id>' };
    return { code: 'cli-error', message: `higgsfield account status failed: ${text.trim() || err.message}` };
  }

  const balance = Number((status.match(/([\d.]+)\s*credits?/i) || [])[1]);
  if (Number.isNaN(balance)) return { code: 'unknown-balance', message: `could not read balance from: "${status}"` };
  if (balance < needed) {
    return {
      code: 'insufficient-credits',
      message: `needs ${needed} credits, balance is ${balance} — top up at https://higgsfield.ai/pricing`,
      balance,
    };
  }
  return null;
}

async function main() {
  ensureOutputDir();
  const args = parseArgs();
  const product = (args.product || 'databayt').toLowerCase();
  const preset = BRAND_PRESETS[product] || BRAND_PRESETS.databayt;
  const promptText = `${args.prompt}, ${preset.promptSuffix}`;
  const ratio = args.format === '1:1' ? '1:1' : '16:9';
  const timestamp = Date.now();
  const slug = `${product}-${timestamp}`;

  console.log(`🎨 Generating visual social card for [${product.toUpperCase()}]...`);
  console.log(`📝 Higgs Prompt: "${promptText}"`);

  // 1. Already paid for this exact shot? Reuse it — zero credits.
  const cached = runLibrary(['lookup', '--prompt', promptText, '--model', CARD_MODEL, '--ratio', ratio]);
  if (cached?.hit && (cached.localPath || cached.cdnUrl)) {
    let mediaUrl = cached.cdnUrl;
    if (cached.localPath) {
      const reusedName = `${slug}${path.extname(cached.file)}`;
      fs.copyFileSync(cached.localPath, path.join(outputDir, reusedName));
      mediaUrl = `/social/media/${reusedName}`;
    }
    console.log(`♻️  Library hit — reused ${cached.file}, saved ${cached.creditsSaved ?? 0} credits`);
    console.log(JSON.stringify({ ok: true, source: 'library', product, mediaUrl, prompt: promptText, creditsSpent: 0, creditsSaved: cached.creditsSaved ?? 0 }));
    return;
  }

  // 2. Can we actually spend? Fail loudly with the real reason if not.
  const blocker = diagnoseAccount(CARD_COST);
  if (blocker) {
    const mediaUrl = generateSvgFallback(product, args.prompt, `${slug}.svg`);
    console.error(`❌ Higgsfield unavailable: ${blocker.message}`);
    console.error(`   Wrote an SVG placeholder — this is NOT a generated card. Do not publish it as one.`);
    console.log(JSON.stringify({ ok: false, source: 'svg-fallback', reason: blocker.code, message: blocker.message, product, mediaUrl, prompt: promptText, creditsSpent: 0 }));
    process.exit(args['allow-fallback'] ? 0 : 1);
  }

  // 3. Spend.
  try {
    console.log(`🚀 Generating via ${CARD_MODEL} (${CARD_COST} cr)...`);
    const output = execFileSync('higgsfield', [
      'generate', 'create', CARD_MODEL,
      '--prompt', promptText,
      '--aspect_ratio', ratio,
      '--wait', '--wait-timeout', '10m', '--json',
    ], { encoding: 'utf8', timeout: 11 * 60 * 1000, stdio: ['ignore', 'pipe', 'pipe'] });

    const parsed = JSON.parse(output);
    const imgUrl = Array.isArray(parsed) ? parsed[0]?.result_url : parsed?.result_url;
    if (!imgUrl) throw new Error(`job returned no result_url: ${output.slice(0, 300)}`);

    const pngFilename = `${slug}.png`;
    const localPath = path.join(outputDir, pngFilename);
    execFileSync('curl', ['-sSL', '-o', localPath, imgUrl]);

    // Record it so the next identical request is free.
    const inbox = path.join(process.env.HOME, 'Downloads', 'higgs');
    fs.mkdirSync(inbox, { recursive: true });
    const archived = path.join(inbox, `${new Date().toISOString().slice(0, 10)}-${slug}.png`);
    fs.copyFileSync(localPath, archived);
    runLibrary(['add', archived, '--prompt', promptText, '--model', CARD_MODEL, '--ratio', ratio, '--brand', product, '--credits', String(CARD_COST)]);

    const mediaUrl = `/social/media/${pngFilename}`;
    console.log(`✅ Higgsfield visual card generated: ${mediaUrl}`);
    console.log(JSON.stringify({ ok: true, source: 'higgsfield', product, mediaUrl, prompt: promptText, creditsSpent: CARD_COST }));
  } catch (err) {
    const detail = `${err.stderr || ''}`.trim() || err.message;
    const mediaUrl = generateSvgFallback(product, args.prompt, `${slug}.svg`);
    console.error(`❌ Generation failed: ${detail}`);
    console.error(`   Wrote an SVG placeholder — this is NOT a generated card. Do not publish it as one.`);
    console.log(JSON.stringify({ ok: false, source: 'svg-fallback', reason: 'generation-failed', message: detail, product, mediaUrl, prompt: promptText, creditsSpent: 0 }));
    process.exit(args['allow-fallback'] ? 0 : 1);
  }
}

main();
