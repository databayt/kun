import { createGoogle } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { NormalizedJobInput } from "./types";

const jobNormalizationSchema = z.object({
  title: z.string().describe("Standardized job title"),
  company: z.string().describe("Company or organization name"),
  companyUrl: z.string().optional().describe("Company website URL if mentioned"),
  location: z.string().optional().describe("Geographic location or timezone"),
  remoteType: z
    .enum(["remote", "hybrid", "onsite"])
    .describe("Work arrangement: remote, hybrid, or onsite"),
  employmentType: z
    .enum(["full_time", "part_time", "contract", "freelance"])
    .describe("Employment type"),
  salary: z.string().optional().describe("Salary or rate range if mentioned"),
  description: z.string().describe("Structured and clean summary of the job description"),
  responsibilities: z
    .array(z.string())
    .describe("Key responsibilities and day-to-day duties"),
  requiredSkills: z
    .array(z.string())
    .describe("Must-have technical skills, frameworks, and requirements"),
  preferredSkills: z
    .array(z.string())
    .describe("Nice-to-have or bonus qualifications"),
  seniority: z
    .string()
    .optional()
    .describe("Seniority level: Junior, Mid, Senior, Lead, Founding, Staff"),
  domain: z
    .string()
    .optional()
    .describe("Industry or product domain: SaaS, EdTech, FinTech, AI / DevTools, E-Commerce, etc."),
  sourceUrl: z.string().optional().describe("Original job posting URL if found"),
});

export async function normalizeJobPosting(
  rawText: string,
  source = "manual",
  sourceUrl?: string
): Promise<NormalizedJobInput> {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();

  if (apiKey) {
    try {
      const google = createGoogle({ apiKey });
      const { object } = await generateObject({
        model: google("gemini-2.5-flash"),
        schema: jobNormalizationSchema,
        prompt: `You are an expert technical recruiting analyst and job intelligence normalizer for Databayt.
Normalize the following raw job posting into a strictly structured, clean JSON specification.

RAW JOB POSTING:
"""
${rawText}
"""

Instructions:
1. Extract the exact job title and company.
2. Accurately detect work mode (remote, hybrid, onsite) and employment type.
3. Separate hard MUST-HAVE requirements into 'requiredSkills' and optional NICE-TO-HAVE requirements into 'preferredSkills'.
4. Identify key technical responsibilities.
5. Infer the seniority level and industry domain.
`,
        temperature: 0.1,
        maxOutputTokens: 4000,
        abortSignal: AbortSignal.timeout(25_000),
      });

      return {
        title: object.title,
        company: object.company,
        companyUrl: object.companyUrl,
        location: object.location,
        remoteType: object.remoteType,
        employmentType: object.employmentType,
        salary: object.salary,
        description: object.description,
        responsibilities: object.responsibilities,
        requiredSkills: object.requiredSkills,
        preferredSkills: object.preferredSkills,
        seniority: object.seniority,
        domain: object.domain,
        sourceUrl: sourceUrl || object.sourceUrl,
        source,
      };
    } catch (err) {
      console.warn("AI normalization failed, falling back to heuristic parser:", err);
    }
  }

  // Fallback heuristic normalization when API is unavailable
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  const firstLine = lines[0] || "Software Engineer";
  const titleParts = firstLine.split(/ at | @ | - | \| /i);
  const title = titleParts[0] || firstLine;
  const company = titleParts[1] || "Unknown Company";

  const lower = rawText.toLowerCase();
  const remoteType = lower.includes("remote")
    ? "remote"
    : lower.includes("hybrid")
    ? "hybrid"
    : "onsite";

  const employmentType = lower.includes("contract")
    ? "contract"
    : lower.includes("part-time") || lower.includes("part time")
    ? "part_time"
    : lower.includes("freelance")
    ? "freelance"
    : "full_time";

  const commonSkills = [
    "Next.js",
    "React",
    "TypeScript",
    "JavaScript",
    "Node.js",
    "Tailwind CSS",
    "PostgreSQL",
    "Prisma",
    "GraphQL",
    "Python",
    "Rust",
    "Docker",
    "AWS",
    "Vercel",
    "AI",
    "LLM",
    "Swift",
    "Kotlin",
  ];

  const extractedSkills = commonSkills.filter((s) =>
    new RegExp(`\\b${s}\\b`, "i").test(rawText)
  );

  return {
    title,
    company,
    remoteType,
    employmentType,
    description: rawText.slice(0, 500) + (rawText.length > 500 ? "..." : ""),
    responsibilities: lines.slice(1, 6),
    requiredSkills: extractedSkills.length > 0 ? extractedSkills : ["Full-Stack Engineering"],
    preferredSkills: [],
    seniority: lower.includes("senior") ? "Senior" : lower.includes("lead") ? "Lead" : "Mid/Senior",
    domain: lower.includes("saas") ? "SaaS" : lower.includes("ai") ? "AI / Tech" : "Web Development",
    sourceUrl,
    source,
  };
}
