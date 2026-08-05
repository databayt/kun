#!/usr/bin/env node
// The answering half of the Hub's agent window.
//
// A contributor describes a post on /social; the ask lands in
// SocialDraftRequest as `pending`. This script is how a Claude Code session on
// a human's machine picks it up and writes the copy back — against the Max
// subscription, so no API key and no per-draft spend (see
// .claude/memory/decisions/2026-07-30-in-app-draft-spend.md).
//
// Claude writes the copy. This script only moves it — same doctrine as the
// egress layer: the relays deliver, they never write.
//
//   node scripts/social-drafts.mjs list
//   node scripts/social-drafts.mjs answer <id> --ar <file> --en <file> [--media "url1,url2"]
//   node scripts/social-drafts.mjs attach <id> --media "url1,url2"
//   node scripts/social-drafts.mjs fail   <id> --note "why"
//   node scripts/social-drafts.mjs seed --auto [--brand hogwarts] [--count 2]
//   node scripts/social-drafts.mjs seed --brand hogwarts --brief "..."
//
// Copy goes in via FILES, not argv: brand copy is multi-line, contains quotes
// and Arabic, and argv mangles all three. Media goes in via URLS, comma-
// separated — a full draft is copy AND/OR media, and the URLs are library
// cdnUrls a session picked, never invented.
//
// `seed` is the calendar half of Loop B done billing-compliantly: instead of
// the Vercel cron drafting server-side (no compliant draft source — Hermes is
// down and API spend is off by decision), a scheduled local tick files the
// week's briefs as ordinary draft asks and the existing 5-minute drain answers
// them on the Max pool. Same queue, same doctrine, same human gate after.

// Raw SQL over the Neon driver rather than Prisma: the generated client is
// TypeScript, which a plain .mjs cannot import, and a handful of statements do
// not justify a build step. Every value is parameterised.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const url = (process.env.DATABASE_URL ?? "").trim();
if (!url) {
  console.error("DATABASE_URL is not set — check the central .env.");
  process.exit(1);
}

const sql = neon(url);

function flag(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function read(path, label) {
  if (!path) {
    console.error(`--${label} <file> is required.`);
    process.exit(1);
  }
  const text = readFileSync(path, "utf8").trim();
  if (!text) {
    console.error(`${path} is empty — nothing to store as ${label}.`);
    process.exit(1);
  }
  return text;
}

// --media "url1,url2" → validated array, or undefined when the flag is absent
// (absent means "leave the stored set alone" — never clobber an ask-time
// attachment with empty). Same gates as the server action: https, ≤ 10.
function parseMedia(raw) {
  if (raw === undefined) return undefined;
  const urls = raw
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  if (urls.length === 0) {
    console.error('--media given but empty — pass "url1,url2".');
    process.exit(1);
  }
  if (urls.length > 10) {
    console.error(`--media takes at most 10 URLs (got ${urls.length}).`);
    process.exit(1);
  }
  for (const u of urls) {
    if (!/^https?:\/\//i.test(u)) {
      console.error(`--media URLs must start with http(s):// — got "${u}".`);
      process.exit(1);
    }
  }
  return urls;
}

const [, , command, id] = process.argv;

if (command === "list") {
  const rows = await sql`
    SELECT "id", "brand", "brief", "requestedBy", "createdAt", "mediaUrls"
    FROM "SocialDraftRequest"
    WHERE "status" = 'pending'
    ORDER BY "createdAt" ASC
    LIMIT 20`;
  // Liveness proof for the Hub: every look at the queue — the scheduled
  // drainer or a human session — stamps the heartbeat the status panel and the
  // agent window read. "at" is set here because @updatedAt only fires through
  // Prisma, and this script is raw SQL.
  await sql`
    INSERT INTO "SystemHeartbeat" ("key", "at", "detail")
    VALUES ('draft-drain', now(), ${`pending ${rows.length}`})
    ON CONFLICT ("key") DO UPDATE
      SET "at" = now(), "detail" = EXCLUDED."detail"`;
  if (rows.length === 0) {
    // `--json` keeps the empty case machine-readable for drain-drafts.sh,
    // which must decide "invoke claude or not" without parsing prose.
    console.log(process.argv.includes("--json") ? "[]" : "No pending draft asks.");
  } else {
    // JSON so a session reads the briefs verbatim, Arabic intact.
    console.log(
      JSON.stringify(
        rows.map((r) => ({
          id: r.id,
          brand: r.brand,
          brief: r.brief,
          requestedBy: r.requestedBy,
          mediaUrls: r.mediaUrls ?? [],
          waitingMinutes: Math.round(
            (Date.now() - new Date(r.createdAt).getTime()) / 60000,
          ),
        })),
        null,
        2,
      ),
    );
  }
} else if (command === "answer") {
  if (!id) {
    console.error(
      'Usage: answer <id> --ar <file> --en <file> [--media "url1,url2"]',
    );
    process.exit(1);
  }
  const ar = read(flag("ar"), "ar");
  const en = read(flag("en"), "en");
  const media = parseMedia(flag("media"));
  // Conditional on `pending`: two sessions answering the same ask race here and
  // exactly one wins — the same guarantee the publish claim relies on.
  // Branched, not dynamically built: --media absent must leave the stored set
  // (an ask-time attachment) untouched, and the tagged template can't express
  // an optional SET.
  const done = media
    ? await sql`
        UPDATE "SocialDraftRequest"
           SET "status" = 'answered', "ar" = ${ar}, "en" = ${en},
               "mediaUrls" = ${media},
               "note" = ${flag("note") ?? "claude-code"}, "answeredAt" = now()
         WHERE "id" = ${id} AND "status" = 'pending'
        RETURNING "id"`
    : await sql`
        UPDATE "SocialDraftRequest"
           SET "status" = 'answered', "ar" = ${ar}, "en" = ${en},
               "note" = ${flag("note") ?? "claude-code"}, "answeredAt" = now()
         WHERE "id" = ${id} AND "status" = 'pending'
        RETURNING "id"`;
  if (done.length === 0) {
    const [row] = await sql`
      SELECT "status" FROM "SocialDraftRequest" WHERE "id" = ${id}`;
    console.error(
      row
        ? `Refused: that ask is already "${row.status}".`
        : `Refused: no ask with id ${id}.`,
    );
    process.exit(1);
  }
  console.log(
    `answered ${id} — ar ${ar.length} chars, en ${en.length} chars${
      media ? `, media ${media.length}` : ""
    }`,
  );
} else if (command === "attach") {
  // Replace the draft's media set — used by a full session after generating
  // via /higgs or /carousel, or to hand-pick from the library. REPLACES, so
  // pass the complete set you mean (read the current one with `list`).
  if (!id) {
    console.error('Usage: attach <id> --media "url1,url2"');
    process.exit(1);
  }
  const media = parseMedia(flag("media"));
  if (!media) {
    console.error('Usage: attach <id> --media "url1,url2"');
    process.exit(1);
  }
  // Pending or answered only — a consumed/dismissed draft is decided; media
  // changes after the decision would never be seen by anyone.
  const done = await sql`
    UPDATE "SocialDraftRequest"
       SET "mediaUrls" = ${media}
     WHERE "id" = ${id} AND "status" IN ('pending', 'answered')
    RETURNING "id", "status"`;
  if (done.length === 0) {
    const [row] = await sql`
      SELECT "status" FROM "SocialDraftRequest" WHERE "id" = ${id}`;
    console.error(
      row
        ? `Refused: that ask is "${row.status}" — media attaches to pending or answered only.`
        : `Refused: no ask with id ${id}.`,
    );
    process.exit(1);
  }
  console.log(`attached ${media.length} media to ${id} (${done[0].status})`);
} else if (command === "seed") {
  // File draft asks without a human at the window. Two modes:
  //   --brand X --brief "..."   one explicit ask
  //   --auto [--brand X] [--count N]   the week's briefs from pillars.json,
  //     picked by ISO-week rotation — stateless, so cadence IS the order.
  const by = flag("by") ?? "seed:weekly";

  // Prisma's cuid() default is client-side; a raw INSERT must bring its own id.
  const newId = () => `c${randomUUID().replace(/-/g, "").slice(0, 24)}`;

  async function insertAsk(brand, brief) {
    // One ask per (brand, brief) per 14 days, whatever its status — a re-run
    // Monday, a manual seed, and next week's overlap all collapse to one.
    const dupe = await sql`
      SELECT "id" FROM "SocialDraftRequest"
      WHERE "brand" = ${brand} AND "brief" = ${brief}
        AND "createdAt" > now() - interval '14 days'
      LIMIT 1`;
    if (dupe.length > 0) {
      console.log(`skip (asked within 14d): ${brief.slice(0, 60)}…`);
      return false;
    }
    const [row] = await sql`
      INSERT INTO "SocialDraftRequest" ("id", "brand", "brief", "requestedBy", "status", "createdAt")
      VALUES (${newId()}, ${brand}, ${brief}, ${by}, 'pending', now())
      RETURNING "id"`;
    console.log(`seeded ${row.id}: [${brand}] ${brief.slice(0, 60)}…`);
    return true;
  }

  if (process.argv.includes("--auto")) {
    const brand = flag("brand") ?? "hogwarts";
    const count = Math.max(1, Number(flag("count") ?? 2));
    const here = dirname(fileURLToPath(import.meta.url));
    const pillarsPath = join(here, "..", "content", "social", "pillars.json");
    const pillars = JSON.parse(readFileSync(pillarsPath, "utf8"));
    const briefs = pillars[brand];
    if (!Array.isArray(briefs) || briefs.length === 0) {
      console.error(`No briefs for "${brand}" in content/social/pillars.json.`);
      process.exit(1);
    }
    // ISO week number — stateless rotation anchor shared by every machine.
    // MIRROR of src/components/root/social/rotation.ts (the calendar panel's
    // copy — TS the .mjs cannot import). Keep the two in lockstep, or the
    // panel highlights briefs the seeder will not file.
    const now = new Date();
    const jan4 = new Date(Date.UTC(now.getUTCFullYear(), 0, 4));
    const week = Math.ceil(
      ((now - jan4) / 86400000 + ((jan4.getUTCDay() + 6) % 7) + 1) / 7,
    );
    let seeded = 0;
    for (let i = 0; i < count; i++) {
      const pick = briefs[(week * count + i) % briefs.length];
      if (await insertAsk(brand, pick.brief)) seeded++;
    }
    console.log(`seed --auto: week ${week}, ${seeded}/${count} filed for ${brand}.`);
  } else {
    const brand = flag("brand");
    const brief = flag("brief");
    if (!brand || !brief) {
      console.error('Usage: seed --auto [--brand X] [--count N] | seed --brand X --brief "..."');
      process.exit(1);
    }
    await insertAsk(brand, brief);
  }
} else if (command === "fail") {
  if (!id) {
    console.error('Usage: fail <id> --note "why"');
    process.exit(1);
  }
  const done = await sql`
    UPDATE "SocialDraftRequest"
       SET "status" = 'failed', "note" = ${flag("note") ?? "could not write it"},
           "answeredAt" = now()
     WHERE "id" = ${id} AND "status" = 'pending'
    RETURNING "id"`;
  console.log(done.length ? `failed ${id}` : `Refused: ${id} is not pending.`);
} else {
  console.log(
    [
      "Usage:",
      "  node scripts/social-drafts.mjs list",
      '  node scripts/social-drafts.mjs answer <id> --ar <file> --en <file> [--media "url1,url2"] [--note ...]',
      '  node scripts/social-drafts.mjs attach <id> --media "url1,url2"',
      '  node scripts/social-drafts.mjs fail   <id> --note "why"',
      "  node scripts/social-drafts.mjs seed --auto [--brand hogwarts] [--count 2]",
      '  node scripts/social-drafts.mjs seed --brand <brand> --brief "..."',
    ].join("\n"),
  );
}
