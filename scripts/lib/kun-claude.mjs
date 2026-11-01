// The binary every headless `claude -p` call spawns: kun's ledger wrapper when installed
// (~/.claude/bin/kun-claude.sh — tokens + cost per run in ~/.claude/logs/runs.jsonl, lean
// mode per engine.json jobs.$lean), plain `claude` otherwise. Drop-in: same args, same output.
import { existsSync } from "node:fs";
import { basename, dirname } from "node:path";

// Name the run for the ledger (and lean mode) from the calling script —
// scripts/seek/tailor.ts → seek:tailor. spawn() inherits process.env, so every
// child `claude -p` carries it without touching the call sites.
if (!process.env.KUN_JOB && process.argv[1]) {
  const f = process.argv[1];
  process.env.KUN_JOB = `${basename(dirname(f))}:${basename(f).replace(/\.(ts|mts|mjs|js)$/, "")}`;
}

const wrapper = `${process.env.HOME}/.claude/bin/kun-claude.sh`;
export const KUN_CLAUDE = existsSync(wrapper) ? wrapper : "claude";
