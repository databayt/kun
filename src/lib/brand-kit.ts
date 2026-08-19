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

export type MediaStudioKind = "video" | "image" | "template";
export type MediaStudioRatio = "9:16" | "1:1" | "16:9" | "4:5";

export interface MediaStudioInput {
  brand: string;
  kind: MediaStudioKind;
  subject: string;
  format?: string;
  ratio?: MediaStudioRatio;
  spine?: string;
  model?: string;
}

export interface MediaStudioOutput {
  prompt: string;
  title: string;
  lane: MediaStudioKind;
  format?: string;
  model?: string;
  dimensions: string;
  ratio: MediaStudioRatio;
  spine: string;
  paletteHexes: string[];
  accentHex: string;
  domain: string;
  markFile: string;
  beats: {
    scene: string;
    cameraMotion: string;
    lightingAtmosphere: string;
    soundFoley: string;
    postProcessing: string;
  };
}

export function getBrandSpines(brand: string): { id: string; use: string; prompt: string }[] {
  const b = kit.brands[brand as keyof typeof kit.brands];
  if (!b) return [];
  const out: { id: string; use: string; prompt: string }[] = [];
  if (b.styleSpines) {
    for (const [id, s] of Object.entries(b.styleSpines as Record<string, { use?: string; prompt: string }>)) {
      out.push({ id, use: s.use || id, prompt: s.prompt });
    }
  }
  if ((b as any).videoSpines) {
    for (const [id, s] of Object.entries((b as any).videoSpines as Record<string, { use?: string; prompt: string }>)) {
      out.push({ id, use: s.use || id, prompt: s.prompt });
    }
  }
  return out;
}

const RATIO_DIMS: Record<MediaStudioRatio, { image: string; video: string }> = {
  "9:16": { image: "1080x1920", video: "1080x1920 (9:16 vertical 24fps)" },
  "1:1": { image: "1080x1080", video: "1080x1080 (1:1 square 24fps)" },
  "16:9": { image: "1792x1024", video: "1920x1080 (16:9 landscape 24fps)" },
  "4:5": { image: "1080x1350", video: "1080x1350 (4:5 portrait 24fps)" },
};

export function compileMediaStudioPrompt(input: MediaStudioInput): MediaStudioOutput {
  const brand = input.brand;
  const b = kit.brands[brand as keyof typeof kit.brands];
  // Refuse rather than substitute. This used to fall back to `kit.brands.mkan`,
  // so picking balqalam compiled a Port Sudan coastal prompt with an mkan.sd
  // lockup and said nothing — which made the balqalam naming rule the kit
  // itself records ("must never carry the Hogwarts wordmark") unenforceable.
  // compileBrief has always thrown here; this is the same contract.
  if (!b) {
    throw new Error(
      `Unknown brand "${brand}" — no entry in content/media/brand-kit.json. ` +
        `Known: ${Object.keys(kit.brands).join(", ")}.`,
    );
  }
  const kind = input.kind || "image";
  const format = input.format || (kind === "video" ? "walkthrough" : "post");
  const ratio = input.ratio || (kind === "video" ? "9:16" : "4:5");
  const dims = RATIO_DIMS[ratio] || (kind === "video" ? RATIO_DIMS["9:16"] : RATIO_DIMS["4:5"]);
  const dimensions = kind === "video" ? dims.video : dims.image;

  const spines = getBrandSpines(brand);
  const selectedSpine = spines.find((s) => s.id === input.spine) || spines[0] || {
    id: "cinematic",
    use: "default cinematic",
    prompt: "Cinematic natural photography with authentic lighting and rich atmosphere.",
  };

  const clay = b.palette?.canvas?.find((c) => c.name === "Clay")?.hex || "#e05638";
  const paletteHexes = b.palette?.canvas?.map((c) => c.hex) || ["#0f4c81", "#e5d9c5", "#e05638"];
  const setting = b.region?.items?.[0] || (brand === "mkan" ? "Port Sudan, Red Sea, Sudan" : "Modern school campus, Khartoum, Sudan");

  let cameraMotion = "Stationary 50mm prime framing with shallow depth of field";
  let soundFoley = "Natural ambient room tone";

  if (kind === "video") {
    if (brand === "mkan") {
      cameraMotion = "Gentle 35mm handheld drift gliding from interior living space towards breezy sunlit Red Sea balcony at 24fps";
      soundFoley = "Gentle coastal Red Sea breeze, faint clinking of tea glasses, quiet warm laughter, authentic room tone";
    } else if (brand === "hogwarts") {
      cameraMotion = "Smooth slow cinematic dolly push-in across school library and modern classroom at 24fps";
      soundFoley = "Subtle acoustic school ambience, soft paper turning, calm room tone";
    } else {
      cameraMotion = "Smooth slow cinematic dolly push-in at 24fps with natural optic distortion";
      soundFoley = "Subtle acoustic ambience, soft room tone";
    }
  } else {
    switch (format) {
      case "lifestyle":
        cameraMotion = "Candid 35mm documentary eye-level framing capturing authentic human warmth and natural interactions";
        break;
      case "post":
      case "product":
      case "hero":
        cameraMotion = "Clean 50mm architectural framing with crisp geometry and balanced perspective";
        break;
      case "ad":
        cameraMotion = "High-impact promotional composition with prominent focal subject and generous negative space for typography overlay";
        break;
      case "infographic":
        cameraMotion = "Structured clean editorial layout with clear subject staging and balanced quadrants for statistics and feature checklists";
        break;
      case "carousel":
        cameraMotion = "Editorial sequential framing maintaining consistent eye-level horizon and narrative progression across slides";
        break;
      case "testimonial":
        cameraMotion = "Warm intimate portrait framing with soft shallow depth-of-field background, leaving prominent negative space for quotation display";
        break;
      case "mockup":
        cameraMotion = "Top-down 45-degree angle table shot with natural soft studio lighting and clean desk texture";
        break;
      default:
        cameraMotion = "Clean 50mm prime framing with natural depth and balanced composition";
        break;
    }
  }

  const postProcessing = `No generated text, no lettering, no AI watermark. Leave quiet bottom-start corner for ${b.domain} brand lockup.`;

  let prompt = "";
  if (kind === "video") {
    prompt = `[FORMAT & USE CASE]: ${format.toUpperCase()} (${b.mediaName})
[SCENE]: ${input.subject}
[CAMERA & MOTION]: ${cameraMotion}
[STYLE & ATMOSPHERE]: ${selectedSpine.prompt}
[SETTING]: ${setting}
[LIGHTING & COLOR]: Natural daylight, palette: ${paletteHexes.join(", ")} with ${clay} as accent.
[AUDIO DIRECTIVES]: ${soundFoley}
[FORMAT]: ${dimensions}
[CONSTRAINTS]: ${postProcessing}`;
  } else if (kind === "image") {
    prompt = `[USE CASE: ${format.toUpperCase()}]
${input.subject}

${selectedSpine.prompt}

Framing: ${cameraMotion}.
Setting: ${setting}.
Palette: ${paletteHexes.join(", ")} with ${clay} as the single accent.
Size: ${dimensions} pixels.
No text, no lettering, no numerals, no logos, no watermarks anywhere in the image.
Leave the bottom-start corner quiet for a mark placed in post.`;
  } else {
    prompt = `[TEMPLATE DIRECTIVE: ${format.toUpperCase()}]
Headline: Set in Thmanyah Serif Display (Arabic) / Geist (English).
Subject Plate: ${input.subject} (${selectedSpine.prompt})
Dimensions: ${dimensions}
Badge Overlay: Pill shape with transparent glass background, displaying local price / district pill / metrics.
Brand Mark: ${b.mark?.file || "mark.svg"} in monochrome ink placed at bottom-start.`;
  }

  return {
    prompt,
    title: `${b.mediaName} · ${format.toUpperCase()} (${ratio})`,
    lane: kind,
    format,
    model: input.model,
    dimensions,
    ratio,
    spine: selectedSpine.id,
    paletteHexes,
    accentHex: clay,
    domain: b.domain,
    markFile: b.mark?.file || "mark.svg",
    beats: {
      scene: input.subject,
      cameraMotion,
      lightingAtmosphere: `Natural sunlight in ${setting}. Colors: ${paletteHexes.join(", ")} (accent ${clay}).`,
      soundFoley,
      postProcessing,
    },
  };
}

