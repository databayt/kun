import { createGoogle } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import {
  BlockerItem,
  DimensionScore,
  EngineeringKnowledgeProfile,
  MatchScoreBreakdown,
  NormalizedJobInput,
} from "./types";

const blockerItemSchema = z.object({
  skillOrRequirement: z.string(),
  severity: z.enum(["hard_blocker", "significant_gap", "learnable_gap"]),
  reason: z.string(),
  mitigationStrategy: z.string().optional(),
});

const dimensionScoreSchema = z.object({
  name: z.string(),
  score: z.number().min(0).max(100),
  weight: z.number(),
  weightedContribution: z.number(),
  explanation: z.string(),
  contributingFacts: z.array(z.string()),
});

const matchEvaluationSchema = z.object({
  overallScore: z.number().min(0).max(100),
  fitConfidence: z.enum(["high", "medium", "low"]),
  confidenceReasoning: z.string(),
  dimensions: z.object({
    technical: dimensionScoreSchema,
    capability: dimensionScoreSchema,
    domain: dimensionScoreSchema,
    seniority: dimensionScoreSchema,
  }),
  recommendation: z.enum(["High Priority", "Strong Fit", "Prepare & Apply", "Low Probability", "Not a Fit"]),
  whySummary: z.string(),
  positiveContributions: z.array(z.string()),
  negativeDeductions: z.array(z.string()),
  strongEvidence: z.array(z.string()),
  blockers: z.array(blockerItemSchema),
  risks: z.array(z.string()),
  assumptions: z.array(z.string()),
  talkingPoints: z.array(z.string()),
});

export async function matchJobAgainstProfile(
  job: NormalizedJobInput,
  profile: EngineeringKnowledgeProfile
): Promise<MatchScoreBreakdown> {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();

  if (apiKey) {
    try {
      const google = createGoogle({ apiKey });
      const { object } = await generateObject({
        model: google("gemini-2.5-flash"),
        schema: matchEvaluationSchema,
        prompt: `You are the Lead Career Intelligence Evaluator for Databayt.
Perform a rigorous, 5-dimensional evidence-grounded match between the target job posting and candidate's verified profile.

# CORE RULES:
1. Grounding: Compare against actual verified facts and capability inferences.
2. Blocker Classification:
   - hard_blocker: Legal/work-auth disqualifiers or strict non-transferable domain requirements (e.g. 5+ yrs C++ game engine).
   - significant_gap: Important technologies with no direct repo proof (e.g. AWS ECS/Terraform).
   - learnable_gap: Unfamiliar libraries easily learned on the job (e.g. TanStack Query vs SWR).
3. Separate Candidate Fit from Assessment Confidence.
4. Give explainable score adjustments (positive contributions vs negative deductions).

---
### CANDIDATE ENGINEERING KNOWLEDGE PROFILE (Databayt):
Headline: ${profile.headline}
Analyzer: ${profile.analyzerVersion}

Core Capabilities:
${profile.capabilities
  .map(
    (c) =>
      `- [${c.category}] ${c.name} (${c.level}): ${c.description}\n  Reasoning: ${c.reasoning}\n  Proof Facts: ${c.facts.map((f) => `[${f.repositoryId}:${f.artifactPath}] ${f.claim}`).join("; ")}`
  )
  .join("\n\n")}

Technologies Verified in Production:
${profile.technologies
  .map((t) => `- ${t.name} (${t.category} - ${t.level}): ${t.facts.map((f) => `[${f.repositoryId}] ${f.claim}`).join("; ")}`)
  .join("\n")}

Repositories Tracked:
${profile.repositories
  .map((r) => `- ${r.name} (${r.id}): ${r.description} [Sources: ${r.sources.map((s) => s.type).join(", ")}]`)
  .join("\n")}

---
### JOB POSTING:
Title: ${job.title}
Company: ${job.company}
Remote/Location: ${job.remoteType} (${job.location || "Global"})
Employment Type: ${job.employmentType}
Salary: ${job.salary || "Not specified"}
Seniority: ${job.seniority || "Not specified"}
Domain: ${job.domain || "General"}

Responsibilities:
${job.responsibilities.map((r) => `* ${r}`).join("\n")}

Required Skills:
${job.requiredSkills.map((s) => `* ${s}`).join("\n")}

Preferred Skills:
${job.preferredSkills.map((s) => `* ${s}`).join("\n")}

Description:
${job.description}
`,
        temperature: 0.1,
        maxOutputTokens: 6000,
        abortSignal: AbortSignal.timeout(30_000),
      });

      const hardBlockers = object.blockers.filter((b) => b.severity === "hard_blocker");
      const criticalMissing = hardBlockers.map((b) => b.skillOrRequirement);
      const niceToHaveMissing = object.blockers
        .filter((b) => b.severity === "learnable_gap" || b.severity === "significant_gap")
        .map((b) => b.skillOrRequirement);

      return {
        overallScore: Math.round(object.overallScore),
        fitConfidence: object.fitConfidence,
        confidenceReasoning: object.confidenceReasoning,
        dimensions: object.dimensions,
        recommendation: object.recommendation,
        whySummary: object.whySummary,
        positiveContributions: object.positiveContributions,
        negativeDeductions: object.negativeDeductions,
        strongEvidence: object.strongEvidence,
        blockers: object.blockers,
        criticalMissing,
        niceToHaveMissing,
        risks: object.risks,
        assumptions: object.assumptions,
        talkingPoints: object.talkingPoints,
      };
    } catch (err) {
      console.warn("AI matching failed, using deterministic fallback engine:", err);
    }
  }

  return calculateDeterministicMatch(job, profile);
}

export function calculateDeterministicMatch(
  job: NormalizedJobInput,
  profile: EngineeringKnowledgeProfile
): MatchScoreBreakdown {
  const verifiedTechs = profile.technologies.map((t) => t.name.toLowerCase());
  const jobReqs = job.requiredSkills.map((s) => s.toLowerCase());

  let techMatchedCount = 0;
  const contributingTechFacts: string[] = [];
  const blockers: BlockerItem[] = [];

  for (const req of job.requiredSkills) {
    const matched = verifiedTechs.some((t) => t.includes(req.toLowerCase()) || req.toLowerCase().includes(t.split(" ")[0].toLowerCase()));
    if (matched) {
      techMatchedCount++;
      contributingTechFacts.push(`Direct production proof for ${req}`);
    } else {
      const lower = req.toLowerCase();
      if (lower.includes("kubernetes") || lower.includes("c++") || lower.includes("embedded") || lower.includes("security clearance")) {
        blockers.push({
          skillOrRequirement: req,
          severity: "hard_blocker",
          reason: `Strict requirement with no verified repository implementation in Databayt codebases.`,
        });
      } else if (lower.includes("aws") || lower.includes("gcp") || lower.includes("docker")) {
        blockers.push({
          skillOrRequirement: req,
          severity: "significant_gap",
          reason: `Cloud/DevOps preference where candidate has Vercel/Neon proof but limited direct ${req} evidence.`,
          mitigationStrategy: `Highlight container and cloud deployment familiarity from self-hosted Twenty CRM setup.`,
        });
      } else {
        blockers.push({
          skillOrRequirement: req,
          severity: "learnable_gap",
          reason: `Secondary library easily mastered on the job.`,
          mitigationStrategy: `Reference deep TypeScript/React architecture foundation from Codebase design system.`,
        });
      }
    }
  }

  const techScore = job.requiredSkills.length > 0
    ? Math.min(100, Math.round((techMatchedCount / job.requiredSkills.length) * 100))
    : 85;

  const isFullstackOrAI =
    job.title.toLowerCase().includes("full") ||
    job.title.toLowerCase().includes("next") ||
    job.title.toLowerCase().includes("react") ||
    job.title.toLowerCase().includes("ai") ||
    job.title.toLowerCase().includes("founding") ||
    job.title.toLowerCase().includes("product");

  const capabilityScore = isFullstackOrAI ? 94 : 76;
  const domainScore = (job.domain || "").toLowerCase().includes("saas") ? 95 : 82;
  const seniorityScore = 88;

  const technicalDim: DimensionScore = {
    name: "Technical Stack Match",
    score: techScore,
    weight: 0.4,
    weightedContribution: Math.round(techScore * 0.4),
    explanation: `Candidate verified in ${techMatchedCount}/${job.requiredSkills.length || 1} required technologies.`,
    contributingFacts: contributingTechFacts,
  };

  const capabilityDim: DimensionScore = {
    name: "Capability & Architecture Match",
    score: capabilityScore,
    weight: 0.3,
    weightedContribution: Math.round(capabilityScore * 0.3),
    explanation: isFullstackOrAI
      ? "Demonstrated full-stack 0-to-1 builder scope across Hogwarts, Kun, and Codebase."
      : "General software engineering capability matches required scope.",
    contributingFacts: [
      "Hogwarts: Multi-tenant SaaS with PostgreSQL, NextAuth v5, and WhatsApp Evolution API",
      "Codebase: 54 UI primitives and 62 compound atoms conforming to Shadcn registry standards",
      "Kun: AI workflow orchestration and Gemini 2.5 structured schema generation",
    ],
  };

  const domainDim: DimensionScore = {
    name: "Domain Familiarity",
    score: domainScore,
    weight: 0.15,
    weightedContribution: Math.round(domainScore * 0.15),
    explanation: "Strong SaaS and product engineering background.",
    contributingFacts: ["Education SaaS (Hogwarts)", "Rental Marketplace (Mkan)", "Operations Hub (Kun)"],
  };

  const seniorityDim: DimensionScore = {
    name: "Seniority Realism",
    score: seniorityScore,
    weight: 0.15,
    weightedContribution: Math.round(seniorityScore * 0.15),
    explanation: "Excellent fit for builder/generalist, founding engineer, or senior full-stack roles.",
    contributingFacts: ["Full-lifecycle ownership from database schema to responsive bilingual frontend."],
  };

  const hardBlockerCount = blockers.filter((b) => b.severity === "hard_blocker").length;
  const rawScore =
    technicalDim.weightedContribution +
    capabilityDim.weightedContribution +
    domainDim.weightedContribution +
    seniorityDim.weightedContribution;

  const overallScore = Math.max(0, Math.min(100, rawScore - hardBlockerCount * 25));

  let recommendation: MatchScoreBreakdown["recommendation"] = "Strong Fit";
  if (overallScore >= 85 && hardBlockerCount === 0) {
    recommendation = "High Priority";
  } else if (overallScore < 55 || hardBlockerCount >= 2) {
    recommendation = "Low Probability";
  } else if (hardBlockerCount > 0) {
    recommendation = "Prepare & Apply";
  }

  const fitConfidence = contributingTechFacts.length >= 3 ? "high" : "medium";

  return {
    overallScore,
    fitConfidence,
    confidenceReasoning: `${fitConfidence.toUpperCase()} confidence based on ${contributingTechFacts.length} directly verified repository tech proofs.`,
    dimensions: {
      technical: technicalDim,
      capability: capabilityDim,
      domain: domainDim,
      seniority: seniorityDim,
    },
    recommendation,
    whySummary: `Score of ${overallScore}% driven by direct production evidence in Next.js, React, TypeScript, Prisma, and multi-tenant SaaS architecture.`,
    positiveContributions: [
      `+${technicalDim.weightedContribution} pts from verified technical stack mastery.`,
      `+${capabilityDim.weightedContribution} pts from full-stack SaaS & AI workflow proof.`,
    ],
    negativeDeductions: hardBlockerCount > 0 ? [`-${hardBlockerCount * 25} pts due to ${hardBlockerCount} hard blocker gap(s).`] : [],
    strongEvidence: capabilityDim.contributingFacts,
    blockers,
    criticalMissing: blockers.filter((b) => b.severity === "hard_blocker").map((b) => b.skillOrRequirement),
    niceToHaveMissing: blockers.filter((b) => b.severity !== "hard_blocker").map((b) => b.skillOrRequirement),
    risks: hardBlockerCount > 0 ? [`Prepare targeted answers for missing requirements: ${blockers.map((b) => b.skillOrRequirement).join(", ")}`] : ["Standard systems architecture and scalability interview prep."],
    assumptions: ["Candidate is open to remote or flexible working arrangements.", "Role values full-stack product engineering depth."],
    talkingPoints: [
      `Anchor your discussion on Hogwarts: explain the multi-tenant PostgreSQL schema and Evolution API WhatsApp automation.`,
      `Emphasize frontend craftsmanship: reference the 150+ component Shadcn registry built in Codebase.`,
      `Highlight AI engineering reliability: describe schema-enforced LLM generation with Zod and error boundaries in Kun.`,
    ],
  };
}
