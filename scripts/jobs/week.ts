#!/usr/bin/env tsx
// ── Week: learn → report → adopt → discuss, in Slack #jobs ───────────────────
//
//   pnpm jobs:week              Friday 17:00 (loop.sh): the full cycle
//   pnpm jobs:week --dry-run    analysis + actions printed; nothing applied/posted
//
// Replaces the Friday `learn --propose --send` (which failed silently on
// 2026-10-09). Metrics come from learn.ts; Claude (claude -p, subscription)
// reads them and decides what to change; adopt.ts applies those changes inside
// its hard walls (Abdout, 2026-10-10: fully autonomous); the report opens a
// thread in #jobs that discuss.ts answers every tick until next Friday.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { summarizeOutcomes, type LedgerLine } from "@/lib/jobs/learn-metrics";

import { type Action, applyAll, describe } from "./adopt";
import { kigaliNow, loadConfig } from "./config";
import { notify } from "./notify";
import { post, WEEK_THREAD } from "./slack";
import { loadVariants } from "./variants";

const DRY = process.argv.includes("--dry-run");
const ROOT = "/Users/abdout/kun";

export interface WeekPlan {
  learned: string[];
  actions: Action[];
  needFromYou: string[];
  headline: string;
}

/// Close an A/B test the numbers have settled: both variants of a pair have
/// ≥20 sends and one replies at least twice as often → retire the other.
function settledAbTests(lines: LedgerLine[]): Action[] {
  const active = loadVariants().filter((v) => v.active);
  const stats = new Map(
    summarizeOutcomes(lines, (s) => (s.variant ?? "").split(" ")).map((o) => [
      o.key,
      o,
    ]),
  );
  const out: Action[] = [];
  for (const a of active)
    for (const b of active) {
      if (a.id >= b.id || a.kind !== b.kind) continue;
      if (!a.lanes.some((l) => b.lanes.includes(l))) continue;
      const [sa, sb] = [stats.get(a.id), stats.get(b.id)];
      if (!sa || !sb || sa.sent < 20 || sb.sent < 20) continue;
      const [ra, rb] = [sa.replies / sa.sent, sb.replies / sb.sent];
      const loser =
        ra >= 2 * rb && ra > 0 ? b : rb >= 2 * ra && rb > 0 ? a : null;
      if (loser)
        out.push({
          type: "variant",
          target: loser.id,
          value: "deactivate",
          why: `A/B settled: ${a.id} ${Math.round(ra * 100)}% vs ${b.id} ${Math.round(rb * 100)}% replies (n=${sa.sent}/${sb.sent})`,
        });
    }
  return out;
}

async function main(): Promise<void> {
  const { date } = kigaliNow();
  const report = `jobs/learn/${date}.md`;
  const planFile = `jobs/learn/${date}.week.json`;

  // 1. Metrics.
  const learn = spawnSync("pnpm", ["-s", "jobs:learn"], { encoding: "utf-8" });
  if (learn.status !== 0 || !existsSync(report))
    throw new Error(`jobs:learn failed: ${(learn.stderr || "").slice(0, 300)}`);

  // 2. Claude reads the week and decides.
  const prompt = `You run Osman Abdout's job-hunting loop and improve it every week. The drive is QUICK CASH: the first paid work in days, not months. He is a Sudanese national living in Kigali, Rwanda — native Arabic, fluent English, BSc Electrical Engineering, 7 years marine ETO, substation protection since 2022, ~5 years full-stack TypeScript/Next.js, founder of Databayt. Positioning (2026-10-10): "Native Arabic engineer (electrical + full-stack TypeScript) — Arabic LLM evaluation, STEM reasoning, RTL code review". Fastest lanes: Arabic AI-evaluation / AI-training platforms that accept Rwanda (Mercor confirmed), then software roles, then a fixed-price "Arabic/RTL-ready Next.js in 72h" freelance offer. US-only remote roles rarely hire from Rwanda.

Read:
- ${ROOT}/${report} — this week's funnel by source, discover yield, outcomes by lane/source/variant, hold reasons
- ${ROOT}/jobs/learn/changes.jsonl (if present) — what was changed in earlier weeks, so you can judge whether it worked
- ${ROOT}/jobs/variants.json and the active templates it points to; ${ROOT}/jobs/facts.json (the only claims allowed)
- ${ROOT}/scripts/jobs/config.ts (LANE_BAND, HARD_LIMITS, defaults) and ${ROOT}/scripts/jobs/adopt.ts (the ONLY action types that exist)

Decide what to change. You may also write ONE new letter template variant (next to its parent, version bumped, never edit an existing file) and register it in jobs/variants.json with "active": false, a "parent", "createdAt": "${date}" and a "hypothesis" citing the numbers — then include a "variant activate" action for it so it A/B-tests against its parent. Never invent facts about Abdout.

Write ${ROOT}/${planFile} as JSON exactly:
{"headline": "<one sentence: the week in numbers and the main problem>",
 "learned": ["<3–5 findings, each with the number that backs it>"],
 "actions": [{"type": "variant|lane|pause|cap|coverage|source", "target": "...", "value": ..., "why": "<the number behind it>"}],
 "needFromYou": ["<only things a human must do: paste a portal application, sign an attestation, take an AI interview, a missing fact — most valuable first, max 5>"]}
Prefer 1–4 actions that move volume toward the fastest-paying lanes. With too little data, change little and say so. Output nothing else.`;
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
      "Grep",
      "--max-turns",
      "40",
    ],
    { encoding: "utf-8", timeout: 25 * 60_000, cwd: ROOT },
  );
  if (res.status !== 0 || !existsSync(planFile)) {
    notify(
      `Weekly jobs report failed: claude -p exited ${res.status}. Metrics are in ${report}; the loop will retry next tick.`,
      "Jobs — weekly",
    );
    throw new Error(
      `claude -p exited ${res.status}: ${(res.stderr || res.stdout || "").slice(0, 300)}`,
    );
  }
  const plan = JSON.parse(readFileSync(planFile, "utf-8")) as WeekPlan;

  const lines = readFileSync("jobs/ledger.jsonl", "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LedgerLine);
  plan.actions.push(...settledAbTests(lines));

  if (DRY) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  // 3. Adopt.
  const { applied, refused } = applyAll(plan.actions, "week");

  // 4. Report + open the discussion thread.
  const msg = [
    `*Jobs — week of ${date}*`,
    plan.headline,
    "",
    "*What I learned*",
    ...plan.learned.map((l) => `• ${l}`),
    "",
    "*What I changed* (live for Monday's wave)",
    ...(applied.length
      ? applied.map((c) => `✅ ${describe(c)}`)
      : ["• nothing — not enough signal yet"]),
    ...refused.map(
      (r) => `⛔ ${r.action.type} ${r.action.target}: ${r.reason}`,
    ),
    "",
    "*What I need from you*",
    ...(plan.needFromYou.length
      ? plan.needFromYou.map((n, i) => `${i + 1}. ${n}`)
      : ["• nothing this week"]),
    "",
    `_Reply in this thread — I answer within ~30 min. "revert 3" undoes change #3; ask for any change in plain words. Full report: jobs/learn/${date}.md_`,
  ].join("\n");
  const ts = await post(loadConfig().jobsChannel, msg);
  mkdirSync("jobs/.state", { recursive: true });
  writeFileSync(
    WEEK_THREAD,
    JSON.stringify({ ts, date, cursor: ts }, null, 2) + "\n",
  );
  console.log(msg);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
