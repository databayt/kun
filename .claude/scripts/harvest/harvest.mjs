#!/usr/bin/env node
// harvest.mjs — the token pool's ledger: what every providers.json source has, used, and left.
//
//   node harvest.mjs            refresh ~/.claude/state/harvest.json, print a one-screen table
//   node harvest.mjs --json     refresh and print the JSON
//   node harvest.mjs --quiet    refresh only (the 30-min job)
//
// Read by: aware.mjs (Token pool section), health.sh (pool check), kun-free.sh (`pool_ready`
// decides whether `f` routes through the pool or straight to Nous), and Machine → Providers.
// Sources: providers.json (the catalog), OmniRoute's admin API (connections, availability,
// provider-stats, per-connection usage), the Keychain (has a key or not — never the value),
// and the direct lanes' own checks (Nous via Hermes, opencode keyless, agy). A provider that
// reports no quota gets `quota: null` — OmniRoute still skips it when it fails or 429s.
//
// Schema (version 1) — Machine depends on it:
// { version, updated, gateway: { status: ok|down|missing, url },
//   pool_ready: bool,                     // ≥1 connected, healthy, enabled free provider
//   providers: [ { id, name, tier, via, enabled,
//     status: connected|needs-key|needs-sign-in|exhausted|error|off|direct-ok|direct-down,
//     connection?: string, requests?, tokens_in?, tokens_out?, success_pct?, avg_ms?,
//     quota?: { used?, limit?, remaining?, unit?, resets_at? } | null, note? } ],
//   combos: { <name>: { members: ["provider/model", …], ready: bool } },
//   totals: { requests, tokens, cost_usd } }
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { api, catalog, connect, connections, keychain, unlock } from "./omni.mjs";

const STATE = join(homedir(), ".claude", "state", "harvest.json");
const args = new Set(process.argv.slice(2));

function sh(cmd, argv, timeout = 8000) {
  try {
    return execFileSync(cmd, argv, { encoding: "utf8", timeout, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function gatewayStatus() {
  const here = new URL(".", import.meta.url).pathname;
  const out = sh("bash", [join(here, "omniroute.sh"), "status"]);
  return out || "down";
}

function directStatus(p) {
  if (p.via === "direct" && p.id === "nous") {
    return sh(join(homedir(), ".claude", "bin", "kun-free.sh"), ["--key"]) ? "direct-ok" : "needs-sign-in";
  }
  if (p.via === "opencode") {
    const auth = join(homedir(), ".local", "share", "opencode", "auth.json");
    try {
      const a = JSON.parse(readFileSync(auth, "utf8"));
      if (a.opencode) return "error"; // a stored Zen key overrides keyless; expired keys block it
    } catch {}
    return sh("opencode", ["--version"]) ? "direct-ok" : "direct-down";
  }
  if (p.via === "agy") {
    const r = spawnSync("bash", ["-lc", "agy --dangerously-skip-permissions -p 'reply OK' </dev/null"], { encoding: "utf8", timeout: 60000 });
    const s = `${r.stdout || ""}${r.stderr || ""}`;
    if (r.error || !s.trim()) return "direct-down";
    return /not eligible|verify your account/i.test(s) ? "needs-sign-in" : "direct-ok";
  }
  if (p.via === "claude") return "direct-ok";
  return "direct-down";
}

function quotaFrom(u) {
  if (!u || typeof u !== "object") return null;
  const q = u.quota || u.usage || u.limits;
  if (!q || typeof q !== "object") return null;
  const pick = (k) => (typeof q[k] === "number" ? q[k] : undefined);
  const out = { used: pick("used"), limit: pick("limit"), remaining: pick("remaining"), unit: q.unit, resets_at: q.resetsAt || q.resets_at };
  return Object.values(out).some((v) => v !== undefined) ? out : null;
}

async function main() {
  const cat = catalog();
  const gateway = gatewayStatus();
  let conns = [];
  let stats = [];
  let avail = [];
  if (gateway === "ok") {
    conns = (await connections()) || [];
    stats = (await api("GET", "/api/provider-stats").catch(() => ({ providers: [] }))).providers || [];
    avail = (await api("GET", "/api/usage/availability").catch(() => ({ connections: [] }))).connections || [];
  }

  const providers = [];
  for (const p of cat.providers) {
    const row = { id: p.id, name: p.name, tier: p.tier, via: p.via, enabled: !!p.enabled };
    if (!p.enabled) {
      row.status = "off";
    } else if (p.via !== "omniroute") {
      row.status = directStatus(p);
    } else {
      if (p.key_from === "hermes") await connect(p.id).catch(() => {}); // the one-hour key, refreshed
      let c = conns.find?.((x) => x.name === `kun-${p.id}`);
      if (!c) {
        row.status = (p.keychain && keychain(p.keychain)) || p.key_from ? "error" : "needs-key";
        if (row.status === "error") row.note = "key in Keychain but not connected — run: node omni.mjs connect " + p.id;
      } else {
        row.connection = c.id;
        const a = avail.find((x) => x.id === c.id);
        const blocked = a?.account?.blockers?.length > 0 || a?.account?.usable === false;
        const s = stats.find((x) => x.provider === p.name || x.provider?.toLowerCase().includes(p.omniroute.split("-")[0]));
        if (s) {
          row.requests = s.totalRequests;
          row.tokens_in = s.totalTokensIn;
          row.tokens_out = s.totalTokensOut;
          row.success_pct = s.totalRequests ? Math.round((100 * s.successfulRequests) / s.totalRequests) : null;
          row.avg_ms = s.avgLatencyMs;
        }
        const u = await api("GET", `/api/usage/${encodeURIComponent(c.id)}`).catch(() => null);
        row.quota = row.quota || quotaFrom(u);
        if (u?.message) row.note = u.message;
        const active = c.isActive ?? c.active ?? true;
        const until = c.rateLimitedUntil && Date.parse(c.rateLimitedUntil) > Date.now() ? c.rateLimitedUntil : null;
        if (until && /^4(04|10)/.test(String(c.errorCode || ""))) {
          // a dead MODEL locked the whole account — unlock and say which model to drop from roles
          await unlock(c.id).catch(() => {});
          row.note = `unlocked after ${c.errorCode} (${c.lastError || "model gone"}) — drop that model from providers.json roles`;
        } else if (until) {
          row.quota = { ...(row.quota || {}), remaining: 0, resets_at: until };
        }
        row.status = !active ? "error" : blocked ? "exhausted" : row.quota?.remaining === 0 ? "exhausted" : "connected";
      }
    }
    providers.push(row);
  }

  const free = (r) => r.enabled && ["keyless", "free", "free-capped"].includes(r.tier);
  const pool_ready = providers.some((r) => free(r) && r.via === "omniroute" && r.status === "connected");

  const combos = {};
  const have = await api("GET", "/api/combos").catch(() => null);
  const list = have?.combos || have?.data || (Array.isArray(have) ? have : []);
  for (const name of Object.keys(cat.combos || {}).filter((n) => !n.startsWith("$"))) {
    const c = list.find?.((x) => x.name === name);
    const members = (c?.models || []).map((m) => (typeof m === "string" ? m : m.model || m.id)).filter(Boolean);
    combos[name] = { members, ready: members.length > 0 };
  }

  const totals = {
    requests: providers.reduce((n, r) => n + (r.requests || 0), 0),
    tokens: providers.reduce((n, r) => n + (r.tokens_in || 0) + (r.tokens_out || 0), 0),
    cost_usd: 0,
  };
  const state = { version: 1, updated: new Date().toISOString(), gateway: { status: gateway, url: cat.gateway.url }, pool_ready, providers, combos, totals };
  mkdirSync(join(homedir(), ".claude", "state"), { recursive: true });
  writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n");

  if (args.has("--quiet")) return;
  if (args.has("--json")) return console.log(JSON.stringify(state, null, 2));
  console.log(`gateway ${gateway} · pool ${pool_ready ? "ready" : "NOT ready"} · ${totals.requests} requests · ${totals.tokens} tokens`);
  for (const r of providers) {
    const q = r.quota ? ` · ${r.quota.remaining ?? "?"}/${r.quota.limit ?? "?"} ${r.quota.unit || ""}` : "";
    const use = r.requests != null ? ` · ${r.requests} req ${r.success_pct ?? "-"}% ok` : "";
    console.log(`${r.status.padEnd(14)} ${r.id.padEnd(16)} ${r.tier.padEnd(12)}${use}${q}`);
  }
  for (const [n, c] of Object.entries(combos)) console.log(`combo ${n.padEnd(12)} ${c.ready ? c.members.join(" → ") : "(empty)"}`);
}

main().catch((e) => {
  console.error(`harvest: ${e.message || e}`);
  process.exit(1);
});
