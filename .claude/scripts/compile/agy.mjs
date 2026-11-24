// agy — Antigravity / Gemini CLI (~/.gemini). A port of antigravity-sync.sh with the same behaviour:
//   mcp_config.json ← mcp.json (remote → serverUrl, description/registries dropped; ALL catalog servers, as before)
//   skills → ~/.claude/skills (symlink), AGENTS.md → ~/.claude/CLAUDE.md (symlink), GEMINI.md ← doctrine template,
//   .agents/skills ← .claude/skills (mirror-agents.mjs, repo-side).
// New: merge keeps servers kun does not own; GEMINI.md gets the org-memory pointer.
import { existsSync, lstatSync } from "node:fs";
import { join } from "node:path";
import { MEMORY_POINTER, Plan, agentHome, loadMcp, read, readManifest, target, KUN_ROOT } from "./lib.mjs";
import { spawnSync } from "node:child_process";

export const transforms = { "mcp-serverurl-json": 1, "symlink": 1, "doctrine-copy": 1, "skills-mirror": 1 };

export function agyMcp(servers) {
  const out = {};
  for (const s of servers) {
    const e = {};
    if (s.kind === "remote") e.serverUrl = s.url; else { e.command = s.command; if (s.args) e.args = s.args; }
    if (s.env && typeof s.env === "object") e.env = s.env;
    if (s.headers && typeof s.headers === "object") e.headers = s.headers;
    out[s.name] = e;
  }
  return out;
}
const isLinkOrMissing = (p) => { try { return lstatSync(p).isSymbolicLink(); } catch { return true; } };

export function plan(ctx) {
  const p = new Plan("agy");
  const claude = agentHome(ctx, "claude");
  const cfg = target(ctx, "agy", "mcp").path;
  let cur = { mcpServers: {} };
  const raw = read(cfg);
  if (raw) { try { cur = JSON.parse(raw); } catch { p.notice(`${cfg} invalid JSON — rewritten from kun`); } }
  const prev = readManifest(ctx, "agy").meta?.mcp || [];
  const ours = agyMcp(loadMcp(ctx, { includeSkipped: true }));
  const servers = { ...(cur.mcpServers || {}) };
  for (const n of prev) if (!(n in ours)) delete servers[n];
  Object.assign(servers, ours);
  p.file(cfg, JSON.stringify({ ...cur, mcpServers: servers }, null, 2) + "\n", { mode: 0o600 });
  p.meta = { mcp: Object.keys(ours) };

  const skills = target(ctx, "agy", "skills").path;
  if (isLinkOrMissing(skills)) p.link(skills, join(claude, "skills")); else p.notice("~/.gemini/skills is a real directory — left in place");
  const agents = target(ctx, "agy", "instructions").path;
  if (isLinkOrMissing(agents)) p.link(agents, join(claude, "CLAUDE.md")); else p.notice("~/.gemini/AGENTS.md is a real file — left in place");

  const tpl = read(join(ctx.kun, ".claude/antigravity/GEMINI.md"));
  if (tpl) p.file(target(ctx, "agy", "doctrine").path, `${tpl.replace(/\s+$/, "")}\n\n${MEMORY_POINTER}\n`);
  else p.notice("GEMINI.md template not found — doctrine skipped");

  const mirror = join(ctx.kun, ".claude/scripts/mirror-agents.mjs");
  if (ctx.kun === KUN_ROOT && existsSync(mirror))
    p.run("workspace skills (.agents/skills ← .claude/skills)", () => (spawnSync("node", [mirror, "--check"], { stdio: "ignore" }).status === 0 ? null : "mirror drifted"), "node", [mirror], { stdio: "ignore" });
  return p;
}
