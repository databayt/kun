#!/usr/bin/env tsx
// ── Pull: apply what the web console queued ──────────────────────────────────
//
//   pnpm seek:pull            dry run: list the pending commands
//   pnpm seek:pull --apply    apply each, mark it applied/failed, re-push
//
// The web only enqueues (SeekCommand rows); this step does the work, through
// the loop's own tools, so every wall still holds: adopt.ts's hard limits for
// caps and lanes, the send gate for anything that sends. First step of every
// tick, ahead of the wave and the send, so a veto always beats the window.

import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

import { normalizeJobPosting } from "@/lib/jobs/normalizer";
import { seekCommandSchema, type SeekCommand } from "@/lib/seek/commands";
import { getTrack } from "@/lib/seek/tracks/registry";

import { apply as adopt } from "./adopt";
import { call, ledger, noteRow } from "./board";
import { openDb } from "./engine";
import { INSTANCE } from "./lib/console";
import { postingText } from "./lib/posting";
import { DATA } from "./lib/paths.mjs";
import { push } from "./push";

const APPLY = process.argv.includes("--apply");

type Db = ReturnType<typeof openDb>;

// Board patch for one card on whichever board its track lives on.
async function moveCard(
  db: Db,
  externalId: string,
  stage: string,
  line: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const item = await db.seekItem.findUnique({
    where: { instance_externalId: { instance: INSTANCE, externalId } },
  });
  if (!item) throw new Error(`no card ${externalId} in the mirror`);
  const track = getTrack(item.track as "job" | "funding");
  if (!track.stages?.some((s) => s.id === stage))
    throw new Error(`${track.id} has no stage ${stage}`);

  if (item.track === "funding") {
    await call(`/rest/fundingPrograms/${externalId}`, { method: "PATCH", body: { status: stage } });
  } else {
    await noteRow(externalId, line, { applicationStatus: stage, ...extra });
    ledger({
      kind: stage === "HOLD" ? "hold" : "console",
      crmId: externalId,
      name: item.org ? `${item.title} @ ${item.org}` : item.title,
      campaign: item.lane,
      detail: line,
    });
  }
  return `${item.stage} → ${stage}`;
}

async function ingest(c: Extract<SeekCommand, { kind: "ingest" }>): Promise<string> {
  const text = c.text || (await postingText(c.url));
  if (!text) throw new Error(`could not read ${c.url}`);
  const job = await normalizeJobPosting(text, c.url ? "url" : "manual", c.url);
  const today = new Date().toISOString().slice(0, 10);
  const file = `${DATA}/inbox/${today}-web.json`;
  mkdirSync(`${DATA}/inbox`, { recursive: true });
  const prior = existsSync(file) ? (JSON.parse(readFileSync(file, "utf-8")) as unknown[]) : [];
  const entry = { ...job, source: "console", sourceUrl: c.url ?? job.sourceUrl, campaign: c.lane };
  // ingest.ts reads every inbox file; score this one now rather than tomorrow.
  const one = `${DATA}/inbox/.web-${Date.now()}.json`;
  writeFileSync(one, JSON.stringify([entry], null, 2));
  const r = spawnSync("pnpm", ["-s", "seek:ingest", "--file", one], { encoding: "utf-8" });
  rmSync(one, { force: true });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout).slice(-300));
  writeFileSync(file, JSON.stringify([...prior, entry], null, 2));
  return `ingested "${job.title} @ ${job.company}"`;
}

async function run(db: Db, c: SeekCommand, by: string): Promise<string> {
  switch (c.kind) {
    case "approve":
      return moveCard(db, c.externalId, "APPROVED", `approved from the console by ${by}`, { holdReason: null });
    case "hold":
      return moveCard(db, c.externalId, "HOLD", `held from the console: ${c.reason}`, { holdReason: c.reason });
    case "veto": {
      const reason = c.reason || "vetoed from the console";
      return moveCard(db, c.externalId, "HOLD", `vetoed before send: ${reason}`, { holdReason: reason });
    }
    case "move":
      return moveCard(db, c.externalId, c.stage, `moved from the console${c.note ? `: ${c.note}` : ""}`);
    case "send": {
      const off = `${DATA}/.send-off`;
      if (c.on) rmSync(off, { force: true });
      else writeFileSync(off, `${new Date().toISOString()} console (${by})\n`);
      return `send ${c.on ? "on" : "off"}`;
    }
    case "pauseLane": {
      const ch = adopt(
        { type: "pause", target: c.lane, value: c.paused ? "pause" : "resume", why: `console (${by})` },
        "console",
      );
      return `#${ch.n} ${c.lane} ${c.paused ? "paused" : "resumed"}`;
    }
    case "dailyCap": {
      const ch = adopt({ type: "cap", target: "dailyCap", value: c.n, why: `console (${by})` }, "console");
      return `#${ch.n} dailyCap ${ch.from ?? "default"} → ${c.n}`;
    }
    case "ingest":
      return ingest(c);
  }
}

async function main(): Promise<void> {
  const db = openDb();
  try {
    const pending = await db.seekCommand.findMany({
      where: { instance: INSTANCE, status: "pending" },
      orderBy: { createdAt: "asc" },
    });
    console.log(`${APPLY ? "" : "DRY RUN — "}${pending.length} pending command(s) for ${INSTANCE}`);
    for (const row of pending) {
      const parsed = seekCommandSchema.safeParse(row.payload);
      if (!APPLY) {
        console.log(`· ${row.kind} ${row.externalId ?? ""} by ${row.by}${parsed.success ? "" : " (invalid)"}`);
        continue;
      }
      let status: "applied" | "failed" = "applied";
      let result: string;
      try {
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "invalid payload");
        result = await run(db, parsed.data, row.by);
        console.log(`✓ ${row.kind} ${row.externalId ?? ""}: ${result}`);
      } catch (err) {
        status = "failed";
        result = err instanceof Error ? err.message : String(err);
        console.log(`✗ ${row.kind} ${row.externalId ?? ""}: ${result}`);
      }
      await db.seekCommand.update({
        where: { id: row.id },
        data: { status, result: result.slice(0, 1000), appliedAt: new Date() },
      });
    }
    // The console should see the result this tick, not the next one.
    if (APPLY && pending.length) await push(true);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
