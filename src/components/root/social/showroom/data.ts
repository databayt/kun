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
}

export interface ShowroomData {
  assets: ShowroomAsset[];
  brands: string[];
  generatedCount: number;
  referenceCount: number;
}

export function getShowroomData(): ShowroomData {
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
      model: null,
      ratio: null,
      credits: null,
      createdAt: null,
    }),
  );

  const assets = [...generated, ...refs];
  const brands = [
    ...new Set(assets.map((a) => a.brand).filter(Boolean)),
  ].sort() as string[];

  return {
    assets,
    brands,
    generatedCount: generated.length,
    referenceCount: refs.length,
  };
}
