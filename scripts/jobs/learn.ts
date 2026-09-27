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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import {
  byLane,
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

  const sent = lines.filter((l) => l.kind === "sent").length;
  const holds = lines.filter((l) => l.kind === "hold");
  const holdReasons = new Map<string, number>();
  for (const h of holds)
    for (const r of (h.detail ?? "").split("; ")) {
      const k = r.replace(/".*?"|\d+/g, "…").slice(0, 60);
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
    table("By variant", summarizeOutcomes(lines, byVariant)),
    "",
    table("By lane", summarizeOutcomes(lines, byLane)),
    "",
    table("By wave", summarizeOutcomes(lines, byWave)),
    "",
    "### Why cards were held",
    ...[...holdReasons.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
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
    console.log(
      res.status === 0
        ? "\nproposals written (inactive) — see the report"
        : `\nclaude -p exited ${res.status}`,
    );
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
