"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  calculateCampaignPerformance,
  calculateConversionFunnel,
  calculatePositioningPerformance,
  calculateSourceQuality,
  generateWeeklyJobSearchReview,
} from "@/lib/jobs/conversion-funnel";
import { attachJobFingerprint } from "@/lib/jobs/deduplication";
import { buildEvidenceKnowledgeProfile } from "@/lib/jobs/evidence-extractor";
import { matchJobAgainstProfile } from "@/lib/jobs/matcher";
import { normalizeJobPosting } from "@/lib/jobs/normalizer";
import { analyzeProblemAndBuilderFit, calculateDeterministicProblemMatch } from "@/lib/jobs/problem-matcher";
import { generateApplicationStrategy, calculateDeterministicStrategy } from "@/lib/jobs/strategy-generator";
import { pushJobToTwentyCRM } from "@/lib/jobs/twenty-crm";
import {
  ApplicationStrategy,
  CampaignConversionPerformance,
  CareerConversionFunnel,
  EmploymentType,
  EngineeringKnowledgeProfile,
  FullJobWithAssessment,
  JobOpportunityStatus,
  JobStatus,
  MatchScoreBreakdown,
  NormalizedJobInput,
  OutcomeCategory,
  OutcomeReasonCategory,
  PositioningConversionPerformance,
  ProblemMatchAnalysis,
  RemoteType,
  SourceQualityPerformance,
  WeeklyJobSearchReview,
} from "@/lib/jobs/types";

export async function ingestAndAnalyzeJob(
  rawText: string,
  sourceUrl?: string
): Promise<{ ok: boolean; job?: FullJobWithAssessment; error?: string }> {
  try {
    if (!rawText.trim()) {
      return { ok: false, error: "Job posting text cannot be empty." };
    }

    const profile = buildEvidenceKnowledgeProfile();
    let normalized: NormalizedJobInput = await normalizeJobPosting(
      rawText,
      sourceUrl ? "url" : "manual",
      sourceUrl
    );
    normalized = attachJobFingerprint(normalized);

    const matchResult: MatchScoreBreakdown = await matchJobAgainstProfile(
      normalized,
      profile
    );

    const problemAnalysis: ProblemMatchAnalysis = await analyzeProblemAndBuilderFit(
      normalized,
      profile
    );

    const strategy: ApplicationStrategy = await generateApplicationStrategy(
      normalized,
      matchResult,
      problemAnalysis,
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
            technicalMatch: matchResult.dimensions.technical.score,
            capabilityMatch: matchResult.dimensions.capability.score,
            domainMatch: matchResult.dimensions.domain.score,
            experienceMatch: matchResult.dimensions.seniority.score,
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

    const fullResult: FullJobWithAssessment = {
      ...(createdJob as unknown as FullJobWithAssessment),
      problemMatch: problemAnalysis,
      strategy,
    };

    return {
      ok: true,
      job: fullResult,
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
      orderBy: {
        createdAt: "desc",
      },
    });

    const profile = buildEvidenceKnowledgeProfile();

    return jobs.map((j) => {
      const normalized: NormalizedJobInput = {
        title: j.title,
        company: j.company,
        companyUrl: j.companyUrl || undefined,
        location: j.location || undefined,
        remoteType: j.remoteType as RemoteType,
        employmentType: j.employmentType as EmploymentType,
        salary: j.salary || undefined,
        description: j.description,
        responsibilities: j.responsibilities,
        requiredSkills: j.requiredSkills,
        preferredSkills: j.preferredSkills,
        seniority: j.seniority || undefined,
        domain: j.domain || undefined,
        sourceUrl: j.sourceUrl || undefined,
        source: j.source,
      };

      const problemMatch = calculateDeterministicProblemMatch(normalized, profile);
      const fakeMatchResult: MatchScoreBreakdown = {
        overallScore: j.assessment?.overallScore ?? 75,
        fitConfidence: "high",
        confidenceReasoning: "Grounded in verified codebase evidence.",
        dimensions: {
          technical: {
            name: "Technical Match",
            score: j.assessment?.technicalMatch ?? 75,
            weight: 0.4,
            weightedContribution: Math.round((j.assessment?.technicalMatch ?? 75) * 0.4),
            explanation: "",
            contributingFacts: [],
          },
          capability: {
            name: "Capability Match",
            score: j.assessment?.capabilityMatch ?? 85,
            weight: 0.3,
            weightedContribution: Math.round((j.assessment?.capabilityMatch ?? 85) * 0.3),
            explanation: "",
            contributingFacts: [],
          },
          domain: {
            name: "Domain Match",
            score: j.assessment?.domainMatch ?? 80,
            weight: 0.15,
            weightedContribution: Math.round((j.assessment?.domainMatch ?? 80) * 0.15),
            explanation: "",
            contributingFacts: [],
          },
          seniority: {
            name: "Seniority Realism",
            score: j.assessment?.experienceMatch ?? 80,
            weight: 0.15,
            weightedContribution: Math.round((j.assessment?.experienceMatch ?? 80) * 0.15),
            explanation: "",
            contributingFacts: [],
          },
        },
        recommendation: (j.assessment?.recommendation as MatchScoreBreakdown["recommendation"]) || "Strong Fit",
        whySummary: j.assessment?.whySummary || "",
        positiveContributions: [],
        negativeDeductions: [],
        strongEvidence: j.assessment?.strongEvidence || [],
        blockers: (j.assessment?.criticalMissing || []).map((m) => ({
          skillOrRequirement: m,
          severity: "hard_blocker" as const,
          reason: "Identified gap",
        })),
        criticalMissing: j.assessment?.criticalMissing || [],
        niceToHaveMissing: j.assessment?.niceToHaveMissing || [],
        risks: j.assessment?.risks || [],
        assumptions: [],
        talkingPoints: j.assessment?.talkingPoints || [],
      };

      const strategy = calculateDeterministicStrategy(normalized, fakeMatchResult, problemMatch, profile);

      return {
        ...(j as unknown as FullJobWithAssessment),
        problemMatch,
        strategy,
      };
    });
  } catch (err) {
    console.error("Failed to list jobs:", err);
    return [];
  }
}

export async function getJobById(id: string): Promise<FullJobWithAssessment | null> {
  try {
    const job = await db.jobOpportunity.findUnique({
      where: { id },
      include: {
        assessment: true,
      },
    });

    if (!job) return null;

    const profile = buildEvidenceKnowledgeProfile();
    const normalized: NormalizedJobInput = {
      title: job.title,
      company: job.company,
      companyUrl: job.companyUrl || undefined,
      location: job.location || undefined,
      remoteType: job.remoteType as RemoteType,
      employmentType: job.employmentType as EmploymentType,
      salary: job.salary || undefined,
      description: job.description,
      responsibilities: job.responsibilities,
      requiredSkills: job.requiredSkills,
      preferredSkills: job.preferredSkills,
      seniority: job.seniority || undefined,
      domain: job.domain || undefined,
      sourceUrl: job.sourceUrl || undefined,
      source: job.source,
    };

    const problemMatch = calculateDeterministicProblemMatch(normalized, profile);
    const fakeMatchResult: MatchScoreBreakdown = {
      overallScore: job.assessment?.overallScore ?? 75,
      fitConfidence: "high",
      confidenceReasoning: "Grounded in verified codebase evidence.",
      dimensions: {
        technical: {
          name: "Technical Match",
          score: job.assessment?.technicalMatch ?? 75,
          weight: 0.4,
          weightedContribution: Math.round((job.assessment?.technicalMatch ?? 75) * 0.4),
          explanation: "",
          contributingFacts: [],
        },
        capability: {
          name: "Capability Match",
          score: job.assessment?.capabilityMatch ?? 85,
          weight: 0.3,
          weightedContribution: Math.round((job.assessment?.capabilityMatch ?? 85) * 0.3),
          explanation: "",
          contributingFacts: [],
        },
        domain: {
          name: "Domain Match",
          score: job.assessment?.domainMatch ?? 80,
          weight: 0.15,
          weightedContribution: Math.round((job.assessment?.domainMatch ?? 80) * 0.15),
          explanation: "",
          contributingFacts: [],
        },
        seniority: {
          name: "Seniority Realism",
          score: job.assessment?.experienceMatch ?? 80,
          weight: 0.15,
          weightedContribution: Math.round((job.assessment?.experienceMatch ?? 80) * 0.15),
          explanation: "",
          contributingFacts: [],
        },
      },
      recommendation: (job.assessment?.recommendation as MatchScoreBreakdown["recommendation"]) || "Strong Fit",
      whySummary: job.assessment?.whySummary || "",
      positiveContributions: [],
      negativeDeductions: [],
      strongEvidence: job.assessment?.strongEvidence || [],
      blockers: (job.assessment?.criticalMissing || []).map((m) => ({
        skillOrRequirement: m,
        severity: "hard_blocker" as const,
        reason: "Identified gap",
      })),
      criticalMissing: job.assessment?.criticalMissing || [],
      niceToHaveMissing: job.assessment?.niceToHaveMissing || [],
      risks: job.assessment?.risks || [],
      assumptions: [],
      talkingPoints: job.assessment?.talkingPoints || [],
    };

    const strategy = calculateDeterministicStrategy(normalized, fakeMatchResult, problemMatch, profile);

    return {
      ...(job as unknown as FullJobWithAssessment),
      problemMatch,
      strategy,
    };
  } catch (err) {
    console.error("Failed to fetch job:", err);
    return null;
  }
}

export async function syncJobToCRM(jobId: string): Promise<{ ok: boolean; message: string; url?: string }> {
  try {
    const job = await getJobById(jobId);
    if (!job) {
      return { ok: false, message: "Job not found." };
    }

    const res = await pushJobToTwentyCRM(job);
    if (res.ok && res.opportunityId) {
      await db.jobOpportunity.update({
        where: { id: jobId },
        data: {
          twentyOpportunityId: res.opportunityId,
          status: "qualified",
        },
      });
      revalidatePath("/[lang]/jobs", "page");
    }

    return res;
  } catch (err) {
    console.error("Error syncing to CRM:", err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Failed to sync to Twenty CRM.",
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
  } catch (err) {
    console.error("Error updating status:", err);
    return { ok: false };
  }
}

export async function recordJobOutcomeAction(
  jobId: string,
  status: JobStatus,
  outcome?: OutcomeCategory,
  reasonCategory?: OutcomeReasonCategory,
  feedback?: string,
  hypothesis?: string
): Promise<{ ok: boolean }> {
  try {
    await db.jobOpportunity.update({
      where: { id: jobId },
      data: {
        status: status as JobOpportunityStatus,
      },
    });
    revalidatePath("/[lang]/jobs", "page");
    return { ok: true };
  } catch (err) {
    console.error("Error recording outcome:", err);
    return { ok: false };
  }
}

export async function getConversionFunnelStatsAction(): Promise<{
  funnel: CareerConversionFunnel;
  campaigns: CampaignConversionPerformance[];
  positioning: PositioningConversionPerformance[];
  sources: SourceQualityPerformance[];
}> {
  const jobs = await getJobsList();
  const funnel = calculateConversionFunnel(jobs);
  const campaigns = calculateCampaignPerformance(jobs);
  const positioning = calculatePositioningPerformance(jobs);
  const sources = calculateSourceQuality(jobs);

  return {
    funnel,
    campaigns,
    positioning,
    sources,
  };
}

export async function getWeeklySearchReviewAction(): Promise<WeeklyJobSearchReview> {
  const jobs = await getJobsList();
  return generateWeeklyJobSearchReview(jobs);
}

export async function deleteJobAction(jobId: string): Promise<{ ok: boolean }> {
  try {
    await db.jobOpportunity.delete({
      where: { id: jobId },
    });
    revalidatePath("/[lang]/jobs", "page");
    return { ok: true };
  } catch (err) {
    console.error("Error deleting job:", err);
    return { ok: false };
  }
}

export async function getEvidenceProfile(): Promise<EngineeringKnowledgeProfile> {
  return buildEvidenceKnowledgeProfile();
}
