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
import {
  LANE_BAND,
  inFocus,
  kigaliNow,
  killSwitchOn,
  loadConfig,
  seniorityBand,
  todaysCap,
} from "./config";
import { fundingDue } from "./funding";
import { notify } from "./notify";
import { DATA } from "./lib/paths.mjs";

const short = (r: BoardRow): string =>
  r.name
    .replace(/\s*\(.*?\)\s*/g, " ")
    .slice(0, 70)
    .trim();

const band = (r: BoardRow): number => LANE_BAND[r.campaign ?? ""] ?? 9;

/// The one thing to do first. From 10-11 to 11-07 the digest listed 19 holds a
/// day and none moved, while one 3-minute Mercor interview held six cards and
/// a Meridial "all that's left" email sat unseen. One line, the biggest unlock:
/// an answer someone already sent beats any hold; then the hold that frees the
/// most cards in the fastest-paying lane.
function firstAsk(board: BoardRow[]): string | null {
  const answered = board
    .filter((r) => r.applicationStatus === "RESPONSE")
    .sort((a, b) => band(a) - band(b));
  if (answered.length)
    return `${answered.length} card(s) got an answer that needs you — start with ${short(answered[0])} <${boardUrl(answered[0].id)}|card>`;
  const groups = new Map<string, BoardRow[]>();
  for (const r of board) {
    const reason = r.holdReason ?? "";
    if (r.applicationStatus !== "HOLD" || !reason) continue;
    if (/paste-ready packet/.test(reason)) continue;
    const key = (
      reason.startsWith("Abdout:") ? reason.split(" — ")[0] : reason.split(";")[0]
    )
      .trim()
      .slice(0, 160);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const lane = (rows: BoardRow[]) => Math.min(...rows.map(band));
  const best = [...groups.entries()].sort(
    ([, a], [, b]) => lane(a) - lane(b) || b.length - a.length,
  )[0];
  if (!best) return null;
  const [ask, rows] = best;
  return `${ask.replace(/^Abdout:\s*/, "")} — unblocks ${rows.length} card(s) <${boardUrl(rows[0].id)}|card>`;
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const { date } = kigaliNow();
  const board = await listBoard();
  const by = (s: string) => board.filter((r) => r.applicationStatus === s);

  const yesterday = new Date(Date.now() - 86_400_000)
    .toISOString()
    .slice(0, 10);
  const events = existsSync(`${DATA}/ledger.jsonl`)
    ? readFileSync(`${DATA}/ledger.jsonl`, "utf-8")
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

  // Supply alarm. 2026-09-30 → 10-08 sent nothing for nine days while the
  // loop ran green: 194 of 195 TO_APPLY cards had no address or form, so the
  // wave had nothing to tailor. Say so the day it happens, not a week later.
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const sentWeek = existsSync(`${DATA}/ledger.jsonl`)
    ? readFileSync(`${DATA}/ledger.jsonl`, "utf-8")
        .split("\n")
        .filter((l) => l.includes('"kind":"sent"'))
        .filter((l) => (JSON.parse(l) as { ts: string }).ts >= weekAgo).length
    : 0;
  const ask = firstAsk(board);
  if (ask) lines.push(`👉 *Do this first:* ${ask}`);

  const toApply = by("TO_APPLY");
  const routed = toApply.filter(
    (r) => r.applyEmail || r.applyPhone || r.channel === "ATS",
  ).length;
  lines.push(
    `Supply: ${sentWeek} sent in 7 days · ${routed}/${toApply.length} to-apply cards have a route the loop can send`,
  );
  if (sentWeek < 10)
    lines.push(
      `⚠️ *Stalled* — under 10 sends this week. Not a sending problem: the loop has nothing routable. Run \`pnpm jobs:resolve --apply\`, paste the Ashby/Lever packets, or widen discovery.`,
    );

  const answeredRows = by("RESPONSE");
  if (answeredRows.length) {
    lines.push(`\n*They answered — waiting on you (${answeredRows.length}):*`);
    for (const r of answeredRows.sort((a, b) => band(a) - band(b)).slice(0, 8))
      lines.push(`• ${short(r)} <${boardUrl(r.id)}|card>`);
  }

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
  const packets = by("HOLD").filter((r) =>
    /paste-ready packet/.test(r.holdReason ?? ""),
  );
  if (packets.length) {
    lines.push(
      `\n*Paste & submit (${packets.length} portal packets in jobs/packets/ats) — best first:*`,
    );
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
  const hold = by("HOLD").filter(
    (r) => !/paste-ready packet/.test(r.holdReason ?? ""),
  );
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
        !cfg.pausedLanes.includes(r.campaign ?? "") &&
        inFocus(r, cfg),
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
  const upwork = `${DATA}/packets/upwork/${date}.md`;
  if (existsSync(upwork)) {
    const url = readFileSync(upwork, "utf-8").match(
      /https:\/\/www\.upwork\.com\/[^\s)>\]]+/,
    )?.[0];
    lines.push(
      `\n*Upwork pick of the day:* proposal ready in ${upwork}${url ? ` — ${url}` : ""}`,
    );
  } else {
    lines.push(`\n*Upwork pick of the day:* not drafted yet (Cowork routine)`);
  }

  // Funding & Programs board (2026-10-03): calls closing in the next 14 days.
  // A board that is not there yet must not cost the jobs digest.
  const due = await fundingDue(14).catch(() => []);
  if (due.length) {
    lines.push(`\n*Funding closing ≤14 days (${due.length}):*`);
    for (const f of due.slice(0, 6))
      lines.push(
        `• ${f.deadline!.slice(0, 10)} ${f.name}${f.applyUrl ? ` — ${f.applyUrl}` : ""}`,
      );
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
