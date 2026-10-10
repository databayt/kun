#!/usr/bin/env tsx
// ── Friday learn: what converted, and what to try next ───────────────────────
//
//   pnpm jobs:learn              metrics → jobs/learn/<date>.md, print
//   pnpm jobs:learn --propose    + claude -p proposes up to 2 new variants (inactive)
//   pnpm jobs:learn --send       + summary to Abdout through Hermes
//
// The /bench shape with a human at the end: hypothesis → variant → measure →
// Abdout adopts (`pnpm jobs:variant activate <id>`). Nothing here activates a
// variant or edits a live template; proposals arrive as new @n+1 files marked
// inactive in jobs/variants.json.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";

import {
  byLane,
  bySource,
  byVariant,
  byWave,
  LedgerLine,
  MIN_N,
  Outcome,
  summarizeOutcomes,
} from "@/lib/jobs/learn-metrics";

import { listBoard } from "./board";
import { kigaliNow } from "./config";
import { notify } from "./notify";

const args = process.argv.slice(2);

const table = (title: string, rows: Outcome[]): string =>
  [
    `### ${title}`,
    "| key | sent | replies | interviews | offers | rejections | reply rate | median days |",
    "|---|---|---|---|---|---|---|---|",
    ...rows.map(
      (o) =>
        `| ${o.key} | ${o.sent} | ${o.replies} | ${o.interviews} | ${o.offers} | ${o.rejections} | ${o.replyRate === null ? `n<${MIN_N}` : `${Math.round(o.replyRate * 100)}%`} | ${o.medianDaysToReply ?? "—"} |`,
    ),
  ].join("\n");

async function main(): Promise<void> {
  const { date } = kigaliNow();
  const lines: LedgerLine[] = existsSync("jobs/ledger.jsonl")
    ? readFileSync("jobs/ledger.jsonl", "utf-8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as LedgerLine)
    : [];
  const board = await listBoard();
  const status = (s: string) =>
    board.filter((r) => r.applicationStatus === s).length;
  // The ledger never carried a source; the board row does.
  const sourceOf = new Map(board.map((r) => [r.id, r.source ?? null]));
  for (const l of lines) l.source ??= sourceOf.get(l.crmId) ?? null;
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  // This week's funnel per source: found → routable → sent → human reply.
  const funnel = new Map<
    string,
    { found: number; routed: number; sent: number; replied: number }
  >();
  const f = (k: string) => {
    if (!funnel.has(k))
      funnel.set(k, { found: 0, routed: 0, sent: 0, replied: 0 });
    return funnel.get(k)!;
  };
  for (const r of board)
    if ((r.createdAt ?? "") >= weekAgo) {
      const x = f(r.source ?? "unknown");
      x.found++;
      if (r.applyEmail || r.applyPhone || r.channel === "ATS" || r.channel === "PLATFORM") x.routed++;
    }
  const sentWeek = lines.filter((l) => l.kind === "sent" && l.ts >= weekAgo);
  for (const l of sentWeek) f(l.source ?? "unknown").sent++;
  const humanReplied = new Set(
    lines
      .filter((l) => l.kind === "reply" && !(l.detail ?? "").startsWith("ack"))
      .map((l) => l.crmId),
  );
  for (const l of sentWeek)
    if (humanReplied.has(l.crmId)) f(l.source ?? "unknown").replied++;

  // Discover's per-adapter yield over the last 7 daily files.
  const yieldBy = new Map<string, { items: number; days: number; errors: number }>();
  if (existsSync("jobs/learn"))
    for (const file of readdirSync("jobs/learn")
      .filter((n) => /^yield-\d{4}-\d{2}-\d{2}\.json$/.test(n))
      .filter((n) => n.slice(6, 16) >= weekAgo.slice(0, 10))) {
      const y = JSON.parse(readFileSync(`jobs/learn/${file}`, "utf-8")) as Record<
        string,
        { items: number; error?: string }
      >;
      for (const [k, v] of Object.entries(y)) {
        const a = yieldBy.get(k) ?? { items: 0, days: 0, errors: 0 };
        a.items += v.items;
        a.days++;
        if (v.error) a.errors++;
        yieldBy.set(k, a);
      }
    }

  const sent = lines.filter((l) => l.kind === "sent").length;
  // Why cards are held NOW — read from the board's current HOLD cards, not
  // the ledger: the ledger keeps every hold ever logged, including the ones
  // the morning re-ask has since cleared. The 2026-10-10 week report asked
  // Abdout for two facts the profile already had because of exactly that.
  const holdReasons = new Map<string, number>();
  for (const r of board.filter((x) => x.applicationStatus === "HOLD")) {
    // The first quoted question stays: it is the actionable part.
    const k =
      (r.holdReason ?? "")
        .replace(/; ".*$/, "")
        .replace(/\d+%/g, "#%")
        .replace(/: missing .*/, "")
        .replace(/jobs\/packets\/\S+/, "jobs/packets/…")
        .slice(0, 110)
        .trim() || "(no reason recorded)";
    holdReasons.set(k, (holdReasons.get(k) ?? 0) + 1);
  }

  const md = [
    `# Jobs learn — ${date}`,
    "",
    `Total sent ${sent} · board: ${status("APPLIED")} applied, ${status("RESPONSE")} response, ${status("INTERVIEW")} interview, ${status("OFFER")} offer, ${status("REJECTED")} rejected, ${status("HOLD")} hold, ${status("TO_APPLY")} to apply.`,
    sent === 0
      ? "\n**Nothing has been sent yet — there is nothing to learn from. The bottleneck is sending.**"
      : "",
    "",
    `## This week (sent since ${weekAgo.slice(0, 10)})`,
    "",
    `Sent ${sentWeek.length} · human replies ${sentWeek.filter((l) => humanReplied.has(l.crmId)).length}`,
    "",
    "### Funnel by source — this week",
    "| source | found | routable | sent | human replies |",
    "|---|---|---|---|---|",
    ...[...funnel.entries()]
      .sort((a, b) => b[1].found - a[1].found)
      .map(([k, v]) => `| ${k} | ${v.found} | ${v.routed} | ${v.sent} | ${v.replied} |`),
    "",
    "### Discover yield — last 7 runs",
    "| adapter | items | runs | errors |",
    "|---|---|---|---|",
    ...[...yieldBy.entries()]
      .sort((a, b) => b[1].items - a[1].items)
      .map(([k, v]) => `| ${k} | ${v.items} | ${v.days} | ${v.errors} |`),
    "",
    table("By lane — this week", summarizeOutcomes(lines, byLane, weekAgo)),
    "",
    table("By source — this week", summarizeOutcomes(lines, bySource, weekAgo)),
    "",
    "## Cumulative",
    "",
    table("By variant", summarizeOutcomes(lines, byVariant)),
    "",
    table("By source", summarizeOutcomes(lines, bySource)),
    "",
    table("By lane", summarizeOutcomes(lines, byLane)),
    "",
    table("By wave", summarizeOutcomes(lines, byWave)),
    "",
    `### Why the ${status("HOLD")} cards on HOLD are held (current board)`,
    ...[...holdReasons.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([r, n]) => `- ${n}× ${r}`),
  ].join("\n");

  mkdirSync("jobs/learn", { recursive: true });
  const out = `jobs/learn/${date}.md`;
  writeFileSync(out, md + "\n");
  console.log(md);

  if (args.includes("--propose") && sent >= 3) {
    const prompt = `You improve Osman Abdout's job applications. Read:
- /Users/abdout/kun/${out} (this week's outcomes)
- /Users/abdout/kun/jobs/variants.json and the active letter templates it points to
- the sent letters in /Users/abdout/kun/jobs/outbox/*/ (*.letter.json) and /Users/abdout/kun/jobs/ledger.jsonl (which got replies)
- /Users/abdout/kun/jobs/facts.json (the only claims allowed)

Then propose AT MOST 2 new variants — a letter template or a CV HTML edit — each aimed at a specific finding. For each:
1. Write the new file next to its parent with the version bumped (e.g. jobs/templates/letters/kigali-tech@2.md, or jobs/cv/web@2.html copied from web.html with your edit). Never edit an existing file.
2. Append an entry to jobs/variants.json "variants" with "active": false, "parent": <parent id>, "createdAt": "${date}", "hypothesis": <one sentence: what you expect to improve and why, citing the numbers>. For a CV also set "pdf": "jobs/cv/Osman_Abdout_<Name>@<n>.pdf" and "source".
3. Append a "## Proposals" section to /Users/abdout/kun/${out} explaining each and how to adopt it (pnpm jobs:variant activate <id>).
If the sample is too small to support a change, propose nothing and say so in the Proposals section. Never invent facts.`;
    const res = spawnSync(
      "claude",
      [
        "-p",
        prompt,
        "--allowedTools",
        "Read",
        "Write",
        "Edit",
        "Glob",
        "--max-turns",
        "40",
      ],
      {
        encoding: "utf-8",
        timeout: 20 * 60_000,
      },
    );
    if (res.status !== 0) {
      // 2026-10-09: this failed, learn still exited 0, the week was stamped
      // and "No proposals" went out. A failed proposal run now fails learn.
      console.error(
        `\nclaude -p exited ${res.status}: ${(res.stderr || res.stdout || "").slice(0, 300)}`,
      );
      process.exitCode = 1;
    } else console.log("\nproposals written (inactive) — see the report");
  }

  if (args.includes("--send")) {
    const report = readFileSync(out, "utf-8");
    const proposals = report.split("## Proposals")[1]?.trim().slice(0, 1200);
    notify(
      `Weekly learn — ${date}\nSent ${sent} total · ${status("INTERVIEW")} interviewing · ${status("OFFER")} offers · ${status("HOLD")} on hold\n${proposals ? `\nProposals:\n${proposals}` : "\nNo proposals this week."}\nFull report: jobs/learn/${date}.md`,
      "Jobs — weekly learn",
    );
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
