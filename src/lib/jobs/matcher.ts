import { createGoogle } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import {
  EngineeringKnowledgeProfile,
  MatchScoreBreakdown,
  NormalizedJobInput,
} from "./types";

const matchEvaluationSchema = z.object({
  overallScore: z
    .number()
    .min(0)
    .max(100)
    .describe("Overall opportunity score reflecting genuine probability of success and fit"),
  technicalMatch: z
    .number()
    .min(0)
    .max(100)
    .describe("Score comparing required tech stack against candidate's verified repository implementations"),
  capabilityMatch: z
    .number()
    .min(0)
    .max(100)
    .describe("Score comparing required engineering responsibilities against candidate's proven architectural capabilities"),
  domainMatch: z
    .number()
    .min(0)
    .max(100)
    .describe("Score on product domain familiarity (SaaS, EdTech, Marketplaces, DevTools, FinTech)"),
  experienceMatch: z
    .number()
    .min(0)
    .max(100)
    .describe("Realistic fit for seniority, product builder mindset, and practical execution"),
  recommendation: z
    .enum(["High Priority", "Strong Fit", "Prepare & Apply", "Low Probability", "Not a Fit"])
    .describe("Categorical prioritization recommendation"),
  whySummary: z
    .string()
    .describe("Explainable, transparent summary of why this job matches or doesn't match, grounded in evidence"),
  strongEvidence: z
    .array(z.string())
    .describe("Concrete repository references and features that prove candidate's qualifications"),
  criticalMissing: z
    .array(z.string())
    .describe("Critical, hard blocker requirements the candidate lacks"),
  niceToHaveMissing: z
    .array(z.string())
    .describe("Minor or secondary gaps that can be learned quickly"),
  risks: z
    .array(z.string())
    .describe("Potential interview or technical risks to prepare for"),
  talkingPoints: z
    .array(z.string())
    .describe("Tailored talking points grounded in real repositories for applications and interviews"),
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
        prompt: `You are the Lead Technical Evaluator and Career Intelligence Matcher for Databayt.
Your task is to evaluate the match between a target job posting and the candidate's verified Engineering Knowledge Profile.

# CORE PRINCIPLES:
1. EVIDENCE OVER KEYWORDS: Do not just count keyword overlaps. Look for demonstrated capabilities in actual shipped products.
2. CAPABILITIES OVER JOB TITLES: Someone who built Hogwarts (multi-tenant SaaS, auth, WhatsApp automation, PostgreSQL) and Codebase (50+ Shadcn components, atomic system) has proven high-level product engineering capability.
3. TRUTHFUL & OBJECTIVE: Do not hallucinate capabilities or inflate seniority. Point out genuine risks and critical missing skills honestly.
4. EXPLAINABLE SCORING: Provide clear, transparent reasoning for every score.

---
### CANDIDATE ENGINEERING KNOWLEDGE PROFILE:
Headline: ${profile.headline}
Target Roles: ${profile.targetRoles.join(", ")}

Core Capabilities:
${profile.capabilities
  .map(
    (c) =>
      `- ${c.name} (${c.level}): ${c.description}\n  Evidence:\n${c.evidence
        .map((e) => `    * [${e.repo}] ${e.path}: ${e.summary}`)
        .join("\n")}`
  )
  .join("\n\n")}

Technologies Verified in Repos:
${profile.technologies
  .map(
    (t) =>
      `- ${t.name} (${t.category} - ${t.level}): ${t.evidence.map((e) => `[${e.repo}] ${e.summary}`).join("; ")}`
  )
  .join("\n")}

Repositories Tracked:
${profile.repositories
  .map((r) => `- ${r.name} (${r.id}): Stack [${r.stack.join(", ")}] — Highlights [${r.highlights.join(", ")}]`)
  .join("\n")}

---
### JOB POSTING TO EVALUATE:
Title: ${job.title}
Company: ${job.company}
Remote/Location: ${job.remoteType} (${job.location || "Global"})
Employment Type: ${job.employmentType}
Salary: ${job.salary || "Not specified"}
Seniority: ${job.seniority || "Not specified"}
Domain: ${job.domain || "General Tech"}

Responsibilities:
${job.responsibilities.map((r) => `* ${r}`).join("\n")}

Required Skills (Must-Have):
${job.requiredSkills.map((s) => `* ${s}`).join("\n")}

Preferred Skills (Nice-To-Have):
${job.preferredSkills.map((s) => `* ${s}`).join("\n")}

Full Description Snippet:
${job.description}

---
Perform a thorough, evidence-grounded assessment and return the structured evaluation.
`,
        temperature: 0.1,
        maxOutputTokens: 6000,
        abortSignal: AbortSignal.timeout(30_000),
      });

      return {
        overallScore: Math.round(object.overallScore),
        technicalMatch: Math.round(object.technicalMatch),
        capabilityMatch: Math.round(object.capabilityMatch),
        domainMatch: Math.round(object.domainMatch),
        experienceMatch: Math.round(object.experienceMatch),
        recommendation: object.recommendation,
        whySummary: object.whySummary,
        strongEvidence: object.strongEvidence,
        criticalMissing: object.criticalMissing,
        niceToHaveMissing: object.niceToHaveMissing,
        risks: object.risks,
        talkingPoints: object.talkingPoints,
      };
    } catch (err) {
      console.warn("AI matching failed, using deterministic rule-based engine:", err);
    }
  }

  // Deterministic rule-based evaluation fallback
  return calculateDeterministicMatch(job, profile);
}

export function calculateDeterministicMatch(
  job: NormalizedJobInput,
  profile: EngineeringKnowledgeProfile
): MatchScoreBreakdown {
  const verifiedTechNames = profile.technologies.map((t) => t.name.toLowerCase());
  const jobReqs = job.requiredSkills.map((s) => s.toLowerCase());

  let techMatches = 0;
  const criticalMissing: string[] = [];
  const strongEvidence: string[] = [];

  for (const req of job.requiredSkills) {
    const matched = verifiedTechNames.some((t) => t.includes(req.toLowerCase()) || req.toLowerCase().includes(t.split(" ")[0].toLowerCase()));
    if (matched) {
      techMatches++;
    } else {
      // Check if it's a known heavy blocker
      const lower = req.toLowerCase();
      if (
        lower.includes("kubernetes") ||
        lower.includes("c++") ||
        lower.includes("java") ||
        lower.includes("embedded") ||
        lower.includes("blockchain")
      ) {
        criticalMissing.push(req);
      }
    }
  }

  const techScore = job.requiredSkills.length > 0
    ? Math.min(100, Math.round((techMatches / job.requiredSkills.length) * 100))
    : 85;

  // Capability score: if Next.js, React, SaaS, Full-Stack, Auth, AI are present
  const isSaaSOrFullstack =
    job.title.toLowerCase().includes("full") ||
    job.title.toLowerCase().includes("stack") ||
    job.title.toLowerCase().includes("next") ||
    job.title.toLowerCase().includes("react") ||
    job.title.toLowerCase().includes("ai") ||
    job.title.toLowerCase().includes("product") ||
    job.title.toLowerCase().includes("founding");

  const capabilityScore = isSaaSOrFullstack ? 92 : 75;

  // Domain score
  let domainScore = 80;
  const jobDomain = (job.domain || "").toLowerCase();
  if (jobDomain.includes("saas") || jobDomain.includes("edtech") || jobDomain.includes("marketplace")) {
    domainScore = 95;
  }

  const experienceScore = 88;
  const overallScore = Math.round(
    techScore * 0.4 + capabilityScore * 0.3 + domainScore * 0.15 + experienceScore * 0.15
  );

  let recommendation: MatchScoreBreakdown["recommendation"] = "Strong Fit";
  if (overallScore >= 85 && criticalMissing.length === 0) {
    recommendation = "High Priority";
  } else if (overallScore < 60 || criticalMissing.length >= 2) {
    recommendation = "Low Probability";
  } else if (criticalMissing.length > 0) {
    recommendation = "Prepare & Apply";
  }

  strongEvidence.push(
    "Hogwarts: Shipped end-to-end multi-tenant education SaaS with PostgreSQL, NextAuth v5, and Evolution API WhatsApp automation."
  );
  strongEvidence.push(
    "Codebase: Built canonical atomic design registry with 54 UI primitives and 62 compound atoms adhering to strict Shadcn/UI standards."
  );
  strongEvidence.push(
    "Kun: Engineered AI workflow engine with Vercel AI SDK, Google Gemini 2.5 structured schema generation, and Prisma 7 driver adapters."
  );

  const talkingPoints = [
    `Highlight your hands-on experience building ${job.title}-relevant architectures in Hogwarts and Mkan.`,
    "Emphasize strong end-to-end execution: full stack from database schema & authentication to pixel-perfect responsive UI.",
    "Mention AI integration depth using structured outputs and automated workflow pipelines in Kun.",
  ];

  return {
    overallScore,
    technicalMatch: techScore,
    capabilityMatch: capabilityScore,
    domainMatch: domainScore,
    experienceMatch: experienceScore,
    recommendation,
    whySummary: `Strong match (${overallScore}%) driven by deep verified production experience with Next.js, React, TypeScript, Prisma, and AI application engineering across Databayt repositories.`,
    strongEvidence,
    criticalMissing,
    niceToHaveMissing: job.preferredSkills.slice(0, 3),
    risks: criticalMissing.length > 0 ? [`Address missing requirement: ${criticalMissing.join(", ")}`] : ["Standard system design and architecture interview preparation."],
    talkingPoints,
  };
}
