// The media prompt, single-sourced — the counterpart to draft-prompt.ts.
//
// draft-prompt.ts assembles the prompt that writes a POST. This assembles the
// one that makes its PICTURE, and it exists for the same reason: the facts that
// decide whether a render comes back on-brand — the palette, the region, the
// negative list, the exact pixel size — were scattered across a brand kit, a
// content plan, a taxonomy and six prose docs, and a human pasting into Gemini
// had to remember all of them.
//
// Nothing here calls a model. There is no funded renderer, so a person renders;
// the only thing this can improve is what they paste. That is also why it is
// deterministic — it is free, instant, and a test can read its output.
//
// Section ORDER is load-bearing, the same way it is in draft-prompt.ts: static
// content (who the brand is, its palette, its house constraints) comes first so
// an implicit-cache prefix stays identical across asks, and the per-ask parts —
// the scene, this week's plan, the references — come last.
//
// Absent sections are omitted entirely rather than rendered empty, so a brief
// with no plan behind it LOOKS like one instead of carrying a hollow heading.

import kit from "../../content/media/brand-kit.json";
import pillars from "../../content/social/pillars.json";
import platformSpecs from "../../content/social/platform-specs.json";
import {
  isoWeek,
  SEED_COUNT,
  weeklyPickIndexes,
} from "@/components/root/social/rotation";

type KitBrand = {
  id: string;
  mediaName: string;
  domain: string;
  what: string;
  audience: string;
  tone: string;
  mark?: { file: string | null; rules?: string[] } | null;
  palette?: {
    canvas?: { name: string; hex: string; use: string }[];
    rules?: string[];
  };
  styleSpines?: Record<string, { use: string; prompt: string }>;
  subjectLibrary?: { items: string[] };
  negative?: { items: string[] };
  region?: { items: string[] };
  types: Record<
    string,
    { lane: string; size?: string; spine?: string; use?: string; extra?: string }
  >;
};

type Pillar = {
  id: string;
  pillar: string;
  brief: string;
  visual?: { type: string; subject: string } | null;
};

const BRANDS = kit.brands as unknown as Record<string, KitBrand>;
const PLATFORMS = platformSpecs.platforms as Record<
  string,
  { label: string; placements: string[]; default: string; note?: string;
    requiresMedia?: boolean; documentPost?: boolean }
>;
const SIZES = platformSpecs.sizes as Record<string, string>;

/** A reference the human picked out of the showroom. */
export interface MediaReference {
  title: string;
  /** The showroom's "what to steal" prose — the most useful field it has. */
  note?: string | null;
  /** Absolute and public. Only a generated library asset has one. */
  url?: string | null;
  /** The page a kept reference came from, when there is no fetchable image. */
  sourceUrl?: string | null;
  type?: string | null;
}

export interface MediaPromptInput {
  brand: string;
  assetType: string;
  subject: string;
  /** A pillar id from content/social/pillars.json — carries the feature and why. */
  pillarId?: string;
  /** A DISTRIBUTION_CHANNEL_ID. Decides the artboard. */
  platform?: string;
  placement?: string;
  references?: MediaReference[];
}

/** A file the human must attach by hand — a model cannot fetch a URL. */
export interface MediaAttachment {
  label: string;
  url: string;
  why: string;
}

export type CompiledMedia =
  | { ok: false; error: string }
  | {
      ok: true;
      /** `prompt` goes to a raster renderer; `deck` belongs to the template lane. */
      kind: "prompt" | "deck";
      lane: string;
      prompt: string;
      dimensions: string;
      title: string;
      attachments: MediaAttachment[];
      /** Things the operator should know that do not stop the compile. */
      warnings: string[];
    };

/**
 * The plan's picks for a week, as the Monday seeder would make them. Offset 0
 * is this week, -1 last, +1 next — which is the whole of "previous and
 * upcoming" this surface claims. Publication history is a different question
 * and needs the database; this needs nothing, because the rotation is stateless
 * arithmetic over a git-tracked file.
 *
 * NOT WIRED YET. Nothing calls this, and nothing renders the dictionary keys
 * that were added alongside it (mediaPlan*, mediaBriefTitle, mediaAttach*, …).
 * The data layer and the bilingual strings landed; the panel did not. Parked
 * deliberately rather than deleted — see the tracking issue.
 */
export function plannedPillars(
  brand: string,
  weekOffset = 0,
  now = new Date(),
  count = SEED_COUNT,
): Pillar[] {
  const list = (pillars as unknown as Record<string, Pillar[]>)[brand];
  if (!Array.isArray(list) || list.length === 0) return [];
  const week = isoWeek(now) + weekOffset;
  return weeklyPickIndexes(list.length, week, count).map((i) => list[i]);
}

function pillarFor(brand: string, id?: string): Pillar | undefined {
  if (!id) return undefined;
  const list = (pillars as unknown as Record<string, Pillar[]>)[brand];
  if (!Array.isArray(list)) return undefined;
  return list.find((p) => p.id === id);
}

/**
 * The artboard. A platform's placement wins because that is what the asset has
 * to fit; the type's own size is the fallback for the types no platform sizes
 * (a hero is a hero whatever channel it lands on).
 */
function resolveSize(
  brandKit: KitBrand,
  assetType: string,
  platform?: string,
  placement?: string,
): { size: string; from: string } {
  const spec = platform ? PLATFORMS[platform] : undefined;
  if (spec) {
    const chosen = placement && spec.placements.includes(placement)
      ? placement
      : spec.default;
    const size = SIZES[chosen];
    if (size) return { size, from: `${spec.label} ${chosen}` };
  }
  const typeSize = brandKit.types[assetType]?.size;
  if (typeSize) return { size: typeSize, from: `${assetType} default` };
  return { size: "1080x1350", from: "house default" };
}

export function buildMediaPrompt(input: MediaPromptInput): CompiledMedia {
  const b = BRANDS[input.brand];
  if (!b) {
    return {
      ok: false,
      error:
        `Unknown brand "${input.brand}" — no entry in content/media/brand-kit.json. ` +
        `Known: ${Object.keys(BRANDS).join(", ")}.`,
    };
  }

  const type = b.types[input.assetType];
  if (!type) {
    return {
      ok: false,
      error:
        `Unknown asset type "${input.assetType}" for ${b.mediaName}. ` +
        `Known: ${Object.keys(b.types).join(", ")}.`,
    };
  }

  const subject = input.subject.trim();
  const pillar = pillarFor(input.brand, input.pillarId);
  if (!subject && !pillar?.visual?.subject) {
    return { ok: false, error: "Describe the scene, or pick a pillar that carries one." };
  }
  const scene = subject || pillar!.visual!.subject;

  const warnings: string[] = [];
  const { size, from } = resolveSize(b, input.assetType, input.platform, input.placement);

  // The plan already decided what this post's picture should be. Diverging from
  // it is allowed — it is a suggestion, not a gate — but doing so silently is
  // how a campaign ends up with an image that argues with its own copy.
  if (pillar?.visual?.type && pillar.visual.type !== input.assetType) {
    warnings.push(
      `The plan suggests "${pillar.visual.type}" for ${pillar.id}; you asked for "${input.assetType}".`,
    );
  }
  if (pillar && !pillar.visual) {
    warnings.push(
      `${pillar.id} has no visual in the plan — its image was meant to come from the template lane.`,
    );
  }
  const platformSpec = input.platform ? PLATFORMS[input.platform] : undefined;
  if (input.platform && !platformSpec) {
    warnings.push(`"${input.platform}" is not a publishable channel — size fell back to the type default.`);
  }

  // ── the mark is never generated, only placed ──────────────────────────────
  const attachments: MediaAttachment[] = [];
  if (b.mark?.file) {
    attachments.push({
      // A repo path is not something a chat window can open. Serve it.
      label: b.mark.file.split("/").pop() || "mark.png",
      url: `/${b.mark.file.replace(/^public\//, "")}`,
      why: "the brand mark — attach it so the scene is composed with room for it, then place the real file in post",
    });
  } else {
    warnings.push(
      `${b.mediaName} has no mark file yet, so nothing can be placed in the quiet corner — leave it empty anyway.`,
    );
  }

  const refs = input.references ?? [];
  for (const r of refs) {
    if (r.url) {
      attachments.push({
        label: r.title,
        url: r.url,
        why: r.note?.trim() || "a reference for look and framing",
      });
    }
  }
  const citedOnly = refs.filter((r) => !r.url);

  // ── the router ────────────────────────────────────────────────────────────
  if (type.lane === "none") {
    return {
      ok: false,
      error:
        `"${input.assetType}" is never generated — the mark exists as a file and an AI-drawn ` +
        `approximation of a logo is a different logo. Attach the real one instead.`,
    };
  }

  if (type.lane === "template") {
    // Anything carrying copy renders on the deterministic engine. Emitting a
    // raster prompt here is what produced Arabic-shaped nonsense before.
    return {
      ok: true,
      kind: "deck",
      lane: type.lane,
      dimensions: size,
      title: `${b.mediaName} · ${input.assetType.toUpperCase()} (${size})`,
      attachments,
      warnings,
      prompt: templateBrief(b, input.assetType, scene, size, pillar),
    };
  }

  return {
    ok: true,
    kind: "prompt",
    lane: type.lane,
    dimensions: size,
    title: `${b.mediaName} · ${input.assetType.toUpperCase()} (${size})`,
    attachments,
    warnings,
    prompt: rasterPrompt({
      b,
      assetType: input.assetType,
      type,
      scene,
      size,
      sizeFrom: from,
      pillar,
      platform: input.platform,
      attachments,
      citedOnly,
    }),
  };
}

// ── the raster prompt ───────────────────────────────────────────────────────

function rasterPrompt(a: {
  b: KitBrand;
  assetType: string;
  type: { spine?: string; use?: string; extra?: string };
  scene: string;
  size: string;
  sizeFrom: string;
  pillar?: Pillar;
  platform?: string;
  attachments: MediaAttachment[];
  citedOnly: MediaReference[];
}): string {
  const { b, type, pillar } = a;
  const spine = (type.spine && b.styleSpines?.[type.spine]) || undefined;
  const palette = b.palette?.canvas ?? [];
  const accent = palette.find((c) => c.name === "Clay") ?? palette[3];

  // STATIC PREFIX — identical across every ask for this brand.
  const lines: string[] = [
    `You are rendering one marketing image for ${b.mediaName} (${b.domain}).`,
    "",
    `WHAT IT IS: ${b.what}`,
    `WHO SEES IT: ${b.audience}`,
    `TONE: ${b.tone}`,
  ];

  if (b.region?.items?.length) {
    lines.push("", "SETTING — the most common way a render fails:");
    lines.push(...b.region.items.map((i) => `- ${i}`));
  }

  if (palette.length) {
    lines.push(
      "",
      "PALETTE — quote these hex values, do not approximate:",
      ...palette.map((c) => `  ${c.hex} (${c.name}) — ${c.use}`),
    );
    if (accent) lines.push(`  One accent only: ${accent.hex}. Everything else stays neutral.`);
  }

  if (b.negative?.items?.length) {
    lines.push("", "NEVER:");
    lines.push(...b.negative.items.map((i) => `- ${i}`));
  }

  // DYNAMIC SUFFIX — what changes per ask.
  lines.push("", "─────", "", `THIS IMAGE — ${a.assetType}${type.use ? `: ${type.use}` : ""}`);

  if (pillar) {
    lines.push(
      "",
      `WHY IT EXISTS: this accompanies a post on "${pillar.id}" (${pillar.pillar}).`,
      `The post's own brief: ${pillar.brief}`,
      "The image carries the same idea. It does not repeat the words — it never contains any.",
    );
  }

  lines.push("", `SCENE: ${a.scene}`);

  if (spine) lines.push("", `STYLE: ${spine.prompt}`);
  if (type.extra) lines.push(`CONSTRAINT: ${type.extra}`);

  lines.push(
    "",
    `SIZE: exactly ${a.size} pixels (${a.sizeFrom}).`,
    "No text, no lettering, no numerals, no logos, no watermarks anywhere in the image.",
    "Leave the bottom-start corner quiet for a mark placed in post.",
  );

  if (a.attachments.length) {
    lines.push("", `ATTACH THESE ${a.attachments.length} FILE(S) BEFORE SENDING — the model cannot fetch a URL:`);
    a.attachments.forEach((att, i) => {
      lines.push(`  ${i + 1}. ${att.label} — ${att.why}`);
    });
  }

  if (a.citedOnly.length) {
    lines.push(
      "",
      "REFERENCES (for direction, not attached — they are pages, not image files):",
      ...a.citedOnly.map((r) => `  - ${r.title}${r.note ? ` — ${r.note}` : ""}`),
    );
  }

  lines.push("", "Produce one image. If this brief would require text inside the image, say so instead of rendering it.");

  return lines.join("\n");
}

// ── the template lane ───────────────────────────────────────────────────────

/**
 * Types that carry copy do not get a raster prompt. Until the deck writer
 * lands, say plainly what the lane is and what produces the pixels — the same
 * shape the video branch already uses rather than inventing something.
 */
function templateBrief(
  b: KitBrand,
  assetType: string,
  scene: string,
  size: string,
  pillar?: Pillar,
): string {
  const archetype: Record<string, string> = {
    infographic: "grid (4–6 cells, optional centre hub)",
    testimonial: "quote (text + attribution)",
    split: "split (beforeLabel / afterLabel)",
    og: "a single cover slide",
    banner: "a single cover slide",
    carousel: "cover → point… → stat or quote → cta",
  };
  const lines = [
    `${assetType} carries copy, so it renders on the deterministic template lane —`,
    `the carousel engine, in Thmanyah type at exactly ${size}. It does not go to an`,
    "image model: AI typography breaks, and Arabic script doubly so.",
    "",
    `Archetype: ${archetype[assetType] ?? assetType}`,
    `Brand: ${b.mediaName} (${b.domain})`,
    `Subject: ${scene}`,
  ];
  if (pillar) lines.push(`Post it accompanies: ${pillar.id} — ${pillar.pillar}`);
  lines.push(
    "",
    "The deck's Arabic is written, never translated, so a session writes the copy.",
    "Then render locally — the renderer needs a dev server on 3000 and system Chrome:",
    `  pnpm carousel:render ${b.id}/<slug> --sizes ${size}`,
  );
  return lines.join("\n");
}
