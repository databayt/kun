// The showroom's read layer: both registries statically imported (git-tracked
// JSON — a commit redeploys the page, no fs, no DB), normalized into one card
// shape. `library.json` is written by scripts/higgs-library.mjs at generation
// time; `references.json` is curated by hand or by a session.

import library from "../../../../../content/media/library.json";
import references from "../../../../../content/media/references.json";
import {
  ASSET_TYPES,
  OTHER_TYPE,
  type AssetType,
  type ShowroomType,
} from "./taxonomy";

export interface ShowroomAsset {
  id: string;
  kind: "generated" | "reference";
  title: string;
  /** Renderable image URL; null renders the typed placeholder tile. */
  imageUrl: string | null;
  /** Where "Open" goes — the asset itself, or the reference's source page. */
  href: string;
  brand: string | null;
  type: ShowroomType;
  source: string;
  note: string | null;
  /**
   * Which question a reference card answers — `arabic-type`,
   * `arabic-newsroom`, `competitor-sms`, `mena-edtech`, `ad-formats`,
   * `house-aesthetic`. Null on every generated asset: a thing we made is
   * grouped by brand and type, not by what it teaches.
   *
   * Distinct from `kind` (generated vs reference), which the grid used to call
   * "collection" before this field existed.
   */
  collection: string | null;
  model: string | null;
  ratio: string | null;
  credits: number | null;
  createdAt: string | null;
}

function asShowroomType(value: string | null | undefined): ShowroomType {
  return (ASSET_TYPES as readonly string[]).includes(value ?? "")
    ? (value as AssetType)
    : OTHER_TYPE;
}

interface LibraryAsset {
  id: string;
  file: string;
  brand: string;
  prompt: string | null;
  model: string | null;
  ratio: string | null;
  credits: number | null;
  createdAt: string;
  cdnUrl: string | null;
  assetType?: string | null;
  /** Which renderer made it. Absent on every row predating the field. */
  source?: string | null;
}

interface ReferenceCard {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  assetType: string;
  brand?: string;
  note: string;
  thumb?: string;
  /** Which question this card answers — see references.json's $comment. */
  collection?: string;
}

export interface ShowroomData {
  assets: ShowroomAsset[];
  brands: string[];
  generatedCount: number;
  referenceCount: number;
}

/**
 * A rendered brief is a generated asset — it just arrived through a phone
 * rather than a script, so it lives in the database instead of library.json
 * (a Vercel function cannot append to a git-tracked file). Mapping it into the
 * same card shape is what keeps the grid one grid.
 */
export function briefAsAsset(brief: {
  id: string;
  brand: string;
  assetType: string;
  subject: string;
  size: string;
  renderedUrl: string | null;
  createdAt: string;
}): ShowroomAsset {
  return {
    id: brief.id,
    kind: "generated",
    title: brief.subject.slice(0, 72),
    imageUrl: brief.renderedUrl,
    href: brief.renderedUrl ?? "#",
    brand: brief.brand,
    type: asShowroomType(brief.assetType),
    collection: null,
    source: "chatgpt",
    note: brief.subject,
    model: "gpt-image-2",
    ratio: brief.size,
    credits: null,
    createdAt: brief.createdAt,
  };
}

export function getShowroomData(extra: ShowroomAsset[] = []): ShowroomData {
  const generated: ShowroomAsset[] = (library.assets as LibraryAsset[])
    .filter((a) => a.cdnUrl)
    .map((a) => ({
      id: a.id,
      kind: "generated",
      // The date prefix repeats the createdAt badge; the slug after it is the name.
      title: a.file.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.\w+$/, ""),
      imageUrl: a.cdnUrl,
      href: a.cdnUrl as string,
      brand: a.brand || null,
      type: asShowroomType(a.assetType),
      collection: null,
      // Every asset used to come from Higgsfield, so the badge was a constant.
      // Now the ChatGPT seat lane renders too — read what the manifest recorded
      // and keep the old constant only as the fallback for untagged history.
      source: a.source ?? "higgsfield",
      note: a.prompt,
      model: a.model,
      ratio: a.ratio,
      credits: a.credits,
      createdAt: a.createdAt,
    }));

  const refs: ShowroomAsset[] = (references.references as ReferenceCard[]).map(
    (r) => ({
      id: r.id,
      kind: "reference",
      title: r.title,
      imageUrl: r.thumb ?? null,
      href: r.sourceUrl,
      brand: r.brand ?? null,
      type: asShowroomType(r.assetType),
      source: r.source,
      note: r.note,
      collection: r.collection ?? null,
      model: null,
      ratio: null,
      credits: null,
      createdAt: null,
    }),
  );

  // Seat-lane renders lead: they are the newest work and the reason someone
  // opens this page mid-week.
  const assets = [...extra, ...generated, ...refs];
  const brands = [
    ...new Set(assets.map((a) => a.brand).filter(Boolean)),
  ].sort() as string[];

  return {
    assets,
    brands,
    generatedCount: generated.length + extra.length,
    referenceCount: refs.length,
  };
}
