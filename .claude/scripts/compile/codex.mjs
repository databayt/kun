// codex — OpenAI Codex CLI (~/.codex). Writes: AGENTS.md (compiled instructions), skills/<name>/ (copies),
// agents/<name>.toml (custom agents), and a marked block of [mcp_servers.*] in config.toml.
// Preserved: model, auth, plugins, marketplaces, notify, features, shell policy, and every hand-made
// MCP table that carries headers/secrets (e.g. Neon, github, ref).
import { join } from "node:path";
import { GEN, Plan, blockMarkers, compileInstructions, envRef, loadAgents, loadMcp, loadSkills, read, stripBlock, target, walk, withBlock } from "./lib.mjs";
import { readFileSync } from "node:fs";

export const transforms = { "instructions-md": 1, "skill-copy": 1, "agent-toml": 1, "mcp-toml-block": 1 };
const M = blockMarkers("mcp");
const q = (s) => JSON.stringify(String(s));

// ── TOML (just enough to merge: split into header-led sections) ────────────────────────────────
export function splitToml(text) {
  const pre = []; const sections = []; let cur = null;
  for (const line of text.split("\n")) {
    const m = /^\s*\[\[?\s*([^\]]+?)\s*\]\]?\s*(#.*)?$/.exec(line);
    if (m) { cur = { header: m[1], lines: [line] }; sections.push(cur); } else (cur ? cur.lines : pre).push(line);
  }
  return { pre, sections };
}
/** `mcp_servers.<name>[.sub]` → {name, sub}; null for any other header. */
export function mcpHeader(h) {
  const m = /^mcp_servers\.(?:"((?:[^"\\]|\\.)*)"|([A-Za-z0-9_-]+))(?:\.(.*))?$/.exec(h);
  return m ? { name: m[1] ?? m[2], sub: m[3] || "" } : null;
}
/** A hand-made table kun must keep: it carries headers, a bearer token, or literal env values. */
function handOwned(secs) {
  return secs.some((s) => {
    const { sub } = mcpHeader(s.header);
    if (sub === "http_headers" || sub === "env_http_headers") return true;
    if (sub === "env") return s.lines.slice(1).some((l) => /^\s*[A-Za-z_]\w*\s*=\s*\S/.test(l) && !/=\s*(""|'')\s*$/.test(l));
    return s.lines.some((l) => /^\s*bearer_token/.test(l));
  });
}
export function mcpToml(servers) {
  const out = [];
  for (const s of servers) {
    out.push(`[mcp_servers.${/^[A-Za-z0-9_-]+$/.test(s.name) ? s.name : q(s.name)}]`);
    if (s.kind === "remote") out.push(`url = ${q(s.url)}`);
    else {
      out.push(`command = ${q(s.command)}`);
      out.push(`args = [${s.args.map(q).join(", ")}]`);
    }
    const names = [], lit = [];
    for (const [k, v] of Object.entries(s.env || {})) (envRef(v) === k ? names : lit).push([k, v]);
    if (names.length && s.kind === "stdio") out.push(`env_vars = [${names.map(([k]) => q(k)).join(", ")}]`);
    if (lit.length && s.kind === "stdio") { out.push(`[mcp_servers.${/^[A-Za-z0-9_-]+$/.test(s.name) ? s.name : q(s.name)}.env]`); for (const [k, v] of lit) out.push(`${k} = ${q(v)}`); }
    out.push("");
  }
  return out.join("\n");
}
/** Merge kun's MCP servers into an existing config.toml text. Pure. */
export function mergeCodexConfig(text, servers) {
  const base = stripBlock(text ?? "", M);
  const { pre, sections } = splitToml(base);
  const byName = new Map();
  for (const s of sections) { const h = mcpHeader(s.header); if (h) (byName.get(h.name) ?? byName.set(h.name, []).get(h.name)).push(s); }
  const emit = []; const drop = new Set();
  for (const s of servers) {
    const existing = byName.get(s.name);
    if (existing && handOwned(existing)) continue;       // hand-made with secrets: keep, do not emit
    if (existing) for (const e of existing) drop.add(e);
    emit.push(s);
  }
  const kept = [pre.join("\n"), ...sections.filter((s) => !drop.has(s)).map((s) => s.lines.join("\n"))].join("\n").replace(/\n{3,}/g, "\n\n");
  return { text: withBlock(kept, M, mcpToml(emit)), emitted: emit.map((s) => s.name) };
}

const tomlStr = (s) => `"""\n${s.replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"')}"""`;
export function agentToml(a) {
  const lines = [`# ${GEN}`, `name = ${q(a.name)}`, `description = ${q(a.description)}`];
  if (["minimal", "low", "medium", "high", "xhigh"].includes(a.effort)) lines.push(`model_reasoning_effort = ${q(a.effort)}`);
  lines.push(`developer_instructions = ${tomlStr(a.body)}`, "");
  return lines.join("\n");
}

export function plan(ctx) {
  const p = new Plan("codex");
  p.file(target(ctx, "codex", "instructions").path, compileInstructions(ctx, { title: "Codex — global instructions" }));
  const sk = target(ctx, "codex", "skills").path;
  for (const s of loadSkills(ctx)) for (const f of walk(s.dir)) p.file(join(sk, s.id, f), readFileSync(join(s.dir, f)));
  const ag = target(ctx, "codex", "agents").path;
  for (const a of loadAgents(ctx)) p.file(join(ag, `${a.id}.toml`), agentToml(a));
  const cfg = target(ctx, "codex", "mcp").path;
  const { text, emitted } = mergeCodexConfig(read(cfg), loadMcp(ctx));
  p.file(cfg, text);
  p.meta = { mcp: emitted };
  p.notice("hooks: Codex hooks.json is repo-scoped (kun/.codex/hooks.json) — not compiled");
  return p;
}
