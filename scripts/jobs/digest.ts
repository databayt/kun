#!/usr/bin/env tsx
// ── The morning digest: what goes out today, what needs Abdout ───────────────
//
//   pnpm jobs:digest            print (Hermes' 07:30 script cron delivers stdout)
//   pnpm jobs:digest --send     push it through `hermes send` directly
//
// Zero tokens. Written for a phone screen: the QUEUED wave with board links
// (move a card to Hold before 10:00 to stop it), the HOLD cards with the one
// thing each needs, deadlines inside 72h, and yesterday's numbers.

import { existsSync, readFileSync } from "node:fs";

import { BoardRow, boardUrl, listBoard } from "./board";
import { kigaliNow, killSwitchOn, loadConfig, seniorityBand, todaysCap } from "./config";
import { notify } from "./notify";

const short = (r: BoardRow): string =>
  r.name
    .replace(/\s*\(.*?\)\s*/g, " ")
    .slice(0, 70)
    .trim();

async function main(): Promise<void> {
  const cfg = loadConfig();
  const { date } = kigaliNow();
  const board = await listBoard();
  const by = (s: string) => board.filter((r) => r.applicationStatus === s);

  const yesterday = new Date(Date.now() - 86_400_000)
    .toISOString()
    .slice(0, 10);
  const events = existsSync("jobs/ledger.jsonl")
    ? readFileSync("jobs/ledger.jsonl", "utf-8")
        .split("\n")
        .filter(Boolean)
        .map(
          (l) => JSON.parse(l) as { kind: string; ts: string; detail?: string },
        )
        .filter((e) => e.ts.slice(0, 10) >= yesterday)
    : [];
  const count = (k: string, pred: (d: string) => boolean = () => true) =>
    events.filter((e) => e.kind === k && pred(e.detail ?? "")).length;

  const soon = board
    .filter((r) =>
      ["TO_APPLY", "HOLD", "QUEUED", "APPROVED"].includes(
        r.applicationStatus ?? "",
      ),
    )
    .filter(
      (r) =>
        r.deadline &&
        r.deadline.slice(0, 10) >= date &&
        r.deadline.slice(0, 10) <=
          new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
    )
    .sort((a, b) => (a.deadline as string).localeCompare(b.deadline as string));

  const lines: string[] = [];
  lines.push(
    `*Jobs — ${date}*${killSwitchOn() ? "  ⛔ sending paused (jobs/.send-off)" : ""}`,
  );
  lines.push(
    `Last 24h: ${count("sent")} sent · ${count("followup")} follow-ups · ${count("reply", (d) => !d.startsWith("ack"))} replies (${count("reply", (d) => d.startsWith("interview"))} interview, ${count("reply", (d) => d.startsWith("offer"))} offer)`,
  );
  lines.push(
    `Board: ${by("APPLIED").length} applied · ${by("RESPONSE").length + by("INTERVIEW").length} in conversation · ${by("OFFER").length} offers · ${by("TO_APPLY").length} to apply`,
  );

  const queued = [...by("QUEUED"), ...by("APPROVED")];
  if (queued.length) {
    lines.push(
      `\n*Sends at ${cfg.sendHour}:00 (cap ${todaysCap(cfg, date)}) — move to Hold to stop:*`,
    );
    for (const r of queued.slice(0, 12))
      lines.push(`• ${short(r)} — <${boardUrl(r.id)}|card>`);
  }
  // Portal packets (Ashby/Lever block automated submits) are their own list:
  // they need a two-minute paste, not a decision.
  const packets = by("HOLD").filter((r) => /paste-ready packet/.test(r.holdReason ?? ""));
  if (packets.length) {
    lines.push(`\n*Paste & submit (${packets.length} portal packets in jobs/packets/ats) — best first:*`);
    for (const r of packets
      .sort(
        (a, b) =>
          seniorityBand(a.name) - seniorityBand(b.name) ||
          (b.engineScore ?? 0) - (a.engineScore ?? 0),
      )
      .slice(0, 6)) {
      lines.push(`• ${short(r)} — ${r.applyUrl ?? ""}`);
    }
  }
  const hold = by("HOLD").filter((r) => !/paste-ready packet/.test(r.holdReason ?? ""));
  if (hold.length) {
    lines.push(`\n*Needs you (${hold.length}) — fix, then move to Approved:*`);
    for (const r of hold.slice(0, 10))
      lines.push(
        `• ${short(r)} — ${(r.holdReason ?? "").slice(0, 120)} <${boardUrl(r.id)}|card>`,
      );
  }
  if (soon.length) {
    lines.push(`\n*Deadlines ≤72h:*`);
    for (const r of soon.slice(0, 8))
      lines.push(
        `• ${r.deadline?.slice(0, 10)} ${short(r)} (${r.channel ?? "direct"})`,
      );
  }
  const manual = board
    .filter(
      (r) =>
        r.applicationStatus === "TO_APPLY" &&
        r.channel &&
        r.channel !== "EMAIL" &&
        !cfg.pausedLanes.includes(r.campaign ?? ""),
    )
    .sort((a, b) => (b.engineScore ?? 0) - (a.engineScore ?? 0))
    .slice(0, 5);
  if (manual.length) {
    lines.push(`\n*Apply by hand (packets in jobs/packets):*`);
    for (const r of manual)
      lines.push(`• ${short(r)} — ${r.channel?.toLowerCase()}`);
  }

  // Freelance is one Upwork job a day, picked and drafted by Cowork in
  // Abdout's logged-in browser (Upwork blocks bots); Abdout submits.
  const upwork = `jobs/packets/upwork/${date}.md`;
  if (existsSync(upwork)) {
    const url = readFileSync(upwork, "utf-8").match(/https:\/\/www\.upwork\.com\/[^\s)>\]]+/)?.[0];
    lines.push(`\n*Upwork pick of the day:* proposal ready in ${upwork}${url ? ` — ${url}` : ""}`);
  } else {
    lines.push(`\n*Upwork pick of the day:* not drafted yet (Cowork routine)`);
  }

  const text = lines.join("\n");
  if (process.argv.includes("--send")) notify(text, `Jobs — ${date}`);
  else console.log(text);
}

main().catch((err: unknown) => {
  // Hermes delivers stdout: say the board was unreachable instead of posting nothing.
  console.log(
    `Jobs digest: board unreachable — ${err instanceof Error ? err.message.slice(0, 160) : err}`,
  );
  process.exit(0);
});
