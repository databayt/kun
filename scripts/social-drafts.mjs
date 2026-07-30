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
//   node scripts/social-drafts.mjs answer <id> --ar <file> --en <file>
//   node scripts/social-drafts.mjs fail   <id> --note "why"
//
// Copy goes in via FILES, not argv: brand copy is multi-line, contains quotes
// and Arabic, and argv mangles all three.

// Raw SQL over the Neon driver rather than Prisma: the generated client is
// TypeScript, which a plain .mjs cannot import, and three statements do not
// justify a build step. Every value is parameterised.
import { readFileSync } from "node:fs";
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

const [, , command, id] = process.argv;

if (command === "list") {
  const rows = await sql`
    SELECT "id", "brand", "brief", "requestedBy", "createdAt"
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
    console.error("Usage: answer <id> --ar <file> --en <file>");
    process.exit(1);
  }
  const ar = read(flag("ar"), "ar");
  const en = read(flag("en"), "en");
  // Conditional on `pending`: two sessions answering the same ask race here and
  // exactly one wins — the same guarantee the publish claim relies on.
  const done = await sql`
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
  console.log(`answered ${id} — ar ${ar.length} chars, en ${en.length} chars`);
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
      "  node scripts/social-drafts.mjs answer <id> --ar <file> --en <file> [--note ...]",
      '  node scripts/social-drafts.mjs fail   <id> --note "why"',
    ].join("\n"),
  );
}
