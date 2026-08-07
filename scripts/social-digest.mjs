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
// Delivery order (all outbound from this machine — Vercel can never reach
// Slack or Hermes, the inverted arrow):
//   1. Hermes relay → Slack #social  (scripts/post-to-hermes.mjs, the
//      existing headless review lane)
//   2. Telegram review chat          (TELEGRAM_BOT_TOKEN + TELEGRAM_REVIEW_CHAT_ID)
//   3. stdout only, with a warning — a digest nobody received is logged, not
//      silently dropped.
//
// Honesty rule, inherited from /measure: name what cannot be measured rather
// than showing a zero. Only Facebook carries metrics today; a week with no
// SocialMetric rows says so instead of printing an empty table.

import { execFileSync } from "node:child_process";
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

// ── Compose ───────────────────────────────────────────────────────────────

const lines = [];
lines.push(`📋 Social — week ${week} Friday digest`);
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

// Hermes → Slack first: the team's channel, and the lane the architecture
// already trusts for review traffic. execFile passes the multi-line text as
// one argv entry — no shell mangling.
try {
  execFileSync(
    "node",
    ["scripts/post-to-hermes.mjs", "--text", digest, "--channels", "slack"],
    { stdio: ["ignore", "inherit", "inherit"] },
  );
  process.exit(0);
} catch {
  console.error("Hermes relay failed — falling back to the Telegram review chat.");
}

const botToken = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
const reviewChat = (process.env.TELEGRAM_REVIEW_CHAT_ID ?? "").trim();
if (botToken && reviewChat) {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: reviewChat, text: digest }),
      },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    console.error("Delivered to the Telegram review chat.");
    process.exit(0);
  } catch (err) {
    console.error(`Telegram fallback failed too: ${err.message}`);
  }
}

console.error(
  "⚠ Digest printed above but DELIVERED NOWHERE — Hermes unreachable and no Telegram review chat configured.",
);
process.exit(0);
