import { createGoogle } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import {
  DatabaytSolutionProof,
  EngineeringKnowledgeProfile,
  NormalizedJobInput,
  ProblemMatchAnalysis,
} from "./types";

const problemMatchSchema = z.object({
  companyUnderlyingProblems: z.array(z.string()).describe("The core technical or business problems the company is trying to solve"),
  roleCoreNeed: z.string().describe("What the hiring team actually needs this person to accomplish in the next 6-12 months"),
  builderFitScore: z.number().min(0).max(100).describe("How strongly the role values 0-to-1 builders, fullstack ownership, and product agency"),
  builderFitReasoning: z.string().describe("Explanation of why the candidate's builder background matches or diverges from this role"),
  builderDimensions: z.object({
    autonomyAndOwnership: z.number().min(0).max(100),
    zeroToOneCreation: z.number().min(0).max(100),
    fullstackVersatility: z.number().min(0).max(100),
    productAgency: z.number().min(0).max(100),
  }),
  relevantDatabaytSolutions: z.array(
    z.object({
      repoId: z.string(),
      projectName: z.string(),
      problemSolved: z.string(),
      architecturalSolution: z.string(),
      verifiedProofs: z.array(z.string()),
    })
  ),
  candidateStrategicAdvantage: z.string().describe("The distinct advantage this candidate has over typical resume-keyword applicants"),
});

export async function analyzeProblemAndBuilderFit(
  job: NormalizedJobInput,
  profile: EngineeringKnowledgeProfile
): Promise<ProblemMatchAnalysis> {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();

  if (apiKey) {
    try {
      const google = createGoogle({ apiKey });
      const { object } = await generateObject({
        model: google("gemini-2.5-flash"),
        schema: problemMatchSchema,
        prompt: `You are Databayt's Opportunity Strategy Analyst.
Analyze the target job posting to uncover the COMPANY'S UNDERLYING PROBLEMS, the ROLE'S REAL NEED, and the CANDIDATE'S BUILDER FIT.

# CANDIDATE KNOWLEDGE PROFILE (Databayt):
- Headline: ${profile.headline}
- Key Repositories & Systems Shipped:
  • Hogwarts (databayt/hogwarts): Multi-tenant School Management SaaS with 30+ relational models, NextAuth v5, PostgreSQL, Evolution API WhatsApp cadence.
  • Kun (databayt/kun): AI Development & Operations engine, structured LLM generation (Gemini & Claude), Zod schemas, 28 AI agent fleet, Twenty CRM sync.
  • Codebase (databayt/codebase): Design System registry with 54 Radix primitives and 62 atoms (Shadcn pattern), Arabic RTL & English LTR.
  • Mkan (databayt/mkan): Rental marketplace with interactive calendar, search filters, and booking flow.
  • Distributed Computer (databayt/distributed-computer): Rust P2P protocols with libp2p, Kademlia DHT, and token economy.
  • Hogwarts Mobile (databayt/ios-app & android-app): Native iOS (SwiftUI 18, Swift 6) and Android (Kotlin, Jetpack Compose) offline sync apps.

# TARGET JOB POSTING:
- Company: ${job.company}
- Title: ${job.title}
- Domain: ${job.domain || "SaaS / Technology"}
- Seniority: ${job.seniority || "Mid-Senior"}
- Required Stack: ${job.requiredSkills.join(", ")}
- Responsibilities:
${job.responsibilities.map((r) => `  * ${r}`).join("\n")}
- Full Description:
${job.description}

# INSTRUCTIONS:
1. Don't match keywords. Identify the real business and architecture problem.
2. Calculate Builder Fit: Does this company need a narrow specialist or a self-driven 0-to-1 product builder who can own full-stack delivery?
3. Select 1-3 previous Databayt solutions that directly solve the company's core challenges.
`,
        temperature: 0.1,
        maxOutputTokens: 4000,
        abortSignal: AbortSignal.timeout(25_000),
      });

      return object;
    } catch (err) {
      console.warn("AI problem matching failed, using deterministic fallback:", err);
    }
  }

  return calculateDeterministicProblemMatch(job, profile);
}

export function calculateDeterministicProblemMatch(
  job: NormalizedJobInput,
  profile: EngineeringKnowledgeProfile
): ProblemMatchAnalysis {
  const isStartupOrFounding =
    job.title.toLowerCase().includes("founding") ||
    job.title.toLowerCase().includes("lead") ||
    job.title.toLowerCase().includes("staff") ||
    job.title.toLowerCase().includes("builder") ||
    job.description.toLowerCase().includes("0 to 1") ||
    job.description.toLowerCase().includes("early stage") ||
    job.description.toLowerCase().includes("startup");

  const autonomy = isStartupOrFounding ? 95 : 85;
  const zeroToOne = isStartupOrFounding ? 96 : 80;
  const fullstack = 94;
  const productAgency = 92;
  const builderFitScore = Math.round((autonomy + zeroToOne + fullstack + productAgency) / 4);

  const fullText = `${job.title} ${job.description} ${job.domain || ""} ${(job.requiredSkills || []).join(" ")}`.toLowerCase();
  const solutions: DatabaytSolutionProof[] = [];

  // 1. Multi-tenant / SaaS / Backend / PostgreSQL
  if (fullText.includes("saas") || fullText.includes("backend") || fullText.includes("data") || fullText.includes("prisma") || fullText.includes("postgres") || fullText.includes("full-stack") || fullText.includes("fullstack")) {
    solutions.push({
      repoId: "hogwarts",
      projectName: "Hogwarts Multi-Tenant SaaS",
      problemSolved: "End-to-end multi-tenant data isolation, relational modeling, and automated transactional messaging.",
      architecturalSolution: "Architected 30+ PostgreSQL Prisma models with tenant isolation, NextAuth v5 session guards, and Evolution API WhatsApp cadence.",
      verifiedProofs: [
        "prisma/schema.prisma (relational models with schoolId isolation)",
        "src/auth.ts (role-based session callbacks)",
        "src/lib/whatsapp (automated outbound communication)",
      ],
    });
  }

  // 2. AI Engineering / Workflows
  if (fullText.includes("ai") || fullText.includes("llm") || fullText.includes("agent") || fullText.includes("gemini") || fullText.includes("claude")) {
    solutions.push({
      repoId: "kun",
      projectName: "Kun AI Operations Engine",
      problemSolved: "Reliable LLM integration, structured data extraction, and human-in-the-loop workflows.",
      architecturalSolution: "Engineered strict Zod schema validation using Vercel AI SDK and Google Gemini 2.5 with deterministic fallback boundaries.",
      verifiedProofs: [
        "src/lib/google-draft.ts (structured schema generation)",
        "src/lib/jobs/matcher.ts (5D explainable matching engine)",
        "src/lib/jobs/twenty-crm.ts (resilient CRM sync adapter)",
      ],
    });
  }

  // 3. Design System / Frontend Craft
  if (fullText.includes("ui") || fullText.includes("react") || fullText.includes("frontend") || fullText.includes("tailwind") || fullText.includes("next")) {
    solutions.push({
      repoId: "codebase",
      projectName: "Databayt Codebase Design System",
      problemSolved: "Scalable UI primitives, accessible component hierarchy, and multi-lingual RTL/LTR layout stability.",
      architecturalSolution: "Created 150+ component registry conforming to Shadcn standards with Radix primitives and Tailwind CSS v4.",
      verifiedProofs: [
        "src/components/ui/ (54 Radix primitives)",
        "src/components/atom/ (62 compound interactive atoms)",
        "src/registry/ (automated CLI distribution model)",
      ],
    });
  }

  return {
    companyUnderlyingProblems: [
      `Delivering robust full-stack features in ${job.domain || "SaaS"} under fast iteration cycles.`,
      `Managing end-to-end application architecture from database schemas to responsive UI.`,
      `Integrating modern AI workflows and automated business operations.`,
    ],
    roleCoreNeed: `Own end-to-end product delivery in ${job.title}, balancing architecture elegance with velocity.`,
    builderFitScore,
    builderFitReasoning: `Candidate is a proven 0-to-1 builder who architected multiple production platforms (Hogwarts, Kun, Codebase), making them an exceptional fit for high-ownership product roles.`,
    builderDimensions: {
      autonomyAndOwnership: autonomy,
      zeroToOneCreation: zeroToOne,
      fullstackVersatility: fullstack,
      productAgency,
    },
    relevantDatabaytSolutions: solutions,
    candidateStrategicAdvantage: `Unlike pure frontend or backend specialists, candidate has personally architected complete systems including databases, auth, design systems, AI workflows, and native mobile clients.`,
  };
}
