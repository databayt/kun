// fcc — "free Claude Code" (the `f` lane: Claude Code on OmniRoute / Nous free models, kun-free.sh).
// It shares ~/.claude through ~/.claude-free symlinks, so there is nothing to translate — this adapter verifies
// the lane is wired: launcher entry, installed kun-free.sh == source, the pool provider, and the config-dir links.
// Fix = `kun-free.sh --setup` (creates the config dir and links; never touches the claude.ai login).
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Plan, agentHome, read, KUN_ROOT } from "./lib.mjs";

export const transforms = { "link-check": 1 };
const SHARED = ["skills", "agents", "rules", "hooks", "scripts", "bin", "memory", "CLAUDE.md"];

export function lanePins(ctx) {
  const bad = [];
  try {
    const l = JSON.parse(read(join(ctx.kun, ".claude/machine/launchers.json")));
    const f = (l.launchers || []).find((x) => x.id === "f");
    if (!f || f.bin !== "kun-free.sh") bad.push("launchers.json has no `f` launcher for kun-free.sh");
  } catch { bad.push("launchers.json unreadable"); }
  try {
    const pr = JSON.parse(read(join(ctx.kun, ".claude/machine/providers.json")));
    if (pr.gateway?.id !== "omniroute") bad.push("providers.json gateway is not omniroute");
    else if (!(read(join(ctx.kun, ".claude/bin/kun-free.sh")) || "").includes(new URL(pr.gateway.url).port)) bad.push("kun-free.sh pool URL port differs from providers.json gateway");
  } catch { bad.push("providers.json unreadable"); }
  return bad;
}
export function linkDrift(ctx) {
  const free = agentHome(ctx, "fcc"); const claude = agentHome(ctx, "claude"); const bad = [];
  const script = join(claude, "bin/kun-free.sh"); const src = join(ctx.kun, ".claude/bin/kun-free.sh");
  if (!existsSync(script)) bad.push("~/.claude/bin/kun-free.sh not installed");
  else if (existsSync(src) && readFileSync(script, "utf8") !== readFileSync(src, "utf8")) bad.push("installed kun-free.sh differs from source");
  if (!existsSync(free)) { bad.push("~/.claude-free missing"); return bad; }
  for (const item of SHARED) { if (!existsSync(join(claude, item))) continue; try { if (!lstatSync(join(free, item)).isSymbolicLink()) bad.push(`${item} is not a link`); } catch { bad.push(`${item} not linked`); } }
  return bad;
}
export function plan(ctx) {
  const p = new Plan("fcc");
  p.skipPrune = true;
  p.run("lane config (launcher, provider)", () => lanePins(ctx).join("; ") || null, "true");
  if (ctx.kun === KUN_ROOT) p.run("~/.claude-free links + kun-free.sh", () => linkDrift(ctx).join("; ") || null, "bash", [join(ctx.kun, ".claude/bin/kun-free.sh"), "--setup"]);
  else p.run("~/.claude-free links + kun-free.sh", () => linkDrift(ctx).join("; ") || null, "true");
  return p;
}
