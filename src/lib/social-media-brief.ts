// The media brief queue's data layer. The compile itself lives in brand-kit.ts,
// which imports nothing server-only so a test (and any client component that
// needs the type list) can reach it without dragging Prisma along.

import { compileBrief } from "@/lib/brand-kit";
import { db } from "@/lib/db";

export { chatgptTypes, compileBrief, brandKitBrands } from "@/lib/brand-kit";
export type { CompiledBrief } from "@/lib/brand-kit";

// ── the queue ───────────────────────────────────────────────────────────────

export interface BriefRow {
  id: string;
  brand: string;
  assetType: string;
  subject: string;
  prompt: string;
  size: string;
  status: string;
  renderedUrl: string | null;
  /** Feature id the asset shows, or null for a brand-wide asset. */
  feature: string | null;
  /** image | video */
  kind: string;
  createdAt: string;
}

const SELECT = {
  id: true,
  brand: true,
  assetType: true,
  subject: true,
  prompt: true,
  size: true,
  status: true,
  renderedUrl: true,
  feature: true,
  kind: true,
  createdAt: true,
} as const;

function toRow(r: {
  id: string;
  brand: string;
  assetType: string;
  subject: string;
  prompt: string;
  size: string;
  status: string;
  renderedUrl: string | null;
  feature: string | null;
  kind: string;
  createdAt: Date;
}): BriefRow {
  return { ...r, createdAt: r.createdAt.toISOString().slice(0, 10) };
}

export async function fileBrief(
  brand: string,
  assetType: string,
  subject: string,
): Promise<BriefRow> {
  const { prompt, size } = compileBrief(brand, assetType, subject);
  const row = await db.socialMediaBrief.create({
    data: { brand, assetType, subject, prompt, size },
    select: SELECT,
  });
  return toRow(row);
}

/**
 * A free-standing upload from the media team: no brief, no compiled prompt —
 * the asset already exists and is waiting on the shelf for a post. Filed
 * straight as `rendered` so it joins the library the moment it lands.
 */
export async function recordUpload(input: {
  brand: string;
  assetType: string;
  subject: string;
  feature: string | null;
  kind: "image" | "video";
  url: string;
  by: string;
  size?: string;
}): Promise<BriefRow> {
  const row = await db.socialMediaBrief.create({
    data: {
      brand: input.brand,
      assetType: input.assetType,
      subject: input.subject,
      prompt: "",
      size: input.size ?? "",
      feature: input.feature,
      kind: input.kind,
      status: "rendered",
      renderedUrl: input.url,
      renderedBy: input.by,
      renderedAt: new Date(),
    },
    select: SELECT,
  });
  return toRow(row);
}

/** Oldest first — a queue a person works through, not a feed. */
export async function listPendingBriefs(limit = 20): Promise<BriefRow[]> {
  const rows = await db.socialMediaBrief
    .findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: SELECT,
    })
    .catch(() => []);
  return rows.map(toRow);
}

/** Rendered work, newest first — these become showroom cards. */
export async function listRenderedBriefs(limit = 60): Promise<BriefRow[]> {
  const rows = await db.socialMediaBrief
    .findMany({
      where: { status: "rendered", renderedUrl: { not: null } },
      orderBy: { renderedAt: "desc" },
      take: limit,
      select: SELECT,
    })
    .catch(() => []);
  return rows.map(toRow);
}

export async function markRendered(
  id: string,
  url: string,
  by: string,
): Promise<void> {
  // status and renderedUrl move together — a `rendered` row with no URL would
  // read as done and deliver nothing.
  await db.socialMediaBrief.update({
    where: { id },
    data: {
      status: "rendered",
      renderedUrl: url,
      renderedBy: by,
      renderedAt: new Date(),
    },
  });
}

export async function dismissBrief(id: string, note?: string): Promise<void> {
  await db.socialMediaBrief.update({
    where: { id },
    data: { status: "dismissed", note: note ?? null },
  });
}
