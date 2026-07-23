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
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outputDir = path.join(rootDir, 'public', 'social', 'media');

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

async function main() {
  ensureOutputDir();
  const args = parseArgs();
  const product = (args.product || 'databayt').toLowerCase();
  const preset = BRAND_PRESETS[product] || BRAND_PRESETS.databayt;
  const promptText = `${args.prompt}, ${preset.promptSuffix}`;
  const timestamp = Date.now();
  const slug = `${product}-${timestamp}`;
  const svgFilename = `${slug}.svg`;

  console.log(`🎨 Generating visual social card for [${product.toUpperCase()}]...`);
  console.log(`📝 Higgs Prompt: "${promptText}"`);

  // Attempt Higgsfield CLI execution if installed
  let higgsSuccess = false;
  let mediaUrl = '';

  try {
    const cmd = `higgsfield generate create nano_banana_flash --prompt "${promptText.replace(/"/g, '\\"')}" --aspect_ratio ${args.format === '1:1' ? '1:1' : '16:9'} --wait --json`;
    console.log(`🚀 Executing Higgsfield CLI...`);
    const output = execSync(cmd, { encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'ignore'] });
    const parsed = JSON.parse(output);
    if (Array.isArray(parsed) && parsed[0]?.result_url) {
      const imgUrl = parsed[0].result_url;
      const pngFilename = `${slug}.png`;
      const localPath = path.join(outputDir, pngFilename);
      execSync(`curl -sL -o "${localPath}" "${imgUrl}"`);
      mediaUrl = `/social/media/${pngFilename}`;
      higgsSuccess = true;
      console.log(`✅ Higgsfield visual card generated: ${mediaUrl}`);
    }
  } catch (err) {
    console.warn(`💡 Higgsfield CLI unavailable or unauthed (${err.message}). Using SVG brand fallback card.`);
  }

  if (!higgsSuccess) {
    mediaUrl = generateSvgFallback(product, args.prompt, svgFilename);
    console.log(`✅ SVG Brand Fallback Card generated: ${mediaUrl}`);
  }

  console.log(JSON.stringify({ ok: true, product, mediaUrl, prompt: promptText }));
}

main();
