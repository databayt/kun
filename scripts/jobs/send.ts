#!/usr/bin/env tsx
// ── Send the wave: QUEUED/APPROVED cards → Mail.app (hotmail) → APPLIED ──────
//
//   pnpm jobs:send                         dry run — what would go out now
//   pnpm jobs:send --apply --limit 5       send (inside the window, under the cap)
//   pnpm jobs:send --apply --to-self       send the first letter to yourself, board untouched
//
// Auto-send is Abdout's choice (2026-09-27), so the guards live here:
//   kill switch  jobs/.send-off or JOBS_SEND=off → nothing leaves
//   window       Mon–Fri 09:00–17:00 Kigali
//   cap          5/day during the ramp, then 10 — counted from the ledger
//   veto         every card is re-read right before its send; a card moved off
//                QUEUED/APPROVED since the wave was prepared is skipped
//   one per company per run
// APPROVED is Abdout's yes on a HOLD card: the gate is re-run without the
// "needs" checks (he has decided those), but every hard check still applies.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { evaluateSendGate, holdReasonFor } from "@/lib/jobs/send-gate";

import {
  BoardRow,
  getRow,
  ledger,
  listBoard,
  noteRow,
  patchRow,
} from "./board";
import { kigaliNow, killSwitchOn, loadConfig, todaysCap } from "./config";
import { openDb } from "./engine";
import { notify } from "./notify";
import { pdfPages, postingText, recentlyContacted, splitName } from "./wave";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const TO_SELF = args.includes("--to-self");
const limitArg = args.indexOf("--limit");

interface Letter {
  to: string;
  subject: string;
  body: string;
}

interface Request {
  crmId: string;
  cvPdf: string;
  cvVariant: string;
  letterVariant: string;
}

/// The newest letter written for a card, across wave folders.
export function findLetter(
  crmId: string,
): { letter: Letter; req: Request; dir: string } | null {
  if (!existsSync("jobs/outbox")) return null;
  for (const wave of readdirSync("jobs/outbox").sort().reverse()) {
    const dir = join("jobs/outbox", wave);
    const lp = join(dir, `${crmId}.letter.json`);
    const rp = join(dir, `${crmId}.request.json`);
    if (existsSync(lp) && existsSync(rp)) {
      return {
        letter: JSON.parse(readFileSync(lp, "utf-8")) as Letter,
        req: JSON.parse(readFileSync(rp, "utf-8")) as Request,
        dir,
      };
    }
  }
  return null;
}

export function sentToday(kind: "sent" | "followup", date: string): number {
  if (!existsSync("jobs/ledger.jsonl")) return 0;
  return readFileSync("jobs/ledger.jsonl", "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { kind: string; ts: string })
    .filter(
      (e) =>
        e.kind === kind &&
        new Date(new Date(e.ts).getTime() + 2 * 3_600_000)
          .toISOString()
          .slice(0, 10) === date,
    ).length;
}

/// One email through Mail.app. Returns null on success, the error otherwise.
export function mailSend(
  from: string,
  to: string,
  subject: string,
  body: string,
  attachment?: string,
): string | null {
  const bodyFile = join("jobs/outbox", `.body-${process.pid}.txt`);
  writeFileSync(bodyFile, body);
  const res = spawnSync(
    "osascript",
    [
      "scripts/jobs/mail-send.applescript",
      from,
      to,
      subject,
      bodyFile,
      ...(attachment ? [attachment] : []),
    ],
    { encoding: "utf-8", timeout: 120_000 },
  );
  spawnSync("rm", ["-f", bodyFile]);
  return res.status === 0
    ? null
    : (res.stderr || res.stdout || `osascript exit ${res.status}`).trim();
}

async function markNeonApplied(crmId: string): Promise<void> {
  try {
    const db = openDb();
    await db.jobOpportunity.updateMany({
      where: { twentyOpportunityId: crmId },
      data: { status: "applied" },
    });
    await db.$disconnect();
  } catch (err) {
    console.log(
      `  (Neon not updated: ${err instanceof Error ? err.message.slice(0, 120) : err})`,
    );
  }
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const { date, hour, weekday } = kigaliNow();

  if (killSwitchOn()) {
    console.log(
      "kill switch on (jobs/.send-off or JOBS_SEND=off) — nothing sent",
    );
    return;
  }

  const board = await listBoard();
  const ready = board.filter(
    (r) =>
      r.applicationStatus === "QUEUED" || r.applicationStatus === "APPROVED",
  );

  if (TO_SELF) {
    const first = ready
      .map((r) => ({ r, l: findLetter(r.id) }))
      .find((x) => x.l);
    if (!first?.l) {
      console.log("no prepared letter to test with — run pnpm jobs:wave first");
      return;
    }
    const err = mailSend(
      cfg.fromAccount,
      cfg.fromAccount,
      `[TEST] ${first.l.letter.subject}`,
      first.l.letter.body,
      first.l.req.cvPdf,
    );
    console.log(
      err
        ? `✗ test send failed: ${err}`
        : `✓ test sent to ${cfg.fromAccount} (${first.r.name}) — board untouched`,
    );
    return;
  }

  const inWindow =
    cfg.sendDays.includes(weekday) &&
    hour >= cfg.windowFrom &&
    hour < cfg.windowTo;
  const cap = todaysCap(cfg, date);
  const remaining = Math.max(0, cap - sentToday("sent", date));
  const limit = Math.min(
    remaining,
    limitArg > -1 ? Number(args[limitArg + 1]) : remaining,
  );

  console.log(
    `${APPLY ? "" : "DRY RUN — "}${ready.length} ready · cap ${cap}/day · ${remaining} left today · window ${inWindow ? "open" : "closed"}\n`,
  );
  if (APPLY && !inWindow) {
    console.log(
      "outside the send window (Mon–Fri 09:00–17:00 Kigali) — nothing sent",
    );
    return;
  }
  if (APPLY && limitArg < 0) {
    console.log("--apply needs --limit (the loop passes it) — nothing sent");
    return;
  }

  const facts = JSON.parse(readFileSync("jobs/facts.json", "utf-8")) as {
    numbers: string[];
  };
  const queuedTimes = new Map<string, number>();
  if (existsSync("jobs/ledger.jsonl")) {
    for (const l of readFileSync("jobs/ledger.jsonl", "utf-8").split("\n").filter(Boolean)) {
      const e = JSON.parse(l) as { kind: string; crmId: string; ts: string };
      if (e.kind === "queued") queuedTimes.set(e.crmId, new Date(e.ts).getTime());
    }
  }
  const companies = new Set<string>();
  let sent = 0;

  for (const row of ready) {
    if (sent >= limit) break;
    const { role, company } = splitName(row.name);
    if (companies.has(company.toLowerCase())) continue;

    const found = findLetter(row.id);
    if (!found) {
      console.log(
        `  · ${row.name.slice(0, 60)} — no letter yet (next wave writes it)`,
      );
      continue;
    }

    // The veto: Abdout may have moved the card since the wave was prepared.
    const fresh: BoardRow = await getRow(row.id);
    if (
      fresh.applicationStatus !== "QUEUED" &&
      fresh.applicationStatus !== "APPROVED"
    ) {
      console.log(
        `  · ${row.name.slice(0, 60)} — moved to ${fresh.applicationStatus}, skipped`,
      );
      continue;
    }

    const approved = fresh.applicationStatus === "APPROVED";
    // The veto window: a QUEUED card must have sat on the board (and in the
    // digest) for vetoHours before it can go — a Mac that woke late does not
    // get to prepare and send in the same tick. APPROVED is already a yes.
    const queuedAt = queuedTimes.get(row.id);
    if (!approved && queuedAt && Date.now() - queuedAt < cfg.vetoHours * 3_600_000) {
      console.log(`  · ${row.name.slice(0, 60)} — queued ${Math.round((Date.now() - queuedAt) / 60_000)} min ago, veto window open`);
      continue;
    }
    const verdict = evaluateSendGate({
      letter: found.letter,
      company,
      role,
      postingText: await postingText(fresh.jobUrl?.primaryLinkUrl),
      deadline: fresh.deadline?.slice(0, 10) ?? null,
      today: date,
      recentlyContacted: recentlyContacted(fresh, board),
      allowedNumbers: facts.numbers,
      attachment: {
        exists: existsSync(found.req.cvPdf),
        pages: pdfPages(found.req.cvPdf),
      },
    });
    const blocking = approved
      ? verdict.hard.filter((h) => h !== "posting unreachable")
      : [...verdict.hard, ...verdict.needs];
    if (blocking.length) {
      const reason = approved ? blocking.join("; ") : holdReasonFor(verdict);
      console.log(`  ✗ ${row.name.slice(0, 60)} → HOLD: ${reason}`);
      if (APPLY) {
        await patchRow(row.id, {
          applicationStatus: "HOLD",
          holdReason: reason.slice(0, 480),
        });
        ledger({
          kind: "hold",
          crmId: row.id,
          name: row.name,
          campaign: row.campaign,
          detail: reason,
        });
      }
      continue;
    }

    console.log(`  → ${found.letter.to.padEnd(30)} ${row.name.slice(0, 60)}`);
    if (!APPLY) {
      companies.add(company.toLowerCase());
      sent++;
      continue;
    }

    const err = mailSend(
      cfg.fromAccount,
      found.letter.to,
      found.letter.subject,
      found.letter.body,
      found.req.cvPdf,
    );
    if (err) {
      console.log(`    ✗ send failed: ${err}`);
      await patchRow(row.id, {
        holdReason: `send failed: ${err}`.slice(0, 480),
      });
      ledger({ kind: "error", crmId: row.id, name: row.name, detail: err });
      notify(`Send failed for ${row.name}: ${err}`, "Jobs — send error");
      continue;
    }

    const now = new Date().toISOString();
    const variant = `${found.req.cvVariant} ${found.req.letterVariant}`;
    await noteRow(
      row.id,
      `sent to ${found.letter.to} — "${found.letter.subject}" (${variant})`,
      {
        applicationStatus: "APPLIED",
        appliedAt: now,
        lastTouchAt: now,
        touchNumber: 1,
        holdReason: "",
        variant,
      },
    );
    ledger({
      kind: "sent",
      crmId: row.id,
      name: row.name,
      campaign: row.campaign,
      variant,
      waveId: fresh.waveId ?? date,
      subject: found.letter.subject,
      to: found.letter.to,
    });
    await markNeonApplied(row.id);
    companies.add(company.toLowerCase());
    sent++;
  }

  console.log(
    `\n${APPLY ? `sent ${sent}` : `would send ${sent}`} (cap left today: ${remaining - (APPLY ? sent : 0)})`,
  );
}

if (process.argv[1]?.endsWith("send.ts")) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
