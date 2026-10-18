import "server-only";

import { requireContributor } from "@/lib/auth-guard";
import { db } from "@/lib/db";

import type { SeekEvent, SeekItem } from "./item";
import { toPulse, type Pulse } from "./public";
import { TRACKS } from "./tracks/registry";

// Console reads from the Neon mirror the Mac pushes (scripts/seek/push.ts).
// Everything but the pulse is contributor-only: the mirror holds one person's
// pipeline, notes and contacts.

export interface LoopState {
  sendOff?: boolean;
  pausedLanes?: string[];
  lanes?: string[];
  dailyCap?: number;
  dailyTotalCap?: number;
  vetoHours?: number;
  focus?: { lanes: string[]; countries: string[]; until: string } | null;
  week?: {
    date: string;
    headline?: string;
    // The weekly step writes strings, older weeks objects — render either.
    learned?: unknown[];
    actions?: unknown[];
    needFromYou?: unknown[];
  } | null;
}

export interface ConsoleInstance {
  id: string;
  lastTickAt: string | null;
  state: LoopState;
}

export interface PendingCommand {
  id: string;
  kind: string;
  externalId: string | null;
  createdAt: string;
}

async function guard(): Promise<void> {
  if (!(await requireContributor())) throw new Error("Forbidden: contributors only.");
}

// SEEK_INSTANCE pins one; otherwise the loop that ticked last.
export async function resolveInstance(): Promise<ConsoleInstance | null> {
  const pinned = process.env.SEEK_INSTANCE?.trim();
  const row = await db.seekInstance.findFirst({
    where: pinned ? { id: pinned } : undefined,
    orderBy: { lastTickAt: "desc" },
  });
  if (!row) return null;
  return { id: row.id, lastTickAt: row.lastTickAt?.toISOString() ?? null, state: row.state as LoopState };
}

const iso = (d: Date | null): string | null => d?.toISOString() ?? null;

function toItem(r: Awaited<ReturnType<typeof db.seekItem.findMany>>[number]): SeekItem {
  return {
    instance: r.instance,
    track: r.track as SeekItem["track"],
    externalId: r.externalId,
    lane: r.lane,
    stage: r.stage,
    tier: r.tier,
    score: r.score,
    title: r.title,
    org: r.org,
    country: r.country,
    city: r.city,
    remote: r.remote,
    channel: r.channel,
    beneficiary: r.beneficiary,
    deadline: r.deadline,
    touch: r.touch,
    appliedAt: iso(r.appliedAt),
    lastTouchAt: iso(r.lastTouchAt),
    holdReason: r.holdReason,
    sourceUrl: r.sourceUrl,
    recordUrl: r.recordUrl,
    notes: r.notes,
    updatedAt: r.sourceUpdatedAt.toISOString(),
  };
}

// Notes are left out: they can run to kilobytes a card and every view ships
// its items to the client. The sheet loads one card's notes when opened.
export async function listItems(instance: string, track?: string): Promise<SeekItem[]> {
  await guard();
  const rows = await db.seekItem.findMany({
    where: { instance, ...(track ? { track } : {}) },
    omit: { notes: true },
    orderBy: [{ score: "desc" }, { sourceUpdatedAt: "desc" }],
  });
  return rows.map((r) => toItem({ ...r, notes: null }));
}

export async function getNotes(instance: string, externalId: string): Promise<string | null> {
  await guard();
  const row = await db.seekItem.findUnique({
    where: { instance_externalId: { instance, externalId } },
    select: { notes: true },
  });
  return row?.notes ?? null;
}

export async function listEvents(instance: string, days = 30): Promise<SeekEvent[]> {
  await guard();
  const rows = await db.seekEvent.findMany({
    where: { instance, ts: { gte: new Date(Date.now() - days * 86_400_000) } },
    orderBy: { ts: "desc" },
    take: 1000,
  });
  return rows.map((e) => ({
    instance: e.instance,
    ts: e.ts.toISOString(),
    kind: e.kind,
    externalId: e.externalId || null,
    title: e.title,
    lane: e.lane,
    detail: e.detail,
  }));
}

export async function listPending(instance: string): Promise<PendingCommand[]> {
  await guard();
  const rows = await db.seekCommand.findMany({
    where: { instance, status: "pending" },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((c) => ({ id: c.id, kind: c.kind, externalId: c.externalId, createdAt: c.createdAt.toISOString() }));
}

export async function listRecentCommands(instance: string, take = 20) {
  await guard();
  const rows = await db.seekCommand.findMany({
    where: { instance },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((c) => ({
    id: c.id,
    kind: c.kind,
    externalId: c.externalId,
    status: c.status,
    by: c.by,
    result: c.result,
    createdAt: c.createdAt.toISOString(),
  }));
}

// Public: counts only (see public.ts). Never call the guarded reads from here.
export async function getPulse(): Promise<Pulse | null> {
  try {
    const instance = await resolveInstance();
    if (!instance) return null;
    const [items, events] = await Promise.all([
      db.seekItem.findMany({ where: { instance: instance.id } }),
      db.seekEvent.findMany({
        where: { instance: instance.id, ts: { gte: new Date(Date.now() - 7 * 86_400_000) } },
      }),
    ]);
    return toPulse(
      items.map(toItem),
      events.map((e) => ({ ...e, ts: e.ts.toISOString(), externalId: e.externalId || null })),
      TRACKS,
      instance.lastTickAt,
    );
  } catch {
    // The public page must render without the database.
    return null;
  }
}
