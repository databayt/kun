#!/usr/bin/env tsx
// ── Discuss: answer Abdout in #jobs, change what he asks for ─────────────────
//
//   pnpm jobs:discuss            every loop tick — new messages → claude -p → reply
//   pnpm jobs:discuss --dry-run  print what would be answered; nothing posted
//
// Reads his replies in the open weekly thread (week.ts) and anything he posts
// top-level in #jobs, answers in thread (Arabic or English, as he wrote), and
// applies or reverts changes through adopt.ts — the same log and walls as the
// Friday cycle. Zero tokens when nobody wrote.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";

import { type Action, applyAll, changes, describe, revert } from "./adopt";
import { kigaliNow, loadConfig } from "./config";
import {
  abdoutUserId,
  history,
  plain,
  post,
  replies,
  WEEK_THREAD,
} from "./slack";

const DRY = process.argv.includes("--dry-run");
const ROOT = "/Users/abdout/kun";
const LOCK = "jobs/.state/discuss.lock";
const CURSOR = "jobs/.state/discuss-cursor";

interface Answer {
  reply: string;
  actions: Action[];
  reverts: number[];
}

async function main(): Promise<void> {
  const channel = loadConfig().jobsChannel;
  const me = abdoutUserId();
  const week = existsSync(WEEK_THREAD)
    ? (JSON.parse(readFileSync(WEEK_THREAD, "utf-8")) as {
        ts: string;
        date: string;
      })
    : null;
  const cursor = existsSync(CURSOR)
    ? readFileSync(CURSOR, "utf-8").trim()
    : String(Date.now() / 1000 - 3600);

  // Thread replies + top-level posts, his only, oldest first.
  const inThread = week ? await replies(channel, week.ts, cursor) : [];
  const topLevel = (await history(channel, cursor)).filter(
    (m) => !week || m.ts !== week.ts,
  );
  const mine = [
    ...inThread.map((m) => ({ m, thread: week!.ts })),
    ...topLevel.map((m) => ({ m, thread: m.ts })),
  ]
    .filter(({ m }) => m.user === me && !m.bot_id && !m.subtype && plain(m.text))
    .sort((a, b) => a.m.ts.localeCompare(b.m.ts));
  if (mine.length === 0) return;

  if (existsSync(LOCK)) {
    const pid = Number(readFileSync(LOCK, "utf-8"));
    let alive = false;
    try {
      process.kill(pid, 0);
      alive = true;
    } catch {
      // a crashed run left its lock — take over
    }
    if (alive) {
      console.log("discuss already running — skip");
      return;
    }
  }
  mkdirSync("jobs/.state", { recursive: true });
  writeFileSync(LOCK, String(process.pid));
  try {
    const { date } = kigaliNow();
    const brief = spawnSync("pnpm", ["-s", "jobs:brief"], {
      encoding: "utf-8",
      cwd: ROOT,
    });
    const recent =
      changes().slice(-15).map(describe).join("\n") || "(none yet)";
    const said = mine.map(({ m }) => `- ${plain(m.text)}`).join("\n");
    const out = `jobs/.state/discuss-${Date.now()}.json`;

    const prompt = `You run Osman Abdout's job-hunting loop (drive: quick cash) and he is talking to you in Slack #jobs. Answer him like a sharp colleague: short, concrete, numbers first, in the language he wrote in (Arabic or English). Slack mrkdwn, no headings, under 180 words.

He wrote:
${said}

Context you can read:
- ${ROOT}/jobs/learn/${week?.date ?? date}.md (the weekly report) and ${ROOT}/jobs/learn/${week?.date ?? date}.week.json (what you decided that week)
- ${ROOT}/scripts/jobs/adopt.ts — the ONLY change types that exist and their walls; ${ROOT}/scripts/jobs/config.ts
- ${ROOT}/jobs/ledger.jsonl, ${ROOT}/jobs/variants.json, ${ROOT}/jobs/packets/ats/SESSION.md
Board right now:
${(brief.stdout || "").slice(0, 2500)}
Recent changes (#n = change number):
${recent}

If he asks for a change you can make, include it as an action; if he asks to undo one, include its number in "reverts". If he asks for something outside the action types (profile facts, the send gate, bypassing a CAPTCHA, caps beyond the walls), say plainly you can't and why. Never invent facts about him.

Write ${ROOT}/${out} as JSON exactly: {"reply": "<your answer>", "actions": [{"type": "...", "target": "...", "value": ..., "why": "..."}], "reverts": [<change numbers>]}. Output nothing else.`;
    const res = spawnSync(
      "claude",
      [
        "-p",
        prompt,
        "--allowedTools",
        "Read",
        "Glob",
        "Grep",
        "Write",
        "--max-turns",
        "25",
      ],
      { encoding: "utf-8", timeout: 10 * 60_000, cwd: ROOT },
    );
    if (res.status !== 0 || !existsSync(out))
      throw new Error(
        `claude -p exited ${res.status}: ${(res.stderr || res.stdout || "").slice(0, 200)}`,
      );
    const a = JSON.parse(readFileSync(out, "utf-8")) as Answer;
    rmSync(out);

    if (DRY) {
      console.log(JSON.stringify(a, null, 2));
      return;
    }
    const done: string[] = [];
    for (const n of a.reverts ?? [])
      try {
        done.push(`↩️ ${describe(revert(n, "discuss"))}`);
      } catch (e) {
        done.push(`⛔ revert #${n}: ${(e as Error).message}`);
      }
    const r = applyAll(a.actions ?? [], "discuss");
    done.push(...r.applied.map((c) => `✅ ${describe(c)}`));
    done.push(
      ...r.refused.map(
        (x) => `⛔ ${x.action.type} ${x.action.target}: ${x.reason}`,
      ),
    );

    const last = mine[mine.length - 1];
    await post(channel, [a.reply, ...done].join("\n"), last.thread);
    writeFileSync(CURSOR, last.m.ts);
  } finally {
    rmSync(LOCK, { force: true });
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

