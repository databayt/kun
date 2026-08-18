#!/usr/bin/env node

/**
 * Next-Generation AI Video Orchestrator for databayt.
 *
 * Integrates cutting-edge frontier video models:
 *   - Seedance 2.5 (Higgsfield flagship: omni_reference, start/end frames, audio generation)
 *   - Google Veo 3.1 & Veo Lite (Continuous physics & spatial rendering)
 *   - Kling 3.0 Turbo (Fast turnaround motion)
 *   - Wan 2.6 / 2.7 (High dynamic lighting)
 *   - Bytedance / Topaz Video Upscaler (Super-resolution & temporal stability)
 *
 * Usage:
 *   node scripts/video-media.mjs seedance --prompt "..." [--start-image img.png] [--end-image end.png]
 *          [--ratio 16:9|9:16|1:1] [--res 720p|1080p] [--duration 5] [--no-audio] [--brand mkan|hogwarts]
 *   node scripts/video-media.mjs compile --brand mkan --subject "A Riyadh villa pool at sunset"
 *   node scripts/video-media.mjs cost --model seedance_2_5|kling3_0_turbo|veo3_1
 *   node scripts/video-media.mjs models
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(os.homedir(), 'Downloads', 'higgs');

// ── Model Catalogue & Costs ──────────────────────────────────────────────────

const VIDEO_MODELS = {
  seedance_2_5: {
    label: 'Seedance 2.5',
    provider: 'higgsfield',
    jobType: 'seedance_2_5',
    costCredits: 32.5,
    ratios: ['16:9', '9:16', '1:1', '21:9', '4:3', '3:4'],
    resolutions: ['720p', '1080p'],
    features: ['omni_reference', 'start_image', 'end_image', 'native_audio', 'extension'],
  },
  kling3_0_turbo: {
    label: 'Kling 3.0 Turbo',
    provider: 'higgsfield',
    jobType: 'kling3_0_turbo',
    costCredits: 7.5,
    ratios: ['16:9', '9:16', '1:1'],
    resolutions: ['720p', '1080p'],
    features: ['start_image'],
  },
  kling3_0: {
    label: 'Kling 3.0 Standard',
    provider: 'higgsfield',
    jobType: 'kling3_0',
    costCredits: 10.0,
    ratios: ['16:9', '9:16', '1:1'],
    resolutions: ['720p', '1080p'],
    features: ['start_image'],
  },
  veo3_1_lite: {
    label: 'Google Veo 3.1 Lite (Higgsfield)',
    provider: 'higgsfield',
    jobType: 'veo3_1_lite',
    costCredits: 8.0,
    ratios: ['16:9', '9:16'],
    resolutions: ['720p'],
    features: ['start_image'],
  },
  veo3_1: {
    label: 'Google Veo 3.1 (Higgsfield)',
    provider: 'higgsfield',
    jobType: 'veo3_1',
    costCredits: 22.0,
    ratios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p'],
    features: ['start_image'],
  },
  wan2_6: {
    label: 'Wan 2.6 Video',
    provider: 'higgsfield',
    jobType: 'wan2_6',
    costCredits: 13.0,
    ratios: ['16:9', '9:16'],
    resolutions: ['720p'],
    features: ['start_image'],
  },
  bytedance_video_upscale: {
    label: 'Bytedance Video Upscale (720p -> 1080p/4K)',
    provider: 'higgsfield',
    jobType: 'bytedance_video_upscale',
    costCredits: 3.5,
    features: ['super_resolution', 'temporal_stabilization'],
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function flag(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function loadBrandKit() {
  const kitPath = path.join(rootDir, 'content', 'media', 'brand-kit.json');
  return JSON.parse(fs.readFileSync(kitPath, 'utf8'));
}

// 5-beat cinematic video prompt compiler
function compileVideoPrompt(brandId, subject) {
  const kit = loadBrandKit();
  const brand = kit.brands[brandId];
  if (!brand) throw new Error(`Unknown brand "${brandId}"`);

  const spine = brand.videoSpines?.made_possible_by_host?.prompt ||
                brand.videoSpines?.coastal_walkthrough?.prompt ||
                brand.videoSpines?.cinematic_walkthrough?.prompt ||
                brand.videoSpines?.documentary_calm?.prompt ||
                brand.styleSpines?.cinematic?.prompt;

  const clay = brand.palette?.canvas?.find(c => c.name === 'Clay')?.hex || '#e05638';
  const region = brand.region?.items?.[0] || 'Port Sudan, Sudan setting';

  return `Cinematic 24fps. ${subject}

Spine & Movement: ${spine}
Setting: ${region}.
Palette: ${brand.palette.canvas.map(c => c.hex).join(', ')} with ${clay} accent.
No text, no lettering, no numerals, no logos, no watermarks.`;
}

// ── Subcommands ──────────────────────────────────────────────────────────────

const command = process.argv[2];

if (command === 'models') {
  console.log(JSON.stringify(VIDEO_MODELS, null, 2));
} else if (command === 'compile') {
  const brand = flag('brand') || 'mkan';
  const subject = flag('subject') || 'A coastal Port Sudan home with morning tea on a breezy balcony';
  const prompt = compileVideoPrompt(brand, subject);
  console.log(prompt);
} else if (command === 'cost') {
  const modelKey = flag('model') || 'seedance_2_5';
  const model = VIDEO_MODELS[modelKey];
  if (!model) {
    console.error(`Unknown model "${modelKey}". Valid: ${Object.keys(VIDEO_MODELS).join(', ')}`);
    process.exit(1);
  }
  console.log(JSON.stringify({ model: modelKey, label: model.label, costCredits: model.costCredits }, null, 2));
} else if (command === 'seedance') {
  const promptArg = flag('prompt');
  const brand = flag('brand') || 'mkan';
  if (!promptArg) {
    console.error('Usage: seedance --prompt "..." [--brand mkan] [--start-image <img>] [--end-image <end>] [--ratio 9:16] [--yes]');
    process.exit(1);
  }

  const ratio = flag('ratio') || '9:16';
  const res = flag('res') || '1080p';
  const duration = parseInt(flag('duration') || '5', 10);
  const startImage = flag('start-image');
  const endImage = flag('end-image');
  const audio = !hasFlag('no-audio');
  const yes = hasFlag('yes');

  const mode = (startImage || endImage) ? 'omni_reference' : 't2v';

  const estimate = {
    model: 'seedance_2_5',
    mode,
    ratio,
    resolution: res,
    duration,
    generate_audio: audio,
    start_image: startImage || null,
    end_image: endImage || null,
    costCredits: 32.5,
    brand,
  };

  if (!yes) {
    console.log(JSON.stringify({ status: 'dry_run', estimate, message: 'Pass --yes to spend credits and generate.' }, null, 2));
    process.exit(0);
  }

  // Construct CLI args for higgsfield
  const args = [
    'generate', 'create', 'seedance_2_5',
    '--prompt', promptArg,
    '--aspect_ratio', ratio,
    '--resolution', res,
    '--duration', String(duration),
    '--wait', '--json',
  ];

  if (startImage) args.push('--start-image', startImage);
  if (endImage) args.push('--end-image', endImage);

  console.log(`Running: higgsfield ${args.join(' ')}`);
  try {
    const resOutput = execFileSync('higgsfield', args, { encoding: 'utf8' });
    const parsed = JSON.parse(resOutput.trim());
    console.log(JSON.stringify({ status: 'completed', result: parsed }, null, 2));
  } catch (err) {
    console.error(`Generation error: ${err.message}`);
    process.exit(1);
  }
} else {
  console.log(`
Next-Generation AI Video Orchestrator

Commands:
  models      List all supported video models and parameters
  cost        Check generation cost for a model
  compile     Compile a 5-beat video prompt for a brand
  seedance    Generate a video using Seedance 2.5 (Flagship)

Flags for seedance:
  --prompt <string>       Video prompt description (Required)
  --brand <string>        Brand kit to anchor (default: mkan)
  --ratio <string>        Aspect ratio: 16:9, 9:16, 1:1 (default: 9:16)
  --res <string>          Resolution: 720p, 1080p (default: 1080p)
  --duration <number>     Length in seconds: 5, 8, 10 (default: 5)
  --start-image <file>    First frame image anchor (I2V)
  --end-image <file>      Optional destination frame anchor
  --no-audio              Disable synchronized audio generation
  --yes                   Execute and spend credits (omit for dry-run)
`);
}
