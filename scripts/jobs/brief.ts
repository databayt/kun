#!/usr/bin/env tsx
// ── Phone-sized jobs status, for Hermes quick commands ───────────────────────
//
//   pnpm jobs:brief            status: this week, today, the queue, what's held
//   pnpm jobs:brief queue      what goes out next (veto it on the board)
//   pnpm jobs:brief replies    replies in the last 14 days
//
// Hermes runs these from WhatsApp/Slack as /jobs, /jobsqueue, /jobsreplies
// (scripts/jobs/hermes-setup.sh). No model involved, so it must stay fast
// (<30s, Hermes' quick-command limit) and short (a phone screen). The CRM
// board is read live; the ledger supplies the week's counts.

import { existsSync, readFileSync } from "node:fs";

import { boardUrl, listBoard } from "./board";
import { kigaliNow, killSwitchOn } from "./config";

interface Line {
  ts: string;
  kind: string;
  name?: string;
  to?: string;
  detail?: string;
}

const mode = process.argv[2] ?? "status";

async function main(): Promise<void> {
  const { date } = kigaliNow();
  const lines: Line[] = existsSync("jobs/ledger.jsonl")
    ? readFileSync("jobs/ledger.jsonl", "utf-8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Line)
    : [];
  const since = (days: number) =>
    new Date(Date.now() - days * 86_400_000).toISOString();
  const board = await listBoard();
  const by = (s: string) => board.filter((r) => r.applicationStatus === s);

  if (mode === "queue") {
    const q = [...by("APPROVED"), ...by("QUEUED")];
    console.log(
      q.length
        ? `Next out (${q.length}) — veto by moving the card to Hold:\n` +
            q
              .slice(0, 10)
              .map((r) => `• ${r.name.slice(0, 60)} [${r.channel ?? "?"}]`)
              .join("\n")
        : "Nothing queued.",
    );
    return;
  }

  if (mode === "replies") {
    const r = lines.filter(
      (l) =>
        l.kind === "reply" && l.ts >= since(14) && !/^ack/.test(l.detail ?? ""),
    );
    console.log(
      r.length
        ? `Replies, last 14 days (${r.length}):\n` +
            r
              .slice(-10)
              .map(
                (l) =>
                  `• ${(l.detail ?? "").split(":")[0]} — ${l.name?.slice(0, 55)}`,
              )
              .join("\n")
        : "No real replies in 14 days (acknowledgements not counted).",
    );
    return;
  }

  const week = lines.filter((l) => l.kind === "sent" && l.ts >= since(7));
  const today = week.filter((l) => l.ts.slice(0, 10) === date);
  const via = (l: Line) =>
    (l.to ?? "").startsWith("ats:")
      ? "form"
      : (l.to ?? "").startsWith("+")
        ? "whatsapp"
        : "email";
  const count = (ls: Line[], v: string) =>
    ls.filter((l) => via(l) === v).length;
  const replies = lines.filter(
    (l) =>
      l.kind === "reply" && l.ts >= since(7) && !/^ack/.test(l.detail ?? ""),
  );
  const held = by("HOLD");
  const reasons = new Map<string, number>();
  for (const r of held) {
    const k = (r.holdReason ?? "?").split(":")[0].slice(0, 40);
    reasons.set(k, (reasons.get(k) ?? 0) + 1);
  }
  const top = [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const live = by("INTERVIEW").concat(by("OFFER"), by("RESPONSE"));

  console.log(
    [
      `Jobs — ${date}${killSwitchOn() ? " · ⛔ sending paused" : ""}`,
      `Last 7 days: ${week.length} sent (email ${count(week, "email")} · form ${count(week, "form")} · WhatsApp ${count(week, "whatsapp")}) · ${replies.length} real replies`,
      `Today: ${today.length} sent`,
      `Queued: ${by("QUEUED").length + by("APPROVED").length} · Held: ${held.length} · To apply: ${by("TO_APPLY").length}`,
      ...(live.length
        ? [
            `In conversation: ${live.map((r) => r.name.slice(0, 40)).join("; ")}`,
          ]
        : []),
      ...(top.length
        ? [`Held for: ${top.map(([k, n]) => `${k} (${n})`).join(" · ")}`]
        : []),
      ...(live[0] ? [boardUrl(live[0].id)] : []),
    ].join("\n"),
  );
}

main().catch((err: unknown) => {
  console.log(`jobs brief failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
