#!/usr/bin/env node
// omni.mjs — kun's admin door into the local OmniRoute (the token-harvest gateway).
//
//   node omni.mjs connect <providerId>     add/refresh a provider from providers.json, key from the Keychain
//   node omni.mjs connect-all              every enabled providers.json row whose Keychain key exists
//   node omni.mjs list                     connected providers (json)
//   node omni.mjs test <connectionId>      one upstream test
//   node omni.mjs quota                    live quota per connection (json)
//   node omni.mjs mint-key                 create the OmniRoute API key clients use → credential store OMNIROUTE_API_KEY
//   node omni.mjs setup                    mint-key if missing + connect-all + combos (Machine's one fix)
//   node omni.mjs raw <METHOD> <path> [json-body]   any admin route, for debugging
//
// Auth: logs in with the dashboard password (Machine's credential store, OMNIROUTE_ADMIN_PASSWORD, written by
// omniroute.sh init) and keeps the session cookie in memory only. Provider keys are read from the
// Keychain (service databayt, account = providers.json `keychain`) and sent once to OmniRoute,
// which stores them encrypted (API_KEY_SECRET); they are never printed. Canonical copy in kun.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const KUN = process.env.KUN_ROOT || join(here, "..", "..", "..");
const CATALOG = join(KUN, ".claude", "machine", "providers.json");
const BASE = process.env.OMNIROUTE_URL || "http://127.0.0.1:20128";

export const catalog = () => JSON.parse(readFileSync(CATALOG, "utf8"));

// One store for every key: Machine's OS credential service. A key pasted in Machine → Brain is
// the same item these scripts read; nothing is copied to a file.
export const SERVICE = "org.databayt.kun.machine";
export function keychain(account) {
  try {
    return execFileSync("security", ["find-generic-password", "-s", SERVICE, "-a", account, "-w"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

// Nous: Hermes's agent key (one hour) from the f lane's resolver — never stored by kun.
export function hermesKey() {
  try {
    return execFileSync(join(process.env.HOME, ".claude", "bin", "kun-free.sh"), ["--key"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 20000,
    }).trim();
  } catch {
    return "";
  }
}

// A 4xx on ONE model (e.g. 410 for a deprecated model) makes OmniRoute lock the WHOLE connection
// for 24h (rateLimitedUntil). Clear it so the other models on that account keep serving.
export async function unlock(connectionId) {
  await api("PUT", `/api/providers/${encodeURIComponent(connectionId)}`, { rateLimitedUntil: null, testStatus: "active", errorCode: null, lastError: null });
}

// OmniRoute assumes a 32,768-token window for a model its catalog lacks (Nous's :free models),
// and Claude Code's prompt alone is ~34k — so every such model was skipped. providers.json
// `context` gives the window the provider itself reports; OmniRoute has no write API for it,
// so it goes into its own table (model_context_overrides, source 'manual').
export function contextOverrides(p) {
  const rows = Object.entries(p.context || {});
  if (!rows.length || !p.omniroute) return;
  const db = join(process.env.HOME, ".omniroute", "storage.sqlite");
  const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
  const sql = rows
    .map(([m, n]) => `INSERT OR REPLACE INTO model_context_overrides (provider, model_id, real_context, source) VALUES (${q(p.omniroute)}, ${q(m)}, ${Number(n)}, 'manual');`)
    .join(" ");
  try {
    execFileSync("sqlite3", [db, sql], { stdio: "ignore", timeout: 10000 });
  } catch {}
}

let cookie = "";
async function login() {
  if (cookie) return;
  const password = keychain("OMNIROUTE_ADMIN_PASSWORD");
  if (!password) throw new Error("no admin password — run omniroute.sh init");
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!r.ok) throw new Error(`login ${r.status}`);
  cookie = (r.headers.getSetCookie?.() || [r.headers.get("set-cookie") || ""])
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

export async function api(method, path, body) {
  await login();
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { cookie, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  if (!r.ok) {
    const msg = json?.error?.message || json?.message || text.slice(0, 200);
    throw new Error(`${method} ${path} → ${r.status} ${msg}`);
  }
  return json;
}

export async function connections() {
  const j = await api("GET", "/api/providers?limit=5000");
  return j.connections || j.data || j;
}

export async function connect(id) {
  const p = catalog().providers.find((x) => x.id === id);
  if (!p) throw new Error(`not in providers.json: ${id}`);
  if (!p.omniroute) throw new Error(`${id} is not an OmniRoute provider (via ${p.via})`);
  const key = p.key_from === "hermes" ? hermesKey() : p.keychain ? keychain(p.keychain) : "";
  if (!key && p.tier !== "keyless") return { id, status: "needs-key", keychain: p.keychain };
  const body = { provider: p.omniroute, name: `kun-${p.id}`, apiKey: key };
  if (p.provider_data) body.providerSpecificData = p.provider_data;
  if (p.needs?.includes("account_id")) {
    const acct = keychain(p.account_keychain);
    if (!acct) return { id, status: "needs-account-id", keychain: p.account_keychain };
    body.providerSpecificData = { ...(body.providerSpecificData || {}), accountId: acct };
  }
  const existing = (await connections()).find?.((c) => c.name === body.name);
  if (existing) {
    await api("PUT", `/api/providers/${encodeURIComponent(existing.id)}`, body);
    contextOverrides(p);
    return { id, status: "updated", connection: existing.id };
  }
  const res = await api("POST", "/api/providers", body);
  contextOverrides(p);
  return { id, status: "added", connection: res?.connection?.id };
}

export function storeSecret(account, value) {
  execFileSync("security", ["add-generic-password", "-U", "-s", SERVICE, "-a", account, "-w", value], { stdio: "ignore" });
}

export async function mintKey({ force = false } = {}) {
  if (!force && keychain("OMNIROUTE_API_KEY")) return { status: "exists" };
  const r = await api("POST", "/api/keys", { name: "kun-local" });
  const key = r?.key || r?.data?.key;
  if (!key) throw new Error("OmniRoute returned no key");
  storeSecret("OMNIROUTE_API_KEY", key);
  return { status: "minted", id: r?.id || r?.data?.id };
}

async function main() {
  const [cmd, ...a] = process.argv.slice(2);
  const out = (x) => console.log(JSON.stringify(x, null, 2));
  switch (cmd) {
    case "connect":
      return out(await connect(a[0]));
    case "connect-all": {
      const rows = [];
      for (const p of catalog().providers.filter((x) => x.enabled && x.via === "omniroute")) {
        try {
          rows.push(await connect(p.id));
        } catch (e) {
          rows.push({ id: p.id, status: "error", error: String(e.message || e) });
        }
      }
      return out(rows);
    }
    case "list":
      return out(
        (await connections()).map?.((c) => ({ id: c.id, provider: c.provider, name: c.name, active: c.isActive ?? c.active, status: c.testStatus ?? c.status })),
      );
    case "test":
      return out(await api("POST", `/api/providers/${encodeURIComponent(a[0])}/test`, {}));
    case "quota":
      return out(await api("GET", "/api/quota"));
    case "mint-key":
      return out(await mintKey({ force: a[0] === "--force" }));
    case "setup": {
      const steps = { key: await mintKey() };
      const rows = [];
      for (const p of catalog().providers.filter((x) => x.enabled && x.via === "omniroute")) {
        try {
          rows.push(await connect(p.id));
        } catch (e) {
          rows.push({ id: p.id, status: "error", error: String(e.message || e) });
        }
      }
      steps.providers = rows;
      const here = dirname(fileURLToPath(import.meta.url));
      try {
        steps.combos = JSON.parse(execFileSync("node", [join(here, "combos.mjs")], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 120000 }));
      } catch (e) {
        steps.combos = { error: String(e.message || e).slice(0, 200) };
      }
      return out(steps);
    }
    case "raw":
      return out(await api(a[0], a[1], a[2] ? JSON.parse(a[2]) : undefined));
    default:
      console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 9).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
      process.exit(cmd ? 64 : 0);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(`omni: ${e.message || e}`);
    process.exit(1);
  });
}
