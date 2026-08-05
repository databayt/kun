#!/usr/bin/env node

/**
 * Media Brief — compile the brand kit into a prompt a renderer can execute.
 *
 * The problem this solves: a ChatGPT seat renders whatever it is told, and the
 * quality of the result is almost entirely decided before anyone types a word.
 * So the brand kit (content/media/brand-kit.json) holds the palette, the type
 * roles, the mark, the regional reality and the negative list, and this script
 * compiles them into one paste-ready block. Nobody re-explains the brand, and
 * nobody's memory of it drifts.
 *
 * Two modes, and the difference matters:
 *
 *   project   Printed ONCE. It is the custom-instructions block for a ChatGPT
 *             Project — paste it into the project's instructions, attach the
 *             mark, and every chat inside that project inherits the brand.
 *             This is what makes the tenth render look like the first.
 *   brief     Printed per asset. The scene, the exact pixel size, and the
 *             constraints that apply to this one shot.
 *
 * Usage:
 *   node scripts/media-brief.mjs project [--brand hogwarts]
 *   node scripts/media-brief.mjs brief --type hero --subject "..." [--brand b] [--json]
 *   node scripts/media-brief.mjs types [--brand b]
 *
 * After the render: save into ~/Downloads/higgs, then
 *   node scripts/higgs-library.mjs add <file> --brand hogwarts --type hero \
 *     --source chatgpt --model gpt-image-2 --prompt "<the brief>"
 *   node scripts/higgs-library.mjs push
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const kitPath = path.join(rootDir, 'content', 'media', 'brand-kit.json');

function loadKit() {
  if (!fs.existsSync(kitPath)) {
    throw new Error(`Brand kit missing at ${kitPath}`);
  }
  return JSON.parse(fs.readFileSync(kitPath, 'utf8'));
}

function getBrand(kit, id) {
  const brand = kit.brands[id];
  if (!brand) {
    throw new Error(`Unknown brand "${id}". Known: ${Object.keys(kit.brands).join(', ')}`);
  }
  return brand;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const val = argv[i];
    if (val.startsWith('--')) {
      const key = val.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(val);
    }
  }
  return args;
}

const bullets = (items) => items.map((i) => `- ${i}`).join('\n');
const swatches = (list) => list.map((c) => `${c.hex} (${c.name}) — ${c.use}`).join('\n  ');

// ── project: the standing instructions ──────────────────────────────────────

/**
 * Everything true of every asset for this brand, in the second person, because
 * that is the register a ChatGPT Project's custom instructions are read in.
 */
function cmdProject(args) {
  const kit = loadKit();
  const id = args.brand || 'hogwarts';
  const b = getBrand(kit, id);
  const r = kit.renderers.chatgpt;

  const text = `You generate marketing images for ${b.mediaName} (${b.domain}).

WHAT IT IS
${b.what}

WHO SEES THIS
${b.audience}

TONE
${b.tone}

THE HARD RULE — NO TEXT
Never render text, lettering, numerals, signage, UI labels, logos or watermarks
inside an image. Arabic script in particular renders as nonsense, and every word
this brand publishes is set in real type afterwards. An image that contains
letterforms is discarded, however good it otherwise is.

THE MARK
${b.mark.describe}
${b.mark.meaning}
${bullets(b.mark.rules)}

PALETTE — quote these hex values, do not approximate
  ${swatches(b.palette.canvas)}
  ${swatches(b.palette.support)}
${bullets(b.palette.rules)}

REGION — the most common way a render fails
${bullets(b.region.items)}

NEVER
${bullets(b.negative.items)}

COMPOSITION
Leave the bottom-start corner quiet. The mark is placed there in post, so the
frame must be composed with that space already empty.

WHEN I GIVE YOU A BRIEF
Render exactly the size I state — GPT Image 2 takes an explicit WIDTHxHEIGHT and
I will always give you one. Do not substitute a preset. Produce one image unless
I ask for variants, and if a brief would require text in the image, say so
instead of rendering it.`;

  if (args.json) return { ok: true, brand: id, mode: 'project', text };
  console.log(text);
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`Paste the block above into a ChatGPT Project's custom instructions.`);
  console.log(`Attach to the project's files: ${r.attachAlways.join(', ')}`);
  console.log(`Then every brief you paste into that project inherits the brand.`);
  return null;
}

// ── brief: one asset ────────────────────────────────────────────────────────

function cmdBrief(args) {
  const kit = loadKit();
  const id = args.brand || 'hogwarts';
  const b = getBrand(kit, id);

  const typeId = args.type;
  if (!typeId) throw new Error('brief needs --type (run `types` to list them)');

  const type = b.types[typeId];
  if (!type) {
    throw new Error(`Unknown type "${typeId}". Known: ${Object.keys(b.types).join(', ')}`);
  }
  if (type.lane !== 'chatgpt') {
    // Routing a copy-bearing asset to a raster model is the one mistake the
    // whole doctrine exists to prevent, so it fails loudly rather than
    // compiling a prompt that would produce broken type.
    throw new Error(
      `Type "${typeId}" renders on the ${type.lane} lane, not the ChatGPT one — ${type.use}. ` +
        (type.lane === 'template'
          ? 'It carries copy, so it renders from HTML: see /docs/social/carousel.'
          : 'See /docs/media.'),
    );
  }

  const subject = args.subject || b.subjectLibrary.items[0];
  const spine = b.styleSpines[type.spine];

  const text = `${subject}

${spine.prompt}

Setting: ${b.region.items[0]}.
Palette: ${b.palette.canvas.map((c) => `${c.hex}`).join(', ')} with ${
    b.palette.canvas.find((c) => c.name === 'Clay').hex
  } as the single accent.
Size: exactly ${type.size} pixels.
${type.extra ? `${type.extra}\n` : ''}
No text, no lettering, no numerals, no logos, no watermarks anywhere in the image.
Leave the bottom-start corner quiet for a mark placed in post.`;

  if (args.json) {
    return { ok: true, brand: id, type: typeId, size: type.size, spine: type.spine, text };
  }

  console.log(text);
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`type ${typeId} · ${type.size} · ${type.spine} spine · brand ${id}`);
  console.log(`Attach: ${kit.renderers.chatgpt.attachAlways.join(', ')}`);
  console.log(`\nAfter it renders, save into ~/Downloads/higgs and run:`);
  console.log(
    `  node scripts/higgs-library.mjs add ~/Downloads/higgs/<file> \\\n` +
      `    --brand ${id} --type ${typeId} --source chatgpt --model gpt-image-2\n` +
      `  node scripts/higgs-library.mjs push`,
  );
  return null;
}

// ── types ───────────────────────────────────────────────────────────────────

function cmdTypes(args) {
  const kit = loadKit();
  const id = args.brand || 'hogwarts';
  const b = getBrand(kit, id);

  const rows = Object.entries(b.types).map(([k, t]) => ({
    type: k,
    lane: t.lane,
    size: t.size || '—',
    use: t.use,
  }));

  if (args.json) return { ok: true, brand: id, types: rows };

  const pad = Math.max(...rows.map((r) => r.type.length));
  for (const row of rows) {
    console.log(
      `${row.type.padEnd(pad)}  ${row.lane.padEnd(8)}  ${String(row.size).padEnd(9)}  ${row.use}`,
    );
  }
  console.log(`\nOnly \`chatgpt\` types compile a brief; the rest name their own lane.`);
  return null;
}

// ── main ────────────────────────────────────────────────────────────────────

const COMMANDS = { project: cmdProject, brief: cmdBrief, types: cmdTypes };

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const askedForHelp = !cmd || cmd === '--help' || cmd === '-h';

  if (askedForHelp || !COMMANDS[cmd]) {
    console.log(`Media brief — compile the brand kit into a renderable prompt.

  project [--brand hogwarts]                      standing instructions for a ChatGPT Project (paste once)
  brief   --type hero --subject "..." [--brand b] one asset's prompt, size and constraints
  types   [--brand b]                             what each asset type is and which lane owns it

  --json on any command for machine-readable output.

Brand kit: content/media/brand-kit.json`);
    process.exit(askedForHelp ? 0 : 1);
  }

  try {
    const result = COMMANDS[cmd](parseArgs(rest));
    if (result) console.log(JSON.stringify(result));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
