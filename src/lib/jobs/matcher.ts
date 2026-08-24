import { createGoogle } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

import { laneConfigFor } from "./lanes";
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
  // Which profession is this job in? Everything below reads from that lane's
  // config; "software" reproduces the literals that used to be inlined here.
  const lane = laneConfigFor(job);

  // Only this lane's evidence counts as verified proof. A software posting
  // never sees a protection relay in the stack, and vice versa.
  const verifiedTechs = profile.technologies
    .filter((t) => lane.techCategories.has(t.category))
    .map((t) => t.name.toLowerCase());

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
      if (lane.hardBlockers.some((k) => lower.includes(k))) {
        blockers.push({
          skillOrRequirement: req,
          severity: "hard_blocker",
          reason: `Strict requirement with no verified evidence in the ${lane.label} record.`,
        });
      } else if (lane.significantGaps.some((k) => lower.includes(k))) {
        blockers.push({
          skillOrRequirement: req,
          severity: "significant_gap",
          reason: lane.significantGapReason,
          mitigationStrategy: lane.significantGapMitigation,
        });
      } else {
        blockers.push({
          skillOrRequirement: req,
          severity: "learnable_gap",
          reason: lane.learnableGapReason,
          mitigationStrategy: lane.learnableGapMitigation,
        });
      }
    }
  }

  const techScore = job.requiredSkills.length > 0
    ? Math.min(100, Math.round((techMatchedCount / job.requiredSkills.length) * 100))
    : 85;

  const lowerTitle = job.title.toLowerCase();
  const lowerDomain = (job.domain || "").toLowerCase();

  const hitsCapability = lane.capabilityKeywords.some((k) => lowerTitle.includes(k));
  const hitsDomain = lane.domainKeywords.some((k) => lowerDomain.includes(k));

  const capabilityScore = hitsCapability ? lane.capabilityHigh : lane.capabilityLow;
  const domainScore = hitsDomain ? lane.domainHigh : lane.domainLow;
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
    explanation: hitsCapability
      ? lane.capabilityHighExplanation
      : lane.capabilityLowExplanation,
    contributingFacts: [...lane.capabilityFacts],
  };

  const domainDim: DimensionScore = {
    name: "Domain Familiarity",
    score: domainScore,
    weight: 0.15,
    weightedContribution: Math.round(domainScore * 0.15),
    explanation: lane.domainExplanation,
    contributingFacts: [...lane.domainFacts],
  };

  const seniorityDim: DimensionScore = {
    name: "Seniority Realism",
    score: seniorityScore,
    weight: 0.15,
    weightedContribution: Math.round(seniorityScore * 0.15),
    explanation: lane.seniorityExplanation,
    contributingFacts: [...lane.seniorityFacts],
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
    confidenceReasoning: `${fitConfidence.toUpperCase()} confidence based on ${contributingTechFacts.length} directly verified ${lane.label.toLowerCase()} proofs.`,
    dimensions: {
      technical: technicalDim,
      capability: capabilityDim,
      domain: domainDim,
      seniority: seniorityDim,
    },
    recommendation,
    whySummary: `Score of ${overallScore}% driven by ${lane.whyDrivers}.`,
    positiveContributions: [
      `+${technicalDim.weightedContribution} pts from verified technical stack mastery.`,
      `+${capabilityDim.weightedContribution} pts from ${lane.label.toLowerCase()} capability proof.`,
    ],
    negativeDeductions: hardBlockerCount > 0 ? [`-${hardBlockerCount * 25} pts due to ${hardBlockerCount} hard blocker gap(s).`] : [],
    strongEvidence: capabilityDim.contributingFacts,
    blockers,
    criticalMissing: blockers.filter((b) => b.severity === "hard_blocker").map((b) => b.skillOrRequirement),
    niceToHaveMissing: blockers.filter((b) => b.severity !== "hard_blocker").map((b) => b.skillOrRequirement),
    risks: hardBlockerCount > 0 ? [`Prepare targeted answers for missing requirements: ${blockers.map((b) => b.skillOrRequirement).join(", ")}`] : [lane.standardRisk],
    assumptions: [...lane.assumptions],
    talkingPoints: [...lane.talkingPoints],
  };
}
