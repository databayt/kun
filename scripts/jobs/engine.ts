// ── Shared engine plumbing for the job scripts ───────────────────────────────
//
// seed-jobs.ts (the hand-staged August campaign) and jobs/ingest.ts (the daily
// inbox) write the same JobOpportunity + JobAssessment shape. One writer, so a
// schema change is one edit.
//
// Builds its own PrismaClient: src/lib/db.ts starts with `import "server-only"`
// and throws outside Next.

import { PrismaNeon } from "@prisma/adapter-neon";
import dotenv from "dotenv";

import { PrismaClient } from "@/generated/prisma/client";
import type {
  EmploymentType,
  JobOpportunityStatus,
  RemoteType,
} from "@/generated/prisma/client";
import { calculateDeterministicMatch } from "@/lib/jobs/matcher";
import { NormalizedJobInput } from "@/lib/jobs/types";

dotenv.config({ quiet: true });

export type Match = ReturnType<typeof calculateDeterministicMatch>;

export function openDb(): PrismaClient {
  const connectionString = (process.env.DATABASE_URL ?? "").trim();
  if (!connectionString) {
    console.error("DATABASE_URL is not set — check the central .env.");
    process.exit(1);
  }
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
}

export function statusFor(recommendation: string): JobOpportunityStatus {
  if (recommendation === "High Priority") return "high_priority";
  if (recommendation === "Strong Fit") return "qualified";
  return "analyzed";
}

export async function createJobRow(db: PrismaClient, job: NormalizedJobInput, match: Match) {
  return db.jobOpportunity.create({
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
      status: statusFor(match.recommendation),
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
    include: { assessment: true },
  });
}
