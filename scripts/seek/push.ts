#!/usr/bin/env tsx
// ── Push: mirror the loop's state to Neon for the web console ────────────────
//
//   pnpm seek:push            dry run: what would be pushed
//   pnpm seek:push --apply    replace this instance's items, add new events,
//                             stamp the tick
//
// Cloudflare can't reach the CRM on this Mac, so the console reads a mirror:
// both boards through their adapters, the last 60 days of the ledger, the
// latest week report and the switches. The board stays the record — a push
// replaces the mirror wholesale, so a card deleted in Twenty leaves the
// console too. Last step of every tick (loop.sh).

import { existsSync, readdirSync, readFileSync } from "node:fs";

import { fundingAdapter, type FundingProgramRow } from "@/lib/seek/adapters/twenty-funding";
import { kigaliAdapter } from "@/lib/seek/adapters/twenty-kigali";
import type { SeekEvent, SeekItem } from "@/lib/seek/item";

import { listBoard, type LedgerEvent } from "./board";
import { killSwitchOn, LANE_BAND, loadConfig } from "./config";
import { openDb } from "./engine";
import { listFunding } from "./funding";
import { INSTANCE } from "./lib/console";
import { DATA } from "./lib/paths.mjs";

const APPLY = process.argv.includes("--apply");
const EVENT_DAYS = 60;

const date = (s: string | null): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

export function readEvents(days = EVENT_DAYS): SeekEvent[] {
  const path = `${DATA}/ledger.jsonl`;
  if (!existsSync(path)) return [];
  const since = Date.now() - days * 86_400_000;
  const out: SeekEvent[] = [];
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    if (!line) continue;
    try {
      const e = JSON.parse(line) as LedgerEvent;
      if (!e.ts || Date.parse(e.ts) < since) continue;
      out.push({
        instance: INSTANCE,
        ts: e.ts,
        kind: e.kind,
        externalId: e.crmId ?? null,
        title: e.name ?? null,
        lane: e.campaign ?? null,
        detail: (e.detail ?? e.subject ?? null)?.slice(0, 500) ?? null,
      });
    } catch {
      // a torn last line from a crashed tick — skip it, keep the rest
    }
  }
  return out;
}

function latestWeek(): unknown {
  const dir = `${DATA}/learn`;
  if (!existsSync(dir)) return null;
  const last = readdirSync(dir).filter((f) => f.endsWith(".week.json")).sort().pop();
  if (!last) return null;
  return { date: last.slice(0, 10), ...JSON.parse(readFileSync(`${dir}/${last}`, "utf-8")) };
}

export function loopState(): Record<string, unknown> {
  const c = loadConfig();
  return {
    sendOff: killSwitchOn(),
    pausedLanes: c.pausedLanes ?? [],
    dailyCap: c.dailyCap,
    dailyTotalCap: c.dailyTotalCap,
    vetoHours: c.vetoHours,
    lanes: Object.keys(LANE_BAND),
    focus: c.focus ?? null,
    week: latestWeek(),
  };
}

const toRow = (i: SeekItem) => ({
  instance: i.instance,
  track: i.track,
  externalId: i.externalId,
  lane: i.lane,
  stage: i.stage,
  tier: i.tier,
  score: i.score,
  title: i.title,
  org: i.org,
  country: i.country,
  city: i.city,
  remote: i.remote,
  channel: i.channel,
  beneficiary: i.beneficiary,
  deadline: i.deadline,
  touch: i.touch,
  appliedAt: date(i.appliedAt),
  lastTouchAt: date(i.lastTouchAt),
  holdReason: i.holdReason,
  sourceUrl: i.sourceUrl,
  recordUrl: i.recordUrl,
  notes: i.notes?.slice(-8000) ?? null,
  sourceUpdatedAt: date(i.updatedAt) ?? new Date(),
});

export async function push(apply: boolean): Promise<{ items: number; events: number }> {
  const items = [
    ...(await listBoard()).map((r) => kigaliAdapter.toItem(r, INSTANCE)),
    ...((await listFunding()) as unknown as FundingProgramRow[]).map((r) =>
      fundingAdapter.toItem(r, INSTANCE),
    ),
  ];
  const events = readEvents();
  const state = loopState();

  console.log(
    `${apply ? "" : "DRY RUN — "}instance ${INSTANCE}: ${items.length} items, ${events.length} events (${EVENT_DAYS}d), send ${state.sendOff ? "OFF" : "on"}`,
  );
  if (!apply) return { items: items.length, events: events.length };

  const db = openDb();
  try {
    // Send only what changed. The first version replaced the whole mirror in
    // one transaction (~1 MB of rows); from the launchd tick it ran 208 s over
    // the Neon websocket and expired (2026-10-18). A card's Twenty updatedAt
    // moves on every edit, so it is the change signal.
    const have = new Map(
      (
        await db.seekItem.findMany({
          where: { instance: INSTANCE },
          select: { externalId: true, sourceUpdatedAt: true },
        })
      ).map((r) => [r.externalId, r.sourceUpdatedAt.getTime()]),
    );
    const rows = items.map(toRow);
    const fresh = rows.filter((r) => !have.has(r.externalId));
    const changed = rows.filter(
      (r) => have.has(r.externalId) && have.get(r.externalId) !== r.sourceUpdatedAt.getTime(),
    );
    const live = new Set(rows.map((r) => r.externalId));
    const gone = [...have.keys()].filter((id) => !live.has(id));

    for (let i = 0; i < fresh.length; i += 100)
      await db.seekItem.createMany({ data: fresh.slice(i, i + 100), skipDuplicates: true });
    for (const r of changed)
      await db.seekItem.update({
        where: { instance_externalId: { instance: INSTANCE, externalId: r.externalId } },
        data: r,
      });
    if (gone.length)
      await db.seekItem.deleteMany({ where: { instance: INSTANCE, externalId: { in: gone } } });

    // Ledger lines only ever append: send the ones newer than the newest stored.
    const last = await db.seekEvent.findFirst({
      where: { instance: INSTANCE },
      orderBy: { ts: "desc" },
      select: { ts: true },
    });
    const newer = events.filter((e) => !last || Date.parse(e.ts) >= last.ts.getTime());
    const { count } = await db.seekEvent.createMany({
      data: newer.map((e) => ({ ...e, ts: new Date(e.ts), externalId: e.externalId ?? "" })),
      skipDuplicates: true,
    });
    await db.seekInstance.upsert({
      where: { id: INSTANCE },
      create: { id: INSTANCE, lastTickAt: new Date(), state: state as object },
      update: { lastTickAt: new Date(), state: state as object },
    });
    console.log(
      `✓ pushed ${fresh.length} new, ${changed.length} changed, ${gone.length} removed of ${items.length} items; ${count} new events`,
    );
  } finally {
    await db.$disconnect();
  }
  return { items: items.length, events: events.length };
}

if (process.argv[1]?.endsWith("push.ts")) {
  push(APPLY).catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
