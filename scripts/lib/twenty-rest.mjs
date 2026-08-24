// ── Twenty CRM REST client ───────────────────────────────────────────────────
//
// Conventions from content/docs/crm.mdx, which are not stylistic:
//   • port 3100, NEVER 3000 — 3000 is hogwarts' dev server and answers 307 on
//     /graphql, which is why the Hermes CRM crons returned nothing for weeks
//     while reporting last_status: ok
//   • REST + metadata API only, never psql — raw SQL skips search vectors,
//     timeline and activity
//   • key from the macOS Keychain, service `databayt-twenty`, account = workspace
//   • >=700ms spacing, 100 req/min, exponential backoff on 429
//
// Spacing here is 800ms rather than the documented minimum: a record costs
// several calls, and 700ms across a batch lands within a few requests of the
// per-minute ceiling.

import { execSync } from "node:child_process";

const API_URL = (process.env.TWENTY_API_URL ?? "http://localhost:3100").replace(/\/+$/, "");
const THROTTLE_MS = 800;

let lastCallAt = 0;

export function twentyKey(workspace = "databayt") {
  if (process.env.TWENTY_API_KEY_DATABAYT) return process.env.TWENTY_API_KEY_DATABAYT.trim();
  if (process.env.TWENTY_API_KEY) return process.env.TWENTY_API_KEY.trim();
  try {
    const key = execSync(
      `security find-generic-password -s databayt-twenty -a ${workspace} -w 2>/dev/null`,
      { encoding: "utf-8" },
    ).trim();
    if (key) return key;
  } catch {
    // fall through
  }
  return "";
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function throttle() {
  const wait = THROTTLE_MS - (Date.now() - lastCallAt);
  if (wait > 0) await sleep(wait);
  lastCallAt = Date.now();
}

/// Returns { ok, status, body }. Never throws on an HTTP error — callers decide.
export async function twentyFetch(path, { method = "GET", body, key, attempt = 1 } = {}) {
  await throttle();

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (res.status === 429 && attempt <= 4) {
    const backoff = 1000 * 2 ** attempt;
    console.log(`   429 rate-limited — backing off ${backoff}ms`);
    await sleep(backoff);
    return twentyFetch(path, { method, body, key, attempt: attempt + 1 });
  }

  const parsed = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body: parsed };
}

export const twentyGet = (path, key) => twentyFetch(path, { key });
export const twentyPost = (path, body, key) => twentyFetch(path, { method: "POST", body, key });

/// The metadata list endpoints return `data` as an index-keyed object rather
/// than an array — Object.values is the only reliable way to read them.
export function metadataRows(payload) {
  const data = payload?.data;
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return Object.values(data);
}

/// Record list endpoints DO nest under a plural key: { data: { companies: [] } }.
export function recordRows(payload, pluralKey) {
  return payload?.data?.[pluralKey] ?? [];
}

export { API_URL };
