import { createGoogle } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import {
  ApplicationStrategy,
  EngineeringKnowledgeProfile,
  MatchScoreBreakdown,
  NormalizedJobInput,
  ProblemMatchAnalysis,
} from "./types";

const strategySchema = z.object({
  applicationReadinessScore: z.number().min(0).max(100),
  readinessAssessment: z.string(),
  strategicPriorityRank: z.number(),
  strategicCareerValue: z.enum(["Transformative", "High Value", "Solid Opportunity", "Stepping Stone"]),
  positioningAngle: z.string(),
  truthfulNarrative: z.string(),
  keyProjectProofs: z.array(
    z.object({
      name: z.string(),
      canonicalUrl: z.string(),
      oneLinerProof: z.string(),
    })
  ),
  studyChecklist: z.array(
    z.object({
      topic: z.string(),
      whyNeeded: z.string(),
      urgency: z.enum(["critical", "recommended", "optional"]),
      estimatedHours: z.number(),
    })
  ),
  tailoredAssets: z.object({
    professionalSummary: z.string(),
    coverLetter: z.string(),
    recruiterDM: z.string(),
    hiringManagerNote: z.string(),
  }),
  interviewDossier: z.array(
    z.object({
      questionType: z.string(),
      context: z.string(),
      problem: z.string(),
      decision: z.string(),
      tradeoff: z.string(),
      implementation: z.string(),
      outcome: z.string(),
      projectProof: z.string(),
    })
  ),
});

export async function generateApplicationStrategy(
  job: NormalizedJobInput,
  match: MatchScoreBreakdown,
  problemAnalysis: ProblemMatchAnalysis,
  profile: EngineeringKnowledgeProfile
): Promise<ApplicationStrategy> {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();

  if (apiKey) {
    try {
      const google = createGoogle({ apiKey });
      const { object } = await generateObject({
        model: google("gemini-2.5-flash"),
        schema: strategySchema,
        prompt: `You are Databayt's Chief Career Strategist & Application Intelligence Director.
Generate a tailored, evidence-grounded application strategy for the following job opportunity.

# CRITICAL RULES:
1. TRUTHFUL POSITIONING: Ground the narrative in candidate Osman Abdout's transition from electrical engineering systems foundations into high-velocity product engineering, proven by 10+ shipped repositories under github.com/databayt. Zero fluff, zero fabricated experience.
2. EVIDENCE OVER BUZZWORDS: Reference concrete artifacts (PostgreSQL Prisma schemas, NextAuth v5 session callbacks, Vercel AI SDK structured schemas, Radix UI registries).
3. SEPARATE MATCH FROM READINESS: Job Fit evaluates skill overlap; Application Readiness calculates whether the candidate has all case study materials and interview prep completed right now.
4. ASSETS: Provide a high-impact cover letter, recruiter message, and structured interview STAR stories.

---
### JOB POSTING:
Company: ${job.company}
Title: ${job.title}
Domain: ${job.domain || "SaaS"}
Match Score: ${match.overallScore}% (${match.recommendation})
Builder Fit: ${problemAnalysis.builderFitScore}%
Underlying Problems: ${problemAnalysis.companyUnderlyingProblems.join(" | ")}

### CANDIDATE EVIDENCE:
Headline: ${profile.headline}
Top Capabilities: ${profile.capabilities.map((c) => c.name).join(", ")}
`,
        temperature: 0.1,
        maxOutputTokens: 5000,
        abortSignal: AbortSignal.timeout(30_000),
      });

      return {
        targetJobTitle: job.title,
        companyName: job.company,
        jobFitScore: match.overallScore,
        builderFitScore: problemAnalysis.builderFitScore,
        applicationReadinessScore: object.applicationReadinessScore,
        readinessAssessment: object.readinessAssessment,
        strategicPriorityRank: object.strategicPriorityRank,
        strategicCareerValue: object.strategicCareerValue,
        positioningAngle: object.positioningAngle,
        truthfulNarrative: object.truthfulNarrative,
        keyProjectProofs: object.keyProjectProofs,
        studyChecklist: object.studyChecklist,
        tailoredAssets: object.tailoredAssets,
        interviewDossier: object.interviewDossier,
      };
    } catch (err) {
      console.warn("AI strategy generation failed, using deterministic strategy generator:", err);
    }
  }

  return calculateDeterministicStrategy(job, match, problemAnalysis, profile);
}

export function calculateDeterministicStrategy(
  job: NormalizedJobInput,
  match: MatchScoreBreakdown,
  problemAnalysis: ProblemMatchAnalysis,
  profile: EngineeringKnowledgeProfile
): ApplicationStrategy {
  const blockerCount = match.blockers.filter((b) => b.severity === "hard_blocker").length;
  const significantGapCount = match.blockers.filter((b) => b.severity === "significant_gap").length;

  // Calculate Application Readiness Score distinct from match score
  let readiness = match.overallScore;
  if (significantGapCount > 0) readiness -= significantGapCount * 12;
  if (blockerCount > 0) readiness -= blockerCount * 25;
  readiness = Math.max(20, Math.min(100, Math.round(readiness)));

  const isHighFit = match.overallScore >= 80;
  const strategicCareerValue =
    isHighFit && problemAnalysis.builderFitScore >= 85
      ? "Transformative"
      : isHighFit
      ? "High Value"
      : "Solid Opportunity";

  const keyProjectProofs = [
    {
      name: "Hogwarts School SaaS",
      canonicalUrl: "https://github.com/databayt/hogwarts",
      oneLinerProof: "Shipped multi-tenant school SaaS with 30+ relational PostgreSQL models and automated WhatsApp communications.",
    },
    {
      name: "Kun Operations Engine",
      canonicalUrl: "https://github.com/databayt/kun",
      oneLinerProof: "Built AI engineering operations hub with Google Gemini structured schema generation and multi-agent coordination.",
    },
    {
      name: "Databayt Codebase Design System",
      canonicalUrl: "https://github.com/databayt/codebase",
      oneLinerProof: "Created 150+ component Shadcn registry with Radix primitives and Tailwind CSS v4 bilingual support.",
    },
  ];

  const studyChecklist = [
    {
      topic: "System Design for Multi-Tenant Data Isolation",
      whyNeeded: "Articulate schema migration strategies and tenant isolation boundaries clearly during technical screen.",
      urgency: "critical" as const,
      estimatedHours: 4,
    },
    {
      topic: "Vercel AI SDK Schema Reliability",
      whyNeeded: "Prepare walkthrough of structured LLM output generation and error fallback boundaries.",
      urgency: "recommended" as const,
      estimatedHours: 2,
    },
    {
      topic: "Cloud Infrastructure & Container Deployment",
      whyNeeded: "Bridge knowledge gap on containerization using self-hosted Twenty CRM Docker deployment proof.",
      urgency: "recommended" as const,
      estimatedHours: 3,
    },
  ];

  const truthfulNarrative = `I am a product builder and systems engineer who transitioned from electrical engineering into software development. My engineering training instilled a deep first-principles mindset that I apply to full-stack architecture: from relational database schemas and session security to accessible design systems and structured AI workflows. Over the past several years at Databayt, I have personally architected and shipped 10+ production codebases including Hogwarts (multi-tenant SaaS), Kun (AI operations), and Codebase (150+ component design system).`;

  const coverLetter = `Dear Hiring Team at ${job.company},

I am writing to express my strong interest in the ${job.title} role.

Having reviewed your team's focus on ${job.domain || "modern software engineering"}, I recognize that the core challenge is not just writing individual components, but owning end-to-end product delivery—from resilient database architecture to intuitive user interfaces.

At Databayt, I have architected and shipped complete production platforms:
1. Multi-Tenant SaaS (Hogwarts): Built 30+ relational PostgreSQL models with tenant isolation, NextAuth v5 session security, and automated communication cadences.
2. AI-Integrated Operations (Kun): Engineered strict Zod schema extraction with Gemini 2.5 and Claude, alongside multi-agent coordination.
3. High-Craft Design System (Codebase): Created an atomic registry of 150+ primitives and compound atoms adhering to Shadcn/UI standards.

My background combines rigorous systems thinking from electrical engineering with full-stack execution across Next.js 16, TypeScript, React 19, and Prisma. I would welcome the opportunity to discuss how this builder ownership can accelerate ${job.company}'s goals.

Best regards,
Osman Abdout
github.com/databayt`;

  const recruiterDM = `Hi! I noticed ${job.company} is looking for a ${job.title}. I'm a full-stack product builder at Databayt who has shipped multi-tenant SaaS (Hogwarts) and structured AI workflows (Kun) in Next.js 16, TypeScript, and Prisma. Given your focus on ${job.domain || "scaling the platform"}, I'd love to share some relevant architecture case studies. Would you be open to a brief chat?`;

  const hiringManagerNote = `Quick technical note for the engineering lead: I reviewed your requirements for ${job.title} and noticed the emphasis on ${job.requiredSkills.slice(0, 3).join(", ")}. In my recent work on Hogwarts and Kun, I built similar architectures with PostgreSQL schema isolation, NextAuth v5 role scoping, and Zod-enforced AI pipelines. All code is active at github.com/databayt.`;

  const interviewDossier = [
    {
      questionType: "Complex Architecture & Multi-Tenancy",
      context: "Designing Hogwarts School Management SaaS for multiple independent institutions.",
      problem: "Ensuring zero cross-tenant data leakage while sharing database infrastructure efficiently.",
      decision: "Implemented organization-scoped queries with schoolId foreign key constraints and NextAuth session guards.",
      tradeoff: "Chose shared-schema multi-tenancy over separate database instances to keep operational costs low and migrations instant.",
      implementation: "Defined 30+ Prisma relational models with indexes on schoolId and created server actions with Zod tenant validation.",
      outcome: "Seamless tenant onboarding and sub-50ms query response times.",
      projectProof: "github.com/databayt/hogwarts (prisma/schema.prisma, src/auth.ts)",
    },
    {
      questionType: "AI Workflow Reliability & Structured Extraction",
      context: "Building Kun's automated intelligence and drafting engine.",
      problem: "Preventing LLM hallucinations and ensuring valid JSON output for downstream operations.",
      decision: "Integrated Vercel AI SDK generateObject with strict Zod schema validation and deterministic fallback boundaries.",
      tradeoff: "Used Google Gemini 2.5 Flash for low latency and high token budget instead of heavy reasoning models.",
      implementation: "Created modular normalizers and matchers with automated test fixtures.",
      outcome: "100% type-safe structured data delivery with sub-second execution.",
      projectProof: "github.com/databayt/kun (src/lib/google-draft.ts, src/lib/jobs/matcher.ts)",
    },
  ];

  return {
    targetJobTitle: job.title,
    companyName: job.company,
    jobFitScore: match.overallScore,
    builderFitScore: problemAnalysis.builderFitScore,
    applicationReadinessScore: readiness,
    readinessAssessment: `Job match is ${match.overallScore}% with ${problemAnalysis.builderFitScore}% builder fit. Application readiness is ${readiness}%—recommend completing the 3 prep topics before technical interviews.`,
    strategicPriorityRank: match.overallScore >= 85 ? 1 : 2,
    strategicCareerValue,
    positioningAngle: `Full-Stack Product Builder & AI Systems Architect`,
    truthfulNarrative,
    keyProjectProofs,
    studyChecklist,
    tailoredAssets: {
      professionalSummary: `Full-stack product engineer and systems builder with 10+ shipped repositories across Next.js 16, TypeScript, React 19, Prisma, and structured AI workflows. Specializes in multi-tenant SaaS architecture and high-craft design systems.`,
      coverLetter,
      recruiterDM,
      hiringManagerNote,
    },
    interviewDossier,
  };
}
