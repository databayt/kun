// claude — Claude Code (~/.claude). The install itself is setup.sh (copy agents/rules/skills/hooks/bin, register MCP);
// this adapter encapsulates it: --check compares installed vs source for agents, rules and skills; writing runs
// `setup.sh --quiet`. It also owns one marked block in ~/.claude/CLAUDE.md (the org-memory pointer) — the rest of
// that personal file is never touched.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GEN, MEMORY_POINTER, Plan, agentHome, blockMarkers, read, target, walk, withBlock, KUN_ROOT } from "./lib.mjs";
import { createHash } from "node:crypto";

export const transforms = { "setup-sh": 1, "memory-pointer-block": 1 };
const M = blockMarkers("memory", "<!--");
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

/** Names the control room turned off (~/.kun/machine/disabled.json) — setup.sh removes them, so they are not drift. */
export function disabledIds(ctx) {
  try { const d = JSON.parse(read(join(ctx.state, "machine/disabled.json"))); return new Set([...Object.keys(d.disabled || {}), ...(d.removed || [])]); } catch { return new Set(); }
}
/** Installed-vs-source drift for agents, rules and skills. Returns a list of strings. */
export function installDrift(ctx) {
  const home = agentHome(ctx, "claude"); const off = disabledIds(ctx); const bad = [];
  const cmp = (src, dst, label) => { if (!existsSync(dst)) bad.push(`${label} missing`); else if (sha(src) !== sha(dst)) bad.push(`${label} differs`); };
  const flat = (srcDir, dstDir, kind) => {
    if (!existsSync(srcDir)) return;
    for (const f of walk(srcDir).filter((f) => f.endsWith(".md") && !f.includes("/"))) if (!off.has(`${kind}:${f.slice(0, -3)}`)) cmp(join(srcDir, f), join(dstDir, f), `${kind} ${f}`);
  };
  flat(join(ctx.kun, ".claude/agents"), join(home, "agents"), "agent");
  flat(join(ctx.kun, ".claude/rules-global"), join(home, "rules"), "rule");
  const sdir = join(ctx.kun, ".claude/skills");
  if (existsSync(sdir)) for (const s of walk(sdir)) { const id = s.split("/")[0]; if (!off.has(`skill:${id}`)) cmp(join(sdir, s), join(home, "skills", s), `skill ${s}`); }
  return bad;
}

export function plan(ctx, { fromSetup = false } = {}) {
  const p = new Plan("claude");
  const cm = target(ctx, "claude", "instructions").path;
  const cur = read(cm);
  if (cur !== null) p.file(cm, withBlock(cur, M, `${MEMORY_POINTER}`));
  else p.notice("~/.claude/CLAUDE.md missing — setup.sh installs it from the template");
  p.skipPrune = true;
  if (!fromSetup && ctx.kun === KUN_ROOT) {
    const setup = join(ctx.kun, ".claude/scripts/setup.sh");
    p.run("install (setup.sh --quiet)", () => { const d = installDrift(ctx); return d.length ? `${d.length} drifted: ${d.slice(0, 3).join(", ")}${d.length > 3 ? " …" : ""}` : null; }, "bash", [setup, "--quiet"]);
  }
  void GEN;
  return p;
}
