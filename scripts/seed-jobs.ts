#!/usr/bin/env tsx
// ── Seed the Job Engine from the staged campaign files ───────────────────────
//
//   pnpm db:seed:jobs --dry-run     print the report, write nothing
//   pnpm db:seed:jobs               write
//
// Reads jobs/*.normalized.json — the canonical campaign data, which is
// gitignored because jobs/cv/ next door holds real personal documents.
//
// Scoring goes through calculateDeterministicMatch rather than the Gemini path
// on purpose: reproducible across runs, and no API spend against a
// subscription-only billing posture.
//
// Idempotent by fingerprint. kun's Neon is ONE database shared by prod and
// local, so seeding here seeds everywhere — hence the precheck and the dry run.
//
// This constructs its own PrismaClient instead of importing src/lib/db.ts,
// which starts with `import "server-only"` and throws outside Next.

import { readFileSync, writeFileSync } from "node:fs";

import { PrismaNeon } from "@prisma/adapter-neon";
import dotenv from "dotenv";

import { PrismaClient } from "@/generated/prisma/client";
import type {
  EmploymentType,
  JobOpportunityStatus,
  RemoteType,
} from "@/generated/prisma/client";
import { evaluateCampaignMatches } from "@/lib/jobs/campaigns";
import { generateJobFingerprint } from "@/lib/jobs/deduplication";
import { buildEvidenceKnowledgeProfile } from "@/lib/jobs/evidence-extractor";
import { resolveJobLane } from "@/lib/jobs/lanes";
import { calculateDeterministicMatch } from "@/lib/jobs/matcher";
import { NormalizedJobInput } from "@/lib/jobs/types";

dotenv.config({ quiet: true });

/// The staged files carry three annotation fields on top of NormalizedJobInput.
/// They are the researcher's opinion, not engine state: `campaign` and `tier`
/// become a cross-check against what the engine computes, `note` rides along to
/// the CRM. None of them are persisted to JobOpportunity.
interface AnnotatedJob extends NormalizedJobInput {
  campaign: string;
  tier: string;
  note?: string;
}

const SOURCE_FILES = [
  "jobs/kigali-jobs.normalized.json",
  "jobs/remote-jobs.normalized.json",
] as const;

const DRY_RUN = process.argv.includes("--dry-run");

/// The engine's verdict per record, keyed by fingerprint. Written on every run
/// including a dry one, because the CRM push needs the engine's score and tier
/// rather than the researcher's staged guess — and that script is plain .mjs
/// which cannot import any of this. A file is the handoff.
const VERDICTS_FILE = "jobs/engine-verdicts.json";

interface Verdict {
  title: string;
  company: string;
  overallScore: number;
  recommendation: string;
  lane: string;
  whySummary: string;
  engineCampaigns: string[];
}

function stripAnnotations(job: AnnotatedJob): NormalizedJobInput {
  const { campaign: _campaign, tier: _tier, note: _note, ...clean } = job;
  return clean;
}

function statusFor(recommendation: string): JobOpportunityStatus {
  if (recommendation === "High Priority") return "high_priority";
  if (recommendation === "Strong Fit") return "qualified";
  return "analyzed";
}

async function main(): Promise<void> {
  const connectionString = (process.env.DATABASE_URL ?? "").trim();
  if (!connectionString) {
    console.error("DATABASE_URL is not set — check the central .env.");
    process.exit(1);
  }

  const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

  const staged: AnnotatedJob[] = SOURCE_FILES.flatMap(
    (f) => JSON.parse(readFileSync(f, "utf-8")) as AnnotatedJob[],
  );

  console.log(
    `${DRY_RUN ? "DRY RUN — " : ""}${staged.length} staged records from ${SOURCE_FILES.length} files\n`,
  );

  const profile = buildEvidenceKnowledgeProfile();
  console.log(
    `profile: ${profile.technologies.length} technologies · ${profile.capabilities.length} capabilities · ${profile.positioningRoles.length} positioning roles · ${profile.facts.length} facts\n`,
  );

  // One read, matched in memory. There is no fingerprint column, and adding one
  // would be a schema change for a job this small.
  const existing = await db.jobOpportunity.findMany({
    select: { title: true, company: true, remoteType: true },
  });
  const seen = new Set(
    existing.map((j) => generateJobFingerprint(j.title, j.company, j.remoteType)),
  );
  console.log(`${existing.length} rows already in JobOpportunity\n`);

  console.log(
    "score  engine rec       lane        status         campaign (engine / staged)                      title",
  );
  console.log("-".repeat(132));

  let created = 0;
  let skipped = 0;
  const disagreements: string[] = [];
  const verdicts: Record<string, Verdict> = {};

  for (const annotated of staged) {
    const job = stripAnnotations(annotated);
    const fingerprint = generateJobFingerprint(job.title, job.company, job.remoteType);

    // Scored before the skip check: an already-seeded record still needs its
    // verdict written, or a re-run would hand the CRM an incomplete file.
    const match = calculateDeterministicMatch(job, profile);
    const status = statusFor(match.recommendation);
    const lane = resolveJobLane(job);
    const engineCampaigns = evaluateCampaignMatches(job);

    verdicts[fingerprint] = {
      title: job.title,
      company: job.company,
      overallScore: match.overallScore,
      recommendation: match.recommendation,
      lane,
      whySummary: match.whySummary,
      engineCampaigns,
    };

    if (seen.has(fingerprint)) {
      skipped++;
      console.log(`  ---  already seeded                                                                          ${job.title.slice(0, 40)}`);
      continue;
    }
    seen.add(fingerprint);

    const campaignAgrees = engineCampaigns.includes(annotated.campaign);
    const tierAgrees = match.recommendation === annotated.tier;
    if (!campaignAgrees || !tierAgrees) {
      disagreements.push(
        `${job.title.slice(0, 44)} @ ${job.company.slice(0, 22)}\n` +
          `      staged: tier="${annotated.tier}" campaign="${annotated.campaign}"\n` +
          `      engine: tier="${match.recommendation}" campaign=[${engineCampaigns.join(", ") || "none"}]`,
      );
    }

    console.log(
      `${String(match.overallScore).padStart(4)}%  ${match.recommendation.padEnd(16)} ${lane.padEnd(11)} ${status.padEnd(14)} ` +
        `${(tierAgrees ? " " : "!") + (campaignAgrees ? " " : "!")} ${engineCampaigns.length}/${annotated.campaign.slice(0, 30).padEnd(31)} ${job.title.slice(0, 40)}`,
    );

    if (DRY_RUN) continue;

    await db.jobOpportunity.create({
      data: {
        title: job.title,
        company: job.company,
        companyUrl: job.companyUrl,
        location: job.location,
        remoteType: job.remoteType as RemoteType,
        employmentType: job.employmentType as EmploymentType,
        salary: job.salary,
        description: job.description,
        responsibilities: job.responsibilities,
        requiredSkills: job.requiredSkills,
        preferredSkills: job.preferredSkills,
        seniority: job.seniority,
        domain: job.domain,
        sourceUrl: job.sourceUrl,
        source: job.source || "manual",
        status,
        assessment: {
          create: {
            overallScore: match.overallScore,
            technicalMatch: match.dimensions.technical.score,
            capabilityMatch: match.dimensions.capability.score,
            domainMatch: match.dimensions.domain.score,
            experienceMatch: match.dimensions.seniority.score,
            recommendation: match.recommendation,
            whySummary: match.whySummary,
            strongEvidence: match.strongEvidence,
            criticalMissing: match.criticalMissing,
            niceToHaveMissing: match.niceToHaveMissing,
            risks: match.risks,
            talkingPoints: match.talkingPoints,
          },
        },
      },
    });
    created++;
  }

  writeFileSync(VERDICTS_FILE, JSON.stringify(verdicts, null, 2) + "\n");
  console.log(`\n${VERDICTS_FILE} <- ${Object.keys(verdicts).length} engine verdicts (for the CRM push)`);

  if (disagreements.length > 0) {
    console.log(
      `\n── where the engine disagrees with the researcher (${disagreements.length}) ──`,
    );
    console.log("   Neither is authoritative. Worth a look before applying.\n");
    for (const d of disagreements) console.log(`   • ${d}\n`);
  }

  console.log(
    DRY_RUN
      ? `\nDRY RUN — nothing written. ${staged.length - skipped} would be created, ${skipped} skipped as already present.`
      : `\nDone: ${created} created, ${skipped} skipped. Total rows now ${existing.length + created}.`,
  );

  await db.$disconnect();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
