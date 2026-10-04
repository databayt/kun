#!/usr/bin/env tsx
// ── Ingest the job inbox: score, store, push to the CRM board ────────────────
//
//   pnpm jobs:ingest --dry-run         score and print, write nothing
//   pnpm jobs:ingest                   write Neon + push new rows to Twenty
//   pnpm jobs:ingest --file <path>     one inbox file instead of all of them
//
// The inbox is jobs/inbox/*.json — gitignored, written by discover.mjs and by
// the `jobs` skill's scan agents. Each item is a NormalizedJobInput plus the
// scanner's annotations: campaign, deadline, applyMethod, note, and for remote
// work rwandaEligible / payoutMethod / timeToFirstPay.
//
// Scoring is calculateDeterministicMatch, same as the seed: reproducible, and
// no API spend. The scanner's campaign wins over the text match — a scan that
// went looking for AI-training gigs knows what it found.
//
// Idempotent twice over: Neon by fingerprint, and pushJobToTwentyCRM skips a
// fingerprint the board already holds. kun's Neon is shared by prod and local,
// so the dry run is not optional ceremony.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { evaluateCampaignMatches } from "@/lib/jobs/campaigns";
import { generateJobFingerprint } from "@/lib/jobs/deduplication";
import { buildEvidenceKnowledgeProfile } from "@/lib/jobs/evidence-extractor";
import { calculateDeterministicMatch } from "@/lib/jobs/matcher";
import { pushJobToTwentyCRM } from "@/lib/jobs/twenty-crm";
import type {
  FullJobWithAssessment,
  NormalizedJobInput,
} from "@/lib/jobs/types";

import { parseApplyMethod } from "@/lib/jobs/apply-method";

import { similarRole } from "@/lib/jobs/deduplication";

import { BoardRow, listBoard, patchRow } from "./board";
import { createJobRow, openDb, statusFor } from "./engine";

const INBOX = "jobs/inbox";
const DRY_RUN = process.argv.includes("--dry-run");
const fileArg = process.argv.indexOf("--file");
const ONLY_FILE = fileArg > -1 ? process.argv[fileArg + 1] : undefined;

interface InboxItem extends NormalizedJobInput {
  campaign?: string;
  deadline?: string;
  applyMethod?: string;
  note?: string;
  rwandaEligible?: boolean | "unverified";
  payoutMethod?: string;
  timeToFirstPay?: string;
}

const REMOTE = new Set(["remote", "hybrid", "onsite"]);
const EMPLOYMENT = new Set(["full_time", "part_time", "contract", "freelance"]);

function clean(item: InboxItem): NormalizedJobInput {
  const {
    campaign: _c,
    deadline: _d,
    applyMethod: _a,
    note: _n,
    rwandaEligible: _r,
    payoutMethod: _p,
    timeToFirstPay: _t,
    ...job
  } = item;
  return {
    ...job,
    remoteType: REMOTE.has(job.remoteType) ? job.remoteType : "remote",
    employmentType: EMPLOYMENT.has(job.employmentType)
      ? job.employmentType
      : "contract",
    responsibilities: job.responsibilities ?? [],
    requiredSkills: job.requiredSkills ?? [],
    preferredSkills: job.preferredSkills ?? [],
    description: job.description ?? "",
  };
}

/// "rolling" and missing deadlines are open; a dated one closes at the end of
/// its day, Kigali time being close enough to UTC for that to hold.
function isExpired(deadline: string | undefined, today: string): boolean {
  return !!deadline && /^\d{4}-\d{2}-\d{2}$/.test(deadline) && deadline < today;
}

function crmNote(item: InboxItem): string {
  return [
    item.applyMethod && `Apply: ${item.applyMethod}`,
    item.deadline && `Deadline: ${item.deadline}`,
    item.salary && `Pay: ${item.salary}`,
    item.payoutMethod && `Payout: ${item.payoutMethod}`,
    item.timeToFirstPay && `First pay: ${item.timeToFirstPay}`,
    item.rwandaEligible !== undefined &&
      `Rwanda eligible: ${item.rwandaEligible}`,
    item.note,
  ]
    .filter(Boolean)
    .join(" · ");
}

async function main(): Promise<void> {
  const files = ONLY_FILE
    ? [ONLY_FILE]
    : readdirSync(INBOX)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map((f) => join(INBOX, f));

  const items: InboxItem[] = files.flatMap(
    (f) => JSON.parse(readFileSync(f, "utf-8")) as InboxItem[],
  );
  const today = new Date().toISOString().slice(0, 10);

  console.log(
    `${DRY_RUN ? "DRY RUN — " : ""}${items.length} inbox items from ${files.length} file(s)\n`,
  );

  const db = openDb();
  const profile = buildEvidenceKnowledgeProfile();
  // The board, for near-duplicate checks: the same role reached through two
  // sources with different wording must not become two cards (two sends).
  const boardRows: BoardRow[] = await listBoard();
  const firstWord = (c: string) => c.toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim().split(/\s+/)[0] ?? "";
  const nearDuplicate = (job: NormalizedJobInput, email?: string): BoardRow | undefined =>
    boardRows.find((r) => {
      const at = r.name.lastIndexOf(" @ ");
      const role = at > -1 ? r.name.slice(0, at) : r.name;
      const company = at > -1 ? r.name.slice(at + 3) : "";
      const sameEmployer = (!!email && r.applyEmail === email) || firstWord(company) === firstWord(job.company);
      return sameEmployer && similarRole(role, job.title);
    });

  const existing = await db.jobOpportunity.findMany({
    select: {
      id: true,
      title: true,
      company: true,
      remoteType: true,
      twentyOpportunityId: true,
    },
  });
  const byFingerprint = new Map(
    existing.map((j) => [
      generateJobFingerprint(j.title, j.company, j.remoteType),
      j,
    ]),
  );

  const seenThisRun = new Set<string>();
  let created = 0;
  let pushed = 0;
  let skipped = 0;
  const dropped: string[] = [];

  console.log(
    "score  rec              campaign                        title @ company",
  );
  console.log("-".repeat(110));

  for (const item of items) {
    const job = clean(item);
    if (!job.title || !job.company) {
      dropped.push(
        `missing title/company: ${JSON.stringify(item).slice(0, 80)}`,
      );
      continue;
    }
    if (isExpired(item.deadline, today)) {
      dropped.push(`expired ${item.deadline}: ${job.title} @ ${job.company}`);
      continue;
    }
    if (item.rwandaEligible === false) {
      dropped.push(`not open to Rwanda: ${job.title} @ ${job.company}`);
      continue;
    }

    const fingerprint = generateJobFingerprint(
      job.title,
      job.company,
      job.remoteType,
    );
    if (seenThisRun.has(fingerprint)) {
      skipped++;
      continue;
    }
    seenThisRun.add(fingerprint);

    const match = calculateDeterministicMatch(job, profile);
    // A curated scan (a person or agent read the posting) always reaches the
    // board; a regex adapter's find has to earn it, or the board fills with
    // designers and ops roles that matched a tag.
    const autoDiscovered = item.note?.startsWith("Auto-discovered") ?? false;
    if (autoDiscovered && match.recommendation === "Low Probability") {
      dropped.push(`low score ${match.overallScore}% (auto-discovered): ${job.title} @ ${job.company}`);
      continue;
    }
    const campaignId = item.campaign ?? evaluateCampaignMatches(job)[0] ?? "—";
    console.log(
      `${String(match.overallScore).padStart(4)}%  ${match.recommendation.padEnd(16)} ${campaignId.slice(0, 31).padEnd(31)} ${job.title.slice(0, 40)} @ ${job.company.slice(0, 24)}`,
    );

    const known = byFingerprint.get(fingerprint);
    if (!known) {
      const twin = nearDuplicate(job, parseApplyMethod(item.applyMethod).applyEmail);
      if (twin) {
        dropped.push(`same role already on the board as "${twin.name}"`);
        continue;
      }
    }
    if (known?.twentyOpportunityId) {
      skipped++;
      continue;
    }
    if (DRY_RUN) continue;

    const row = known
      ? await db.jobOpportunity.findUniqueOrThrow({
          where: { id: known.id },
          include: { assessment: true },
        })
      : await createJobRow(db, job, match);
    if (!known) created++;

    const res = await pushJobToTwentyCRM(
      row as unknown as FullJobWithAssessment,
      {
        campaignId: item.campaign,
        deadline: item.deadline,
        note: crmNote(item),
      },
    );
    if (res.ok && res.opportunityId) {
      await db.jobOpportunity.update({
        where: { id: row.id },
        data: {
          twentyOpportunityId: res.opportunityId,
          status: statusFor(match.recommendation),
        },
      });
      pushed++;
    } else {
      dropped.push(
        `CRM push failed: ${job.title} @ ${job.company} — ${res.error ?? res.message}`,
      );
    }
  }

  // Rows pushed before the send loop existed have no channel/applyEmail. The
  // inbox still knows how each one is applied to, so fill the gap in place.
  if (!DRY_RUN) {
    const methods = new Map(
      items
        .filter((i) => i.applyMethod && i.title && i.company)
        .map((i) => [generateJobFingerprint(i.title, i.company, clean(i).remoteType), i]),
    );
    let filled = 0;
    for (const row of await listBoard()) {
      if (!row.fingerprint || !methods.has(row.fingerprint)) continue;
      const found = methods.get(row.fingerprint) as InboxItem;
      const fields = parseApplyMethod(found.applyMethod);
      if (!fields.channel) continue;
      // Fill a gap, or upgrade a portal card once a posting turns out to name
      // an address — that is what makes it sendable by the loop.
      // WhatsApp is sendable too, but email wins when a posting names both.
      const upgrade =
        row.applicationStatus === "TO_APPLY" &&
        ((fields.channel === "EMAIL" && row.channel !== "EMAIL") ||
          (fields.channel === "WHATSAPP" && row.channel !== "EMAIL" && row.channel !== "WHATSAPP"));
      if (row.channel && !upgrade) continue;
      // The gate checks the recipient against the card's page, so an upgraded
      // card must point at the page where the address was published.
      await patchRow(row.id, {
        ...fields,
        ...(upgrade && found.sourceUrl
          ? { jobUrl: { primaryLinkUrl: found.sourceUrl, primaryLinkLabel: "", secondaryLinks: [] } }
          : {}),
      });
      filled++;
    }
    if (filled) console.log(`\nbackfilled channel/applyEmail on ${filled} existing board rows`);
  }

  if (dropped.length) {
    console.log(`\n── dropped (${dropped.length}) ──`);
    for (const d of dropped) console.log(`   • ${d}`);
  }

  console.log(
    DRY_RUN
      ? `\nDRY RUN — nothing written. ${seenThisRun.size - skipped} new, ${skipped} already on the board.`
      : `\nDone: ${created} new rows, ${pushed} pushed to sales.databayt.org, ${skipped} already there.`,
  );
  await db.$disconnect();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
