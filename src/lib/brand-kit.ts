// The brand kit's compile step — the prompt a renderer actually executes.
//
// This is a MIRROR of scripts/lib/brand-kit.mjs (a plain .mjs cannot import TS,
// the same constraint that produced rotation.ts). Both read
// content/media/brand-kit.json, so the DATA cannot drift; only the assembly
// can, and social-media-brief.test.ts pins the two together by compiling the
// same input through both and demanding byte-identical output.
//
// Nothing server-only is imported here on purpose: the queue's Prisma calls
// live in social-media-brief.ts, so a test can reach the compile directly.
//
// The prompt is frozen into the row at file time and never recompiled. The kit
// will change — palettes get tuned, negatives get added — and when it does, the
// record of what a given image was actually asked for must not silently change
// underneath it.

import kit from "../../content/media/brand-kit.json";

export interface CompiledBrief {
  prompt: string;
  size: string;
  spine: string;
}

interface BrandKitType {
  lane: string;
  size?: string;
  spine?: string;
  use: string;
  extra?: string;
}

/** The asset types a seat can actually render, for the UI's picker. */
export function chatgptTypes(brand: string): { id: string; use: string }[] {
  const b = kit.brands[brand as keyof typeof kit.brands];
  if (!b) return [];
  return Object.entries(b.types as Record<string, BrandKitType>)
    .filter(([, t]) => t.lane === "chatgpt")
    .map(([id, t]) => ({ id, use: t.use }));
}

export function brandKitBrands(): string[] {
  return Object.keys(kit.brands);
}

/**
 * Throws rather than falling back when the type is not a ChatGPT-lane one:
 * routing a copy-bearing asset to a raster model is the single mistake the
 * no-text doctrine exists to prevent, and a silent default would commit it.
 */
export function compileBrief(
  brand: string,
  assetType: string,
  subject: string,
): CompiledBrief {
  const b = kit.brands[brand as keyof typeof kit.brands];
  if (!b) throw new Error(`Unknown brand "${brand}".`);

  const types = b.types as Record<string, BrandKitType>;
  const type = types[assetType];
  if (!type) throw new Error(`Unknown asset type "${assetType}".`);
  if (type.lane !== "chatgpt") {
    throw new Error(
      `"${assetType}" renders on the ${type.lane} lane, not a seat — ${type.use}.`,
    );
  }

  const spines = b.styleSpines as Record<string, { prompt: string }>;
  const spine = spines[type.spine as string];
  const clay = b.palette.canvas.find((c) => c.name === "Clay")!.hex;

  const prompt = `${subject}

${spine.prompt}

Setting: ${b.region.items[0]}.
Palette: ${b.palette.canvas.map((c) => c.hex).join(", ")} with ${clay} as the single accent.
Size: exactly ${type.size} pixels.
${type.extra ? `${type.extra}\n` : ""}
No text, no lettering, no numerals, no logos, no watermarks anywhere in the image.
Leave the bottom-start corner quiet for a mark placed in post.`;

  return { prompt, size: type.size as string, spine: type.spine as string };
}
