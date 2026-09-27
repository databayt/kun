#!/usr/bin/env node
// ── The apply queue, read from the CRM board ─────────────────────────────────
//
//   node scripts/jobs/queue.mjs                 TO_APPLY, best first (top 15)
//   node scripts/jobs/queue.mjs --limit 5 --json
//   node scripts/jobs/queue.mjs --stale         APPLIED with no movement ≥ 7 days
//   node scripts/jobs/queue.mjs --summary       counts per lane × status
//
// The board (sales.databayt.org, object kigaliOpportunity) is the queue's
// source of truth, not Neon: it is what a human edits by hand.
//
// Order is Abdout's, set 2026-09-26: Rwanda first, then remote income, then
// contracts abroad. Within a band the nearest deadline wins, then the score.

import { recordRows, twentyGet, twentyKey } from "../lib/twenty-rest.mjs";

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f, d) => (args.indexOf(f) > -1 ? args[args.indexOf(f) + 1] : d);

const LIMIT = Number(opt("--limit", 15));
const STALE_DAYS = Number(opt("--days", 7));

// Mirrors LANE_BAND in scripts/jobs/config.ts (Abdout, 2026-09-27): software in
// Kigali → remote → freelance → the rest; electrical paused (band 8, hidden).
const BAND = {
  WEB_DEVELOPER: 1,
  REMOTE_WORLDWIDE: 2,
  FREELANCE: 3,
  TENDER: 4,
  AI_TRAINING: 5,
  PROTECTION: 8,
  ELECTRICAL: 8,
  MARINE_ETO: 8,
  ENGINEERING_CONTRACT: 8,
};

const key = twentyKey("databayt");
if (!key) {
  console.error("No Databayt API key (Keychain databayt-twenty/databayt).");
  process.exit(1);
}

async function all() {
  const rows = [];
  let cursor;
  for (;;) {
    const res = await twentyGet(
      `/rest/kigaliOpportunities?limit=60${cursor ? `&starting_after=${cursor}` : ""}`,
      key,
    );
    if (!res.ok) {
      console.error(`CRM read failed ${res.status} — is the Twenty Docker stack up on :3100?`);
      process.exit(1);
    }
    const page = recordRows(res.body, "kigaliOpportunities");
    rows.push(...page);
    const info = res.body?.pageInfo;
    if (!info?.hasNextPage || page.length === 0) break;
    cursor = info.endCursor;
  }
  return rows;
}

const rows = await all();

if (flag("--summary")) {
  const table = {};
  for (const r of rows) {
    const lane = r.campaign ?? "—";
    table[lane] ??= {};
    table[lane][r.applicationStatus ?? "—"] = (table[lane][r.applicationStatus ?? "—"] ?? 0) + 1;
  }
  console.table(table);
  process.exit(0);
}

const view = (r) => ({
  id: r.id,
  name: r.name,
  campaign: r.campaign,
  tier: r.tier,
  score: r.engineScore,
  deadline: r.deadline?.slice(0, 10) ?? "rolling",
  url: r.jobUrl?.primaryLinkUrl ?? "",
  status: r.applicationStatus,
  updated: r.updatedAt?.slice(0, 10),
  apply: (r.assessment?.markdown?.match(/Apply: ([^·\n]+)/)?.[1] ?? "").trim(),
});

let out;
if (flag("--stale")) {
  const cutoff = Date.now() - STALE_DAYS * 86_400_000;
  out = rows
    .filter((r) => r.applicationStatus === "APPLIED" && new Date(r.updatedAt).getTime() < cutoff)
    .map(view);
} else {
  const today = new Date().toISOString().slice(0, 10);
  out = rows
    .filter((r) => r.applicationStatus === "TO_APPLY")
    .filter((r) => (BAND[r.campaign] ?? 9) < 8 || args.includes("--all"))
    .filter((r) => !r.deadline || r.deadline.slice(0, 10) >= today)
    .sort(
      (a, b) =>
        (BAND[a.campaign] ?? 9) - (BAND[b.campaign] ?? 9) ||
        (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") ||
        (b.engineScore ?? 0) - (a.engineScore ?? 0),
    )
    .slice(0, LIMIT)
    .map(view);
}

if (flag("--json")) {
  console.log(JSON.stringify(out, null, 2));
} else {
  out.forEach((r, i) =>
    console.log(
      `${String(i + 1).padStart(2)}. [${(r.campaign ?? "—").padEnd(20)}] ${r.deadline.padEnd(10)} ${String(r.score ?? "").padStart(3)}  ${r.name}\n` +
        `    ${r.apply || r.url}  (${r.id})`,
    ),
  );
  console.log(`\n${out.length} shown · ${rows.length} on the board`);
}
