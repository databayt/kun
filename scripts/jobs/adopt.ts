#!/usr/bin/env tsx
// ── Adopt: apply the weekly loop's improvements, inside fixed walls ──────────
//
//   pnpm jobs:adopt --list              the change log, newest last
//   pnpm jobs:adopt --revert <n>        undo change #n (logged as its own change)
//   pnpm jobs:adopt --json <file>       apply actions from a file (week/discuss)
//
// Abdout, 2026-10-10: adoption is fully autonomous — Claude changes what the
// data supports and reports it in #jobs. The walls below are what autonomy
// never reaches: only these action types exist, caps stop at HARD_LIMITS, and
// nothing here can touch profile facts, the send gate or the ATS truth rules.
// `jobs/.adopt-off` turns adoption into report-only.

import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";

import { HARD_LIMITS, LANE_BAND } from "./config";
import { loadVariants } from "./variants";

export type ActionType =
  | "variant" // target: variant id · value: "activate" | "deactivate"
  | "lane" // target: campaign · value: band 0–9 (lower sends first)
  | "pause" // target: campaign · value: "pause" | "resume"
  | "cap" // target: a HARD_LIMITS key · value: number within the wall
  | "coverage" // target: campaign · value: fit floor 10–80 (%)
  | "source"; // target: discover adapter · value: "off" | "on"

export interface Action {
  type: ActionType;
  target: string;
  value: string | number;
  why: string;
}

export interface Change extends Action {
  n: number;
  ts: string;
  from: string | number | null;
  by: string; // "week" | "discuss" | "revert"
}

const CONFIG = "jobs/loop.config.json";
const SOURCES = "jobs/sources.json";
const LOG = "jobs/learn/changes.jsonl";

const readJson = <T>(path: string, fallback: T): T =>
  existsSync(path) ? (JSON.parse(readFileSync(path, "utf-8")) as T) : fallback;
const writeJson = (path: string, v: unknown): void =>
  writeFileSync(path, JSON.stringify(v, null, 2) + "\n");

export function adoptionOff(): boolean {
  return existsSync("jobs/.adopt-off");
}

export function changes(): Change[] {
  return existsSync(LOG)
    ? readFileSync(LOG, "utf-8")
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Change)
    : [];
}

type Cfg = {
  laneBand?: Record<string, number>;
  pausedLanes?: string[];
  minCoverageByLane?: Record<string, number>;
  [k: string]: unknown;
};

/// Apply one action; returns the logged change or throws with the refusal.
export function apply(a: Action, by: string): Change {
  const cfg = readJson<Cfg>(CONFIG, {});
  let from: string | number | null = null;

  switch (a.type) {
    case "variant": {
      const v = loadVariants().find((x) => x.id === a.target);
      if (!v) throw new Error(`no variant "${a.target}"`);
      if (a.value !== "activate" && a.value !== "deactivate")
        throw new Error("variant value must be activate|deactivate");
      from = v.active ? "activate" : "deactivate";
      const r = spawnSync(
        "pnpm",
        ["-s", "jobs:variant", String(a.value), a.target],
        {
          encoding: "utf-8",
        },
      );
      if (r.status !== 0) throw new Error(r.stderr || r.stdout);
      break;
    }
    case "lane": {
      const band = Number(a.value);
      if (!Number.isInteger(band) || band < 0 || band > 9)
        throw new Error("lane band must be an integer 0–9");
      from = cfg.laneBand?.[a.target] ?? LANE_BAND[a.target] ?? null;
      cfg.laneBand = { ...cfg.laneBand, [a.target]: band };
      writeJson(CONFIG, cfg);
      break;
    }
    case "pause": {
      const paused = new Set(cfg.pausedLanes ?? []);
      from = paused.has(a.target) ? "pause" : "resume";
      if (a.value === "pause") paused.add(a.target);
      else if (a.value === "resume") paused.delete(a.target);
      else throw new Error("pause value must be pause|resume");
      cfg.pausedLanes = [...paused];
      writeJson(CONFIG, cfg);
      break;
    }
    case "cap": {
      const n = Number(a.value);
      const wall = HARD_LIMITS[a.target as keyof typeof HARD_LIMITS];
      if (wall === undefined)
        throw new Error(`"${a.target}" is not an adoptable cap`);
      const [lo, hi] =
        typeof wall === "number" ? [0, wall] : [wall.min, wall.max];
      if (!Number.isFinite(n) || n < lo || n > hi)
        throw new Error(
          `${a.target} must stay within ${lo}–${hi} (hard limit)`,
        );
      from = (cfg[a.target] as number | undefined) ?? null;
      cfg[a.target] = n;
      writeJson(CONFIG, cfg);
      break;
    }
    case "coverage": {
      const n = Number(a.value);
      if (!Number.isFinite(n) || n < 10 || n > 80)
        throw new Error("coverage floor must be 10–80");
      from = cfg.minCoverageByLane?.[a.target] ?? null;
      cfg.minCoverageByLane = { ...cfg.minCoverageByLane, [a.target]: n };
      writeJson(CONFIG, cfg);
      break;
    }
    case "source": {
      const s = readJson<{ off: string[] }>(SOURCES, { off: [] });
      const off = new Set(s.off);
      from = off.has(a.target) ? "off" : "on";
      if (a.value === "off") off.add(a.target);
      else if (a.value === "on") off.delete(a.target);
      else throw new Error("source value must be off|on");
      writeJson(SOURCES, { off: [...off] });
      break;
    }
    default:
      throw new Error(`"${(a as Action).type}" is not an adoptable action`);
  }

  const change: Change = {
    ...a,
    n: changes().length + 1,
    ts: new Date().toISOString(),
    from,
    by,
  };
  mkdirSync("jobs/learn", { recursive: true });
  appendFileSync(LOG, JSON.stringify(change) + "\n");
  return change;
}

/// Undo change #n by applying its inverse — itself a logged change.
export function revert(n: number, by = "revert"): Change {
  const c = changes().find((x) => x.n === n);
  if (!c) throw new Error(`no change #${n}`);
  if (c.from === null)
    throw new Error(
      `change #${n} had no prior value to restore — set it explicitly`,
    );
  return apply(
    { type: c.type, target: c.target, value: c.from, why: `revert #${n}` },
    by,
  );
}

/// Apply a batch, collecting refusals instead of stopping on the first.
export function applyAll(
  actions: Action[],
  by: string,
): { applied: Change[]; refused: { action: Action; reason: string }[] } {
  const applied: Change[] = [];
  const refused: { action: Action; reason: string }[] = [];
  if (adoptionOff()) {
    for (const action of actions)
      refused.push({ action, reason: "adoption is off (jobs/.adopt-off)" });
    return { applied, refused };
  }
  for (const action of actions) {
    try {
      applied.push(apply(action, by));
    } catch (e) {
      refused.push({ action, reason: (e as Error).message.slice(0, 200) });
    }
  }
  return { applied, refused };
}

export const describe = (c: Change): string =>
  `#${c.n} ${c.type} ${c.target}: ${c.from ?? "default"} → ${c.value} — ${c.why}`;

// ── CLI ──────────────────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith("adopt.ts")) {
  const args = process.argv.slice(2);
  const at = (f: string) => args[args.indexOf(f) + 1];
  try {
    if (args.includes("--revert"))
      console.log(describe(revert(Number(at("--revert")))));
    else if (args.includes("--json")) {
      const r = applyAll(
        JSON.parse(readFileSync(at("--json"), "utf-8")) as Action[],
        "cli",
      );
      for (const c of r.applied) console.log(`✅ ${describe(c)}`);
      for (const x of r.refused)
        console.log(`⛔ ${x.action.type} ${x.action.target}: ${x.reason}`);
    } else for (const c of changes()) console.log(describe(c));
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
