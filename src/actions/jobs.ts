"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { buildEvidenceKnowledgeProfile } from "@/lib/jobs/evidence-extractor";
import { normalizeJobPosting } from "@/lib/jobs/normalizer";
import { matchJobAgainstProfile } from "@/lib/jobs/matcher";
import { pushJobToTwentyCRM } from "@/lib/jobs/twenty-crm";
import {
  EngineeringKnowledgeProfile,
  FullJobWithAssessment,
  JobStatus,
  MatchScoreBreakdown,
  NormalizedJobInput,
} from "@/lib/jobs/types";
import { JobOpportunityStatus, RemoteType, EmploymentType } from "@/generated/prisma/client";

export async function getEvidenceProfile(): Promise<EngineeringKnowledgeProfile> {
  // Extract live evidence from local repositories
  return buildEvidenceKnowledgeProfile();
}

export async function ingestAndAnalyzeJob(
  rawText: string,
  sourceUrl?: string
): Promise<{ ok: boolean; job?: FullJobWithAssessment; error?: string }> {
  try {
    if (!rawText || rawText.trim().length < 20) {
      return { ok: false, error: "Job posting text is too short. Please provide full description." };
    }

    const profile = buildEvidenceKnowledgeProfile();
    const normalized: NormalizedJobInput = await normalizeJobPosting(
      rawText,
      sourceUrl ? "url" : "manual",
      sourceUrl
    );

    const matchResult: MatchScoreBreakdown = await matchJobAgainstProfile(
      normalized,
      profile
    );

    const initialStatus: JobOpportunityStatus =
      matchResult.recommendation === "High Priority"
        ? "high_priority"
        : matchResult.recommendation === "Strong Fit"
        ? "qualified"
        : "analyzed";

    // Save to Database via Prisma
    const createdJob = await db.jobOpportunity.create({
      data: {
        title: normalized.title,
        company: normalized.company,
        companyUrl: normalized.companyUrl,
        location: normalized.location,
        remoteType: normalized.remoteType as RemoteType,
        employmentType: normalized.employmentType as EmploymentType,
        salary: normalized.salary,
        description: normalized.description,
        responsibilities: normalized.responsibilities,
        requiredSkills: normalized.requiredSkills,
        preferredSkills: normalized.preferredSkills,
        seniority: normalized.seniority,
        domain: normalized.domain,
        sourceUrl: normalized.sourceUrl,
        source: normalized.source || "manual",
        status: initialStatus,
        assessment: {
          create: {
            overallScore: matchResult.overallScore,
            technicalMatch: matchResult.technicalMatch,
            capabilityMatch: matchResult.capabilityMatch,
            domainMatch: matchResult.domainMatch,
            experienceMatch: matchResult.experienceMatch,
            recommendation: matchResult.recommendation,
            whySummary: matchResult.whySummary,
            strongEvidence: matchResult.strongEvidence,
            criticalMissing: matchResult.criticalMissing,
            niceToHaveMissing: matchResult.niceToHaveMissing,
            risks: matchResult.risks,
            talkingPoints: matchResult.talkingPoints,
          },
        },
      },
      include: {
        assessment: true,
      },
    });

    revalidatePath("/[lang]/jobs", "page");

    return {
      ok: true,
      job: createdJob as unknown as FullJobWithAssessment,
    };
  } catch (err) {
    console.error("Failed to ingest and analyze job:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to process job opportunity.",
    };
  }
}

export async function getJobsList(): Promise<FullJobWithAssessment[]> {
  try {
    const jobs = await db.jobOpportunity.findMany({
      include: {
        assessment: true,
      },
      orderBy: [
        {
          assessment: {
            overallScore: "desc",
          },
        },
        {
          createdAt: "desc",
        },
      ],
    });

    return jobs as unknown as FullJobWithAssessment[];
  } catch (err) {
    console.error("Failed to fetch jobs from DB:", err);
    return [];
  }
}

export async function getJobById(id: string): Promise<FullJobWithAssessment | null> {
  try {
    const job = await db.jobOpportunity.findUnique({
      where: { id },
      include: { assessment: true },
    });
    return job as unknown as FullJobWithAssessment | null;
  } catch (err) {
    console.error("Failed to fetch job by ID:", err);
    return null;
  }
}

export async function syncJobToCRM(
  jobId: string
): Promise<{ ok: boolean; message: string; url?: string; error?: string }> {
  try {
    const job = await getJobById(jobId);
    if (!job) {
      return { ok: false, error: "Job opportunity not found in database.", message: "Job not found." };
    }

    const res = await pushJobToTwentyCRM(job);
    if (res.ok && res.opportunityId) {
      await db.jobOpportunity.update({
        where: { id: jobId },
        data: {
          twentyOpportunityId: res.opportunityId,
          status: "high_priority",
        },
      });
      revalidatePath("/[lang]/jobs", "page");
    }

    return res;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to sync to CRM.",
      message: "Sync failed.",
    };
  }
}

export async function updateJobStatusAction(
  jobId: string,
  status: JobStatus
): Promise<{ ok: boolean }> {
  try {
    await db.jobOpportunity.update({
      where: { id: jobId },
      data: { status: status as JobOpportunityStatus },
    });
    revalidatePath("/[lang]/jobs", "page");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function deleteJobAction(jobId: string): Promise<{ ok: boolean }> {
  try {
    await db.jobOpportunity.delete({
      where: { id: jobId },
    });
    revalidatePath("/[lang]/jobs", "page");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
