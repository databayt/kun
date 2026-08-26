#!/usr/bin/env node
// The Friday digest — what shipped vs what was planned, the numbers, the
// lessons, and the lanes' health, posted where the team already talks.
//
// This is the "Weekly content nudge" from architecture.mdx's cron-candidates
// table, built the cheap way the Typefully template's weekly-analytics cron
// suggested: DETERMINISTIC — raw SQL and string building, zero model calls,
// zero tokens. It reads what the pipeline already records (SocialVariant,
// SocialMetric, dismissReason lessons, SystemHeartbeat) and says it plainly.
//
//   node scripts/social-digest.mjs --dry-run    # print only
//   node scripts/social-digest.mjs              # print + deliver
//
// Delivery order, mirroring lib/social-review.ts exactly:
//   1. Slack incoming webhook        (SLACK_WEBHOOK_URL — the direct lane)
//   2. Hermes relay → Slack #social  (scripts/post-to-hermes.mjs, secondary
//      for installs that actually run Hermes)
//   3. stdout only, with a warning — a digest nobody received is logged, not
//      silently dropped.
//
// Slack comes first for the same reason sendReview prefers it: Hermes runs on a
// laptop at home, and a digest that waits for a lid to open is the failure this
// ordering exists to prevent. Telegram was the old fallback; it was removed
// engine-wide on 2026-08-23 (c186fb8) and this script kept reaching for it for
// three days, which is why the 08-21 run ended "DELIVERED NOWHERE".
//
// Honesty rule, inherited from /measure: name what cannot be measured rather
// than showing a zero. Only Facebook carries metrics today; a week with no
// SocialMetric rows says so instead of printing an empty table.

import { execFileSync } from "node:child_process";
import { isSlackConfigured, sendSlackMessage } from "./lib/slack.mjs";
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const url = (process.env.DATABASE_URL ?? "").trim();
if (!url) {
  console.error("DATABASE_URL is not set — check the central .env.");
  process.exit(1);
}
const sql = neon(url);

const DRY_RUN = process.argv.includes("--dry-run");
// The nudge: just the "waiting for you" section, and silent unless something
// has been waiting long enough to mean the weekly session missed it. Green is
// silent here for the same reason the token canary is — a message that arrives
// every day whether or not it matters stops being read.
//
// The threshold is what makes a DAILY job compatible with a WEEKLY approval
// rhythm. Approval is one batch session per week, so an item that arrived
// yesterday is not late and saying so every morning would be noise. Three days
// means it has already outlived one session. The 27-day-old posts this was
// built for clear it by a factor of nine.
const BACKLOG_ONLY = process.argv.includes("--backlog-only");
const staleFlag = process.argv.indexOf("--stale-days");
const STALE_DAYS =
  staleFlag !== -1 && process.argv[staleFlag + 1] !== undefined
    ? Number(process.argv[staleFlag + 1])
    : 3;
if (!Number.isFinite(STALE_DAYS) || STALE_DAYS < 0) {
  console.error("--stale-days needs a non-negative number.");
  process.exit(1);
}

// Monday 00:00 UTC of the current ISO week — the same week the seed lane's
// rotation anchors on, so "planned" and "shipped" talk about the same seven
// days.
function isoWeekStart(now = new Date()) {
  const day = (now.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day),
  );
  return monday;
}

function isoWeekNumber(now = new Date()) {
  const jan4 = new Date(Date.UTC(now.getUTCFullYear(), 0, 4));
  return Math.ceil(
    ((now - jan4) / 86400000 + ((jan4.getUTCDay() + 6) % 7) + 1) / 7,
  );
}

function ageMinutes(at) {
  return Math.round((Date.now() - new Date(at).getTime()) / 60000);
}

function firstLine(text, max = 60) {
  const line = (text ?? "").split("\n").find((l) => l.trim()) ?? "";
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

const weekStart = isoWeekStart();
const week = isoWeekNumber();

// ── The five reads, all against indexes the pipeline already has ──────────

const asks = await sql`
  SELECT "brand",
         COUNT(*)::int AS "n",
         COUNT(*) FILTER (WHERE "requestedBy" LIKE 'seed:%')::int AS "seeded"
    FROM "SocialDraftRequest"
   WHERE "createdAt" >= ${weekStart.toISOString()} AND "turn" = 1
   GROUP BY "brand"
   ORDER BY "n" DESC`;

const shipped = await sql`
  SELECT p."brand", v."channel", COUNT(*)::int AS "n"
    FROM "SocialVariant" v
    JOIN "SocialPiece" p ON p."id" = v."pieceId"
   WHERE v."status" = 'published'
     AND v."publishedAt" >= ${weekStart.toISOString()}
   GROUP BY p."brand", v."channel"
   ORDER BY p."brand", "n" DESC`;

// Latest metric row per variant published in the last 14 days — this week's
// posts plus last week's, whose numbers have had time to move.
const metrics = await sql`
  SELECT DISTINCT ON (m."variantId")
         p."brand", v."channel", v."text", v."publishedAt",
         m."reach", m."views", m."reactions", m."comments", m."shares"
    FROM "SocialMetric" m
    JOIN "SocialVariant" v ON v."id" = m."variantId"
    JOIN "SocialPiece" p   ON p."id" = v."pieceId"
   WHERE v."publishedAt" > now() - interval '14 days'
   ORDER BY m."variantId", m."fetchedAt" DESC`;

const lessons = await sql`
  SELECT "dismissReason", COUNT(*)::int AS "n"
    FROM "SocialDraftRequest"
   WHERE "status" = 'dismissed' AND "dismissReason" IS NOT NULL
     AND "answeredAt" > now() - interval '60 days'
   GROUP BY "dismissReason"
   ORDER BY "n" DESC
   LIMIT 5`;

// Which lane answered this week. The claude lane always writes a note
// ('claude-code' by default, or an override reason); the Gemini lanes leave
// it NULL on success — a heuristic, but one both writers uphold.
const lanes = await sql`
  SELECT COUNT(*) FILTER (WHERE "note" IS NOT NULL)::int  AS "claude",
         COUNT(*) FILTER (WHERE "note" IS NULL)::int      AS "gemini"
    FROM "SocialDraftRequest"
   WHERE "status" IN ('answered', 'consumed')
     AND "answeredAt" >= ${weekStart.toISOString()}`;

const refused = await sql`
  SELECT COUNT(*)::int AS "n"
    FROM "SocialDraftRequest"
   WHERE "status" = 'pending' AND "note" LIKE 'craft-refused:%'`;

const beats = await sql`
  SELECT "key", "at", "detail"
    FROM "SystemHeartbeat"
   WHERE "key" IN ('draft-drain', 'hermes')`;

// ── The backlog: work finished by the machine and waiting on a human ──────
//
// This is the section the digest was missing, and the omission had a cost.
// Measured 2026-08-26: three finished posts had sat `pending` for 27 days and
// six answered drafts were unclaimed, while every scheduled job reported
// success — because each one truthfully drained an empty queue. sendReview
// fires once, at staging time, so nothing ever mentions an item again after
// the day it arrives. These two reads are what re-ring the bell.

const waitingDrafts = await sql`
  SELECT "brand", COUNT(*)::int AS "n",
         EXTRACT(DAY FROM now() - MIN("answeredAt"))::int AS "oldestDays"
    FROM "SocialDraftRequest"
   WHERE "status" = 'answered'
   GROUP BY "brand"
   ORDER BY "oldestDays" DESC`;

const waitingVariants = await sql`
  SELECT p."brand", v."channel", COUNT(*)::int AS "n",
         EXTRACT(DAY FROM now() - MIN(v."createdAt"))::int AS "oldestDays"
    FROM "SocialVariant" v
    JOIN "SocialPiece" p ON p."id" = v."pieceId"
   WHERE v."status" = 'pending'
   GROUP BY p."brand", v."channel"
   ORDER BY "oldestDays" DESC`;

const draftsWaiting = waitingDrafts.reduce((t, r) => t + r.n, 0);
const variantsWaiting = waitingVariants.reduce((t, r) => t + r.n, 0);

function backlogLines() {
  const out = [];
  if (draftsWaiting === 0 && variantsWaiting === 0) {
    out.push("✅ Nothing waiting on you — the queue is clear.");
    return out;
  }
  out.push(`⏳ Waiting on you — ${draftsWaiting} answered draft(s), ${variantsWaiting} staged post(s)`);
  for (const d of waitingDrafts) {
    out.push(`  ${d.brand}: ${d.n} answered draft(s), oldest ${d.oldestDays}d — open it from the queue so it consumes`);
  }
  for (const v of waitingVariants) {
    out.push(`  ${v.brand} → ${v.channel}: ${v.n} staged, oldest ${v.oldestDays}d`);
  }
  out.push("  → /social/publish");
  return out;
}

// ── Compose ───────────────────────────────────────────────────────────────

const lines = [];

// The daily nudge exits here: one section, and nothing at all when the queue
// is clear.
if (BACKLOG_ONLY) {
  const oldestDays = Math.max(
    0,
    ...waitingDrafts.map((d) => d.oldestDays ?? 0),
    ...waitingVariants.map((v) => v.oldestDays ?? 0),
  );
  const nothingWaiting = draftsWaiting === 0 && variantsWaiting === 0;
  if (nothingWaiting || oldestDays < STALE_DAYS) {
    const why = nothingWaiting
      ? "Queue clear"
      : `Nothing older than ${STALE_DAYS}d (oldest ${oldestDays}d)`;
    if (!DRY_RUN) console.error(`${why} — no nudge sent.`);
    else console.log(`✅ ${why} — no nudge would be sent.`);
    process.exit(0);
  }
  const nudge = backlogLines().join("\n");
  console.log(nudge);
  if (DRY_RUN) process.exit(0);
  if (isSlackConfigured()) {
    const res = await sendSlackMessage(nudge, "Social — waiting on you");
    if (res.ok) {
      console.error("Nudge delivered to Slack.");
      process.exit(0);
    }
    console.error(`Slack nudge failed: ${res.error}`);
  }
  console.error("⚠ Nudge printed above but DELIVERED NOWHERE — set SLACK_WEBHOOK_URL.");
  process.exit(0);
}

lines.push(`📋 Social — week ${week} Friday digest`);
lines.push("");

// The backlog leads: it is the only section that asks for an action.
lines.push(...backlogLines());
lines.push("");

lines.push("Planned vs shipped:");
if (asks.length === 0) {
  lines.push("  no draft asks were filed this week — the seed lane or the Hub is quiet.");
} else {
  for (const a of asks) {
    lines.push(`  ${a.brand}: ${a.n} ask(s) filed (${a.seeded} seeded)`);
  }
}
if (shipped.length === 0) {
  lines.push("  nothing published this week.");
} else {
  for (const s of shipped) {
    lines.push(`  ${s.brand} → ${s.channel}: ${s.n} published`);
  }
}
lines.push("");

lines.push("Numbers (posts from the last 14 days; Facebook is the only measured channel):");
if (metrics.length === 0) {
  lines.push("  no metric rows yet — either nothing recent on Facebook, or the six-hourly reader has not caught up.");
} else {
  for (const m of metrics) {
    lines.push(
      `  [${m.brand}/${m.channel}] "${firstLine(m.text, 40)}" — reach ${m.reach}, views ${m.views}, 👍 ${m.reactions}, 💬 ${m.comments}, ↗ ${m.shares}`,
    );
  }
}
lines.push("");

lines.push("Lessons (60 days of human dismissals, most common first):");
if (lessons.length === 0) {
  lines.push("  no dismissals recorded — nothing to correct for.");
} else {
  for (const l of lessons) {
    lines.push(`  ${l.dismissReason}: ${l.n}×`);
  }
}
lines.push("");

lines.push("Lanes:");
const lane = lanes[0] ?? { claude: 0, gemini: 0 };
lines.push(`  answered this week — gemini ${lane.gemini}, claude ${lane.claude}`);
if (refused[0]?.n > 0) {
  lines.push(`  ⚠ ${refused[0].n} ask(s) sitting craft-refused and pending — the claude drain should absorb them; check it if they persist.`);
}
for (const b of beats) {
  const age = ageMinutes(b.at);
  const flag = b.key === "draft-drain" && age > 10 ? " ⚠ stale" : "";
  lines.push(`  ${b.key}: last beat ${age} min ago (${b.detail ?? ""})${flag}`);
}

const digest = lines.join("\n");
console.log(digest);

if (DRY_RUN) process.exit(0);

// ── Deliver ───────────────────────────────────────────────────────────────

// Slack's direct webhook first — the one destination reachable with nothing
// else awake. Same order, and the same reasoning, as lib/social-review.ts.
if (isSlackConfigured()) {
  const res = await sendSlackMessage(digest, "Weekly social digest");
  if (res.ok) {
    console.error("Delivered to Slack.");
    process.exit(0);
  }
  console.error(`Slack delivery failed (${res.error}) — falling back to the Hermes relay.`);
}

// Hermes second: kept for installs that run it. execFile passes the multi-line
// text as one argv entry — no shell mangling.
try {
  execFileSync(
    "node",
    ["scripts/post-to-hermes.mjs", "--text", digest, "--channels", "slack"],
    { stdio: ["ignore", "inherit", "inherit"] },
  );
  console.error("Delivered via the Hermes relay.");
  process.exit(0);
} catch {
  console.error("Hermes relay failed too.");
}

console.error(
  "⚠ Digest printed above but DELIVERED NOWHERE — set SLACK_WEBHOOK_URL (an incoming webhook on a PRIVATE channel) or HERMES_API_URL.",
);
process.exit(0);
