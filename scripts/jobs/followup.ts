#!/usr/bin/env tsx
// ── Follow-ups: the stall clock for APPLIED cards ────────────────────────────
//
//   pnpm jobs:followup              dry run
//   pnpm jobs:followup --apply      send due follow-ups, archive the silent
//
// Day 7 and day 14 get a short templated nudge in the same thread ("Re: …");
// day 21 with nothing back archives the card. Templated touches may go out
// unattended (funnel rule); they share the kill switch and window with the
// wave, and have their own daily cap. A card that got any reply is no longer
// APPLIED, so it never reaches this script.

import { existsSync, readFileSync } from "node:fs";

import { decideFollowUp } from "@/lib/jobs/cadence";

import { ledger, listBoard, noteRow } from "./board";
import { kigaliNow, killSwitchOn, loadConfig } from "./config";
import { mailSend, sentToday } from "./send";
import { pickFollowUp } from "./variants";
import { splitName } from "./wave";

const APPLY = process.argv.includes("--apply");

interface Sent {
  kind: string;
  crmId: string;
  to?: string;
  subject?: string;
  ts: string;
}

function render(
  templatePath: string,
  vars: Record<string, string>,
): { subject: string; body: string } {
  const raw = readFileSync(templatePath, "utf-8");
  const subjectLine = raw.match(/^Subject:\s*(.+)$/m)?.[1] ?? "Re: {subject}";
  const body = raw.split(/^Subject:.*$/m)[1]?.trim() ?? "";
  const fill = (s: string) =>
    s.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
  return { subject: fill(subjectLine), body: fill(body) };
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const { date, hour, weekday } = kigaliNow();
  const now = new Date();

  const ledgerLines: Sent[] = existsSync("jobs/ledger.jsonl")
    ? readFileSync("jobs/ledger.jsonl", "utf-8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Sent)
    : [];
  const original = new Map(
    ledgerLines.filter((e) => e.kind === "sent").map((e) => [e.crmId, e]),
  );

  const board = await listBoard();
  const applied = board.filter(
    (r) => r.applicationStatus === "APPLIED" && r.appliedAt,
  );
  const inWindow =
    cfg.sendDays.includes(weekday) &&
    hour >= cfg.windowFrom &&
    hour < cfg.windowTo;
  let budget = Math.max(0, cfg.followUpCap - sentToday("followup", date));

  console.log(
    `${APPLY ? "" : "DRY RUN — "}${applied.length} APPLIED card(s) · follow-up budget ${budget} · window ${inWindow ? "open" : "closed"}\n`,
  );

  for (const row of applied) {
    const action = decideFollowUp({
      appliedAt: row.appliedAt,
      touchNumber: row.touchNumber,
      replied: false,
      now,
    });
    if (action === "none") continue;

    if (action === "archive") {
      console.log(`  archive   ${row.name.slice(0, 60)} (21 days, no reply)`);
      if (APPLY) {
        await noteRow(row.id, "archived — 21 days, three touches, no reply", {
          applicationStatus: "ARCHIVED",
        });
        ledger({
          kind: "archive",
          crmId: row.id,
          name: row.name,
          campaign: row.campaign,
        });
      }
      continue;
    }

    const first = original.get(row.id);
    if (!first?.to || !first.subject) {
      console.log(
        `  skip      ${row.name.slice(0, 60)} — no sent record in the ledger (applied by hand?)`,
      );
      continue;
    }
    // A WhatsApp application lives in Abdout's chat, where a templated nudge
    // from a bot reads worse than silence: he follows those up by hand.
    if (first.to.startsWith("+")) {
      console.log(
        `  skip      ${row.name.slice(0, 60)} — applied on WhatsApp, follow up in the chat`,
      );
      continue;
    }
    const touch = action === "touch2" ? 2 : 3;
    const variant = pickFollowUp(touch);
    if (!variant?.template) continue;
    const { role, company } = splitName(row.name);
    const msg = render(variant.template, {
      company,
      role,
      subject: first.subject,
      appliedDate: new Date(row.appliedAt as string).toISOString().slice(0, 10),
    });
    if (/\{\w+\}/.test(msg.subject + msg.body)) {
      console.log(
        `  skip      ${row.name.slice(0, 60)} — unfilled template slot`,
      );
      continue;
    }
    console.log(`  touch ${touch}   ${row.name.slice(0, 60)} → ${first.to}`);
    if (!APPLY) continue;
    if (killSwitchOn() || !inWindow || budget <= 0) {
      console.log(
        `            held: ${killSwitchOn() ? "kill switch" : !inWindow ? "outside window" : "cap reached"}`,
      );
      continue;
    }
    const err = mailSend(cfg.fromAccount, first.to, msg.subject, msg.body);
    if (err) {
      console.log(`            ✗ ${err}`);
      ledger({
        kind: "error",
        crmId: row.id,
        name: row.name,
        detail: `follow-up: ${err}`,
      });
      continue;
    }
    await noteRow(row.id, `follow-up ${touch} sent (${variant.id})`, {
      touchNumber: touch,
      lastTouchAt: now.toISOString(),
    });
    ledger({
      kind: "followup",
      crmId: row.id,
      name: row.name,
      campaign: row.campaign,
      variant: variant.id,
      subject: msg.subject,
      to: first.to,
    });
    budget--;
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
