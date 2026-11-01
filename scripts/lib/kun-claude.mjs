// The binary every headless `claude -p` call spawns: kun's ledger wrapper when installed
// (~/.claude/bin/kun-claude.sh — tokens + cost per run in ~/.claude/logs/runs.jsonl, lean
// mode per engine.json jobs.$lean), plain `claude` otherwise. Drop-in: same args, same output.
import { existsSync } from "node:fs";

const wrapper = `${process.env.HOME}/.claude/bin/kun-claude.sh`;
export const KUN_CLAUDE = existsSync(wrapper) ? wrapper : "claude";
