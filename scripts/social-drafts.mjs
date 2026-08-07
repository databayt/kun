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
//   node scripts/social-drafts.mjs lessons [--brand hogwarts]
//   node scripts/social-drafts.mjs check [<id>] --ar <file> [--en <file>] [--brief <file>]
//   node scripts/social-drafts.mjs answer <id> --ar <file> --en <file> [--media "url1,url2"]
//   node scripts/social-drafts.mjs attach <id> --media "url1,url2"
//   node scripts/social-drafts.mjs fail   <id> --note "why"
//   node scripts/social-drafts.mjs seed --auto [--brand hogwarts] [--count 2]
//   node scripts/social-drafts.mjs seed --brand hogwarts --brief "..."
//
// `list` carries an ask's DIRECTION as well as its brief — the knobs a
// contributor set, and for a refinement turn the previous draft plus what to
// change about it. `lessons` is the other half of the same idea, backwards:
// what reviewers rejected recently, so a run can stop repeating it.
//
// `answer` RUNS THE CRAFT GATE and refuses a draft that trips copy.mdx's reject
// list (scripts/lib/craft.mjs). That page calls those items "auto-fail, no
// discussion", and until 2026-08-06 nothing executed the sentence — the pipeline
// could stop a false post and not a boring one. `check` is the same gate on
// loose files, for a hand-run session or a reviewer's edit.
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
import { compileBrief } from "./lib/brand-kit.mjs";
import { checkCraft, craftFailures, formatCraft } from "./lib/craft.mjs";

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
  // LEFT JOIN twice, because a pending ask can be two things the writer must
  // see whole:
  //   parent    — the turn being refined. Without its copy the instruction
  //               ("sharper hook") names nothing, and the writer would answer
  //               the root brief again from scratch.
  //   reference — "write it like this one". Its Arabic IS the direction.
  const rows = await sql`
    SELECT r."id", r."brand", r."brief", r."requestedBy", r."createdAt",
           r."mediaUrls", r."turn", r."instruction",
           r."model", r."angle", r."register",
           p."ar" AS "parentAr", p."en" AS "parentEn",
           ref."ar" AS "referenceAr"
    FROM "SocialDraftRequest" r
    LEFT JOIN "SocialDraftRequest" p   ON p."id"   = r."parentId"
    LEFT JOIN "SocialDraftRequest" ref ON ref."id" = r."referenceId"
    WHERE r."status" = 'pending'
    ORDER BY r."createdAt" ASC
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
    // JSON so a session reads the briefs verbatim, Arabic intact. Keys are
    // omitted rather than sent null: an ask with no direction should LOOK like
    // an ask with no direction, so the writer runs its own three-angle
    // discipline instead of reading `"angle": null` as a field to satisfy.
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
          ...(r.turn > 1 && {
            turn: r.turn,
            // The refinement contract, in one place: what to change, and the
            // exact text to change. Both or neither — an instruction without
            // the previous draft is not actionable.
            refine: {
              instruction: r.instruction,
              previousAr: r.parentAr,
              previousEn: r.parentEn,
            },
          }),
          ...(r.model && { model: r.model }),
          ...(r.angle && { angle: r.angle }),
          ...(r.register && { register: r.register }),
          ...(r.referenceAr && { referenceAr: r.referenceAr }),
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
  let craftNote = null;

  // ── The craft gate ─────────────────────────────────────────────
  // copy.mdx's reject list says "auto-fail, no discussion". This is that
  // sentence, executed — and it runs HERE rather than at review because the
  // writing session is still in context, so a rewrite is nearly free, while a
  // reviewer rejection costs a human twenty seconds plus a full turnaround.
  //
  // The numbers a draft may carry come from the brief AND, on a refinement turn,
  // the instruction and the parent draft — copy.mdx's "not present in the brief"
  // was written before threads existed, and by turn three the brief alone would
  // fail a figure the reviewer themselves asked for. (A number that slipped
  // through on the parent stays allowed on its children: the alternative is
  // re-litigating an accepted draft on every refinement.)
  const [ask] = await sql`
    SELECT r."brand", r."brief", r."instruction",
           p."ar" AS "parentAr", p."en" AS "parentEn"
      FROM "SocialDraftRequest" r
      LEFT JOIN "SocialDraftRequest" p ON p."id" = r."parentId"
     WHERE r."id" = ${id}`;
  if (ask) {
    const findings = checkCraft({
      ar,
      en,
      brand: ask.brand,
      allowedFrom: [ask.brief, ask.instruction, ask.parentAr, ask.parentEn]
        .filter(Boolean)
        .join("\n"),
    });
    const failures = craftFailures(findings);
    const override = flag("craft-override");
    if (failures.length && !override) {
      console.error(formatCraft(findings));
      console.error(
        `\nRefused: ${failures.length} hard failure(s) against content/docs/social/copy.mdx.\n` +
          `Rewrite and answer again. If a rule is wrong for THIS draft, pass\n` +
          `--craft-override "<why>" — the reason is stored on the row so a\n` +
          `reviewer sees it. If it cannot pass after two rewrites, fail the ask\n` +
          `with the findings rather than looping.`,
      );
      process.exit(1);
    }
    if (findings.length) console.error(formatCraft(findings));
    if (failures.length && override) {
      console.error(`\ncraft overridden: ${override}`);
      // The note is rendered verbatim to the asker in the agent window, so an
      // override arrives where the decision is reviewed rather than only in a
      // log nobody opens.
      craftNote = `craft override (${failures.map((f) => f.rule).join(", ")}): ${override}`;
    }
  }
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
               "note" = ${craftNote ?? flag("note") ?? "claude-code"}, "answeredAt" = now()
         WHERE "id" = ${id} AND "status" = 'pending'
        RETURNING "id"`
    : await sql`
        UPDATE "SocialDraftRequest"
           SET "status" = 'answered', "ar" = ${ar}, "en" = ${en},
               "note" = ${craftNote ?? flag("note") ?? "claude-code"}, "answeredAt" = now()
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

  // The seat lane's half of the same tick. A copy ask goes to the drain, which
  // answers it on the Max pool; a media brief goes to /social/media, where a
  // person with a ChatGPT seat renders it. Both come from one pillar, so the
  // week's picture and the week's words are about the same thing — which is the
  // whole reason to seed them together rather than let someone invent a scene.
  //
  // Only pillars carrying a `visual` file one. A null visual means the template
  // lane owns that post's image, and filling a human's queue with work that
  // renders better as HTML is worse than filing nothing.
  async function insertMediaBrief(brand, visual) {
    if (!visual || !visual.type || !visual.subject) return false;

    const dupe = await sql`
      SELECT "id" FROM "SocialMediaBrief"
      WHERE "brand" = ${brand} AND "subject" = ${visual.subject}
        AND "createdAt" > now() - interval '14 days'
      LIMIT 1`;
    if (dupe.length > 0) {
      console.log(`skip media (filed within 14d): ${visual.subject.slice(0, 50)}…`);
      return false;
    }

    let compiled;
    try {
      compiled = compileBrief(brand, visual.type, visual.subject);
    } catch (err) {
      // A pillar naming a template-lane type is a data mistake, not a reason to
      // abandon the tick — the copy ask above already landed.
      console.error(`skip media (${err.message})`);
      return false;
    }

    const [row] = await sql`
      INSERT INTO "SocialMediaBrief"
        ("id", "brand", "assetType", "subject", "prompt", "size", "status", "createdAt")
      VALUES (${newId()}, ${brand}, ${visual.type}, ${visual.subject},
              ${compiled.prompt}, ${compiled.size}, 'pending', now())
      RETURNING "id"`;
    console.log(`seeded media ${row.id}: [${brand}/${visual.type}] ${visual.subject.slice(0, 50)}…`);
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
    let media = 0;
    for (let i = 0; i < count; i++) {
      const pick = briefs[(week * count + i) % briefs.length];
      if (await insertAsk(brand, pick.brief)) seeded++;
      if (await insertMediaBrief(brand, pick.visual)) media++;
    }
    console.log(
      `seed --auto: week ${week}, ${seeded}/${count} copy asks and ${media} media briefs filed for ${brand}.`,
    );
  } else {
    const brand = flag("brand");
    const brief = flag("brief");
    if (!brand || !brief) {
      console.error('Usage: seed --auto [--brand X] [--count N] | seed --brand X --brief "..."');
      process.exit(1);
    }
    await insertAsk(brand, brief);
  }
} else if (command === "lessons") {
  // What the reviewers rejected lately, so the next run does not repeat it.
  //
  // copy.mdx says the pipeline's feedback loop is "dismiss reasons on the review
  // queue, and the angles the drain prints to its daily log". Both were being
  // WRITTEN and neither was ever READ: the reason went into a prose `note` no
  // query could group, and the angles went to a log file on one laptop. This
  // subcommand is the read half. It is the cheapest quality lever in the
  // pipeline — no model call, no new state, just showing the writer what a
  // human already said about its last twenty drafts.
  //
  // 60 days: long enough to survive a slow fortnight at ~2 posts/week, short
  // enough that a bar we have since raised stops being cited as current.
  const brand = flag("brand");
  const rows = brand
    ? await sql`
        SELECT "brand", "dismissReason", "note", "ar", "answeredAt"
        FROM "SocialDraftRequest"
        WHERE "status" = 'dismissed' AND "dismissReason" IS NOT NULL
          AND "brand" = ${brand}
          AND "answeredAt" > now() - interval '60 days'
        ORDER BY "answeredAt" DESC
        LIMIT 20`
    : await sql`
        SELECT "brand", "dismissReason", "note", "ar", "answeredAt"
        FROM "SocialDraftRequest"
        WHERE "status" = 'dismissed' AND "dismissReason" IS NOT NULL
          AND "answeredAt" > now() - interval '60 days'
        ORDER BY "answeredAt" DESC
        LIMIT 20`;

  if (rows.length === 0) {
    // Said plainly, because "no lessons" and "the query broke" must not read
    // the same to a session that is about to write without them.
    console.log(
      "No dismissals recorded in the last 60 days — nothing to correct for.",
    );
  } else {
    const byReason = new Map();
    for (const r of rows) {
      if (!byReason.has(r.dismissReason)) byReason.set(r.dismissReason, []);
      byReason.get(r.dismissReason).push(r);
    }
    console.log(
      `Dismissed in the last 60 days${brand ? ` for ${brand}` : ""} — ${rows.length} draft(s).`,
    );
    console.log(
      "These are drafts a human refused AFTER a session judged them finished. Read the first lines: whatever they have in common is the habit to break.\n",
    );
    // Most-common failure first — that ordering IS the instruction.
    const ranked = [...byReason.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [reason, group] of ranked) {
      console.log(`## ${reason} — ${group.length}×`);
      for (const r of group) {
        const firstLine = (r.ar ?? "").split("\n")[0].slice(0, 90);
        console.log(`  [${r.brand}] ${firstLine}`);
      }
      console.log("");
    }
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
} else if (command === "check") {
  // The same gate `answer` runs, reachable on loose files — for a hand-run
  // /draft that wants the verdict before it commits to an ask, and for a
  // reviewer checking an edit. Exits 1 on any hard failure so a shell can
  // branch on it.
  //
  // `id` is the second positional, so `check <id>` pulls the brief (and a
  // refinement's parent) straight from the queue rather than making a caller
  // paste it into a file.
  const ar = read(flag("ar"), "ar");
  const en = flag("en") ? read(flag("en"), "en") : undefined;
  let brand = flag("brand");
  let allowedFrom = flag("brief") ? read(flag("brief"), "brief") : undefined;
  // `id` is positional, so a flag lands in it when the id is omitted. Every
  // other command requires one and never hit this; check's is optional.
  const askId = id && !id.startsWith("--") ? id : undefined;
  if (askId) {
    const [ask] = await sql`
      SELECT r."brand", r."brief", r."instruction",
             p."ar" AS "parentAr", p."en" AS "parentEn"
        FROM "SocialDraftRequest" r
        LEFT JOIN "SocialDraftRequest" p ON p."id" = r."parentId"
       WHERE r."id" = ${askId}`;
    if (!ask) {
      console.error(`No ask with id ${askId}.`);
      process.exit(1);
    }
    brand = brand ?? ask.brand;
    allowedFrom =
      allowedFrom ??
      [ask.brief, ask.instruction, ask.parentAr, ask.parentEn]
        .filter(Boolean)
        .join("\n");
  }
  const findings = checkCraft({ ar, en, brand, allowedFrom, channel: flag("channel") });
  console.log(formatCraft(findings));
  const failures = craftFailures(findings);
  if (allowedFrom === undefined) {
    console.log(
      "\nnote: no brief given, so the invented-number guard did not run — pass --brief <file> or a draft id.",
    );
  }
  if (failures.length) {
    console.log(`\n${failures.length} hard failure(s).`);
    process.exit(1);
  }
} else if (command === "drain-google") {
  const pending = await sql`
    SELECT "id", "brand", "brief", "instruction", "angle", "register", "model"
      FROM "SocialDraftRequest"
     WHERE "status" = 'pending'
       AND ("model" IS NULL OR "model" = 'google-free')
     ORDER BY "createdAt" ASC`;

  if (!pending.length) {
    console.log("No google-free pending asks.");
    process.exit(0);
  }

  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set.");
    process.exit(1);
  }

  for (const ask of pending) {
    console.log(`Draining google-free ask ${ask.id} (${ask.brand}: ${ask.brief})...`);
    const promptText = `You are Databayt's lead social media writer for MENA.
Write a social media post for product: ${ask.brand}.
User Brief: ${ask.brief}
${ask.instruction ? `Refinement Instruction: ${ask.instruction}` : ""}
Angle: ${ask.angle ?? "pain"}
Arabic Register: Rung ${ask.register ?? 2}

House Rules:
- Return ONLY valid JSON with keys "ar" and "en".
- Arabic ("ar"): 300-600 characters, native Arabic. Use Latin digits (1, 2, 3).
- English ("en"): 300-600 characters, plain and concrete.
- JSON: {"ar": "...", "en": "..."}`;

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.7,
            },
          }),
        },
      );
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty Gemini response");
      const parsed = JSON.parse(text);
      if (!parsed.ar || !parsed.en) throw new Error("Invalid ar/en structure");

      await sql`
        UPDATE "SocialDraftRequest"
           SET "status" = 'answered',
               "ar" = ${parsed.ar.trim()},
               "en" = ${parsed.en.trim()},
               "answeredAt" = NOW()
         WHERE "id" = ${ask.id}`;

      console.log(`✅ Answered ${ask.id} via Gemini 2.5 Flash.`);
    } catch (err) {
      console.error(`Failed to drain ${ask.id}:`, err.message);
    }
  }
} else {
  console.log(
    [
      "Usage:",
      "  node scripts/social-drafts.mjs list",
      "  node scripts/social-drafts.mjs drain-google",
      "  node scripts/social-drafts.mjs lessons [--brand hogwarts]",
      "  node scripts/social-drafts.mjs check [<id>] --ar <file> [--en <file>] [--brief <file>] [--brand X] [--channel Y]",
      '  node scripts/social-drafts.mjs answer <id> --ar <file> --en <file> [--media "url1,url2"] [--note ...]',
      '  node scripts/social-drafts.mjs attach <id> --media "url1,url2"',
      '  node scripts/social-drafts.mjs fail   <id> --note "why"',
      "  node scripts/social-drafts.mjs seed --auto [--brand hogwarts] [--count 2]",
      '  node scripts/social-drafts.mjs seed --brand <brand> --brief "..."',
    ].join("\n"),
  );
}
