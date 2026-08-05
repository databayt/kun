// The brand kit's compile step, shared by every .mjs that needs it.
//
// There were nearly three copies of this: media-brief.mjs (paste-ready output),
// social-drafts.mjs (weekly seeding), and src/lib/social-media-brief.ts (the
// app). Two of the three are JavaScript and can share a module, so they do.
//
// The TypeScript one remains a deliberate mirror — a .ts file cannot be
// imported by a plain .mjs, the same constraint that produced rotation.ts — and
// media-brief.test.mjs pins the two together by comparing their output.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const kitPath = path.resolve(__dirname, '..', '..', 'content', 'media', 'brand-kit.json');

export function loadKit() {
  if (!fs.existsSync(kitPath)) throw new Error(`Brand kit missing at ${kitPath}`);
  return JSON.parse(fs.readFileSync(kitPath, 'utf8'));
}

export function getBrand(kit, id) {
  const brand = kit.brands[id];
  if (!brand) {
    throw new Error(`Unknown brand "${id}". Known: ${Object.keys(kit.brands).join(', ')}`);
  }
  return brand;
}

/**
 * Throws when the type belongs to another lane rather than falling back:
 * routing a copy-bearing asset to a raster model is the one mistake the no-text
 * doctrine exists to prevent, and a silent default would commit it.
 */
export function compileBrief(brandId, assetType, subject) {
  const kit = loadKit();
  const b = getBrand(kit, brandId);

  const type = b.types[assetType];
  if (!type) {
    throw new Error(`Unknown type "${assetType}". Known: ${Object.keys(b.types).join(', ')}`);
  }
  if (type.lane !== 'chatgpt') {
    throw new Error(
      `Type "${assetType}" renders on the ${type.lane} lane, not the ChatGPT one — ${type.use}. ` +
        (type.lane === 'template'
          ? 'It carries copy, so it renders from HTML: see /docs/social/carousel.'
          : 'See /docs/media.'),
    );
  }

  const spine = b.styleSpines[type.spine];
  const clay = b.palette.canvas.find((c) => c.name === 'Clay').hex;

  const prompt = `${subject}

${spine.prompt}

Setting: ${b.region.items[0]}.
Palette: ${b.palette.canvas.map((c) => c.hex).join(', ')} with ${clay} as the single accent.
Size: exactly ${type.size} pixels.
${type.extra ? `${type.extra}\n` : ''}
No text, no lettering, no numerals, no logos, no watermarks anywhere in the image.
Leave the bottom-start corner quiet for a mark placed in post.`;

  return { prompt, size: type.size, spine: type.spine };
}
