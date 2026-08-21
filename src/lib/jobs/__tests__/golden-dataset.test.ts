import { describe, it, expect } from "vitest";
import { buildEvidenceKnowledgeProfile } from "../evidence-extractor";
import { calculateDeterministicMatch } from "../matcher";
import { calculateDeterministicProblemMatch } from "../problem-matcher";
import { calculateDeterministicStrategy } from "../strategy-generator";
import { NormalizedJobInput } from "../types";

describe("Job Engine — Golden Dataset Regression Suite (6 Scenarios)", () => {
  const profile = buildEvidenceKnowledgeProfile();

  // Scenario 1: Strong Full-Stack AI Engineer
  it("Scenario 1: Evaluates Strong Full-Stack AI Role with High Score and 0 Blockers", () => {
    const job: NormalizedJobInput = {
      title: "Senior Full-Stack AI Engineer",
      company: "ScaleAI Labs",
      remoteType: "remote",
      employmentType: "full_time",
      description: "Building production Next.js web applications, LLM orchestration, and PostgreSQL backends.",
      responsibilities: ["Develop Next.js applications", "Integrate LLM structured outputs", "Design database schemas"],
      requiredSkills: ["Next.js", "React", "TypeScript", "PostgreSQL", "Prisma", "AI"],
      preferredSkills: ["Tailwind CSS", "Docker"],
      domain: "AI & SaaS",
      seniority: "Senior",
      source: "golden_dataset",
    };

    const match = calculateDeterministicMatch(job, profile);
    expect(match.overallScore).toBeGreaterThanOrEqual(85);
    expect(match.recommendation).toBe("High Priority");
    expect(match.fitConfidence).toBe("high");
    expect(match.blockers.filter((b) => b.severity === "hard_blocker").length).toBe(0);
  });

  // Scenario 2: Strong 0-to-1 Founding Builder
  it("Scenario 2: Evaluates 0-to-1 Founding Engineer Role with High Builder Fit", () => {
    const job: NormalizedJobInput = {
      title: "Founding Engineer (0 to 1)",
      company: "Stealth AI Startup",
      remoteType: "remote",
      employmentType: "full_time",
      description: "Looking for a high-ownership founding builder to own our Next.js and Prisma product delivery from 0 to 1.",
      responsibilities: ["Own full-stack product", "Fast iteration", "Architect database and auth"],
      requiredSkills: ["Next.js", "TypeScript", "PostgreSQL"],
      preferredSkills: ["React 19", "Tailwind CSS"],
      seniority: "Founding",
      domain: "Startup / SaaS",
      source: "golden_dataset",
    };

    const problemAnalysis = calculateDeterministicProblemMatch(job, profile);
    expect(problemAnalysis.builderFitScore).toBeGreaterThanOrEqual(90);
    expect(problemAnalysis.builderDimensions.autonomyAndOwnership).toBeGreaterThanOrEqual(90);
    expect(problemAnalysis.builderDimensions.zeroToOneCreation).toBeGreaterThanOrEqual(90);
  });

  // Scenario 3: Strong Multi-Tenant SaaS Fit
  it("Scenario 3: Maps Multi-Tenant SaaS Challenges Directly to Hogwarts Solution Proofs", () => {
    const job: NormalizedJobInput = {
      title: "Lead SaaS Architect",
      company: "SchoolFlow Inc",
      remoteType: "remote",
      employmentType: "full_time",
      description: "Architecting a multi-tenant school management SaaS with student information systems and role-based permissions.",
      responsibilities: ["Design multi-tenant PostgreSQL schemas", "Implement session auth", "Automate transactional messaging"],
      requiredSkills: ["Next.js", "Prisma", "PostgreSQL", "NextAuth"],
      preferredSkills: [],
      domain: "Education & SaaS",
      source: "golden_dataset",
    };

    const problemAnalysis = calculateDeterministicProblemMatch(job, profile);
    const hogwartsProof = problemAnalysis.relevantDatabaytSolutions.find((s) => s.repoId === "hogwarts");
    expect(hogwartsProof).toBeDefined();
    expect(hogwartsProof?.problemSolved).toContain("multi-tenant");
  });

  // Scenario 4: False-Positive Keyword Spammer (Proves Keyword Overlap alone does NOT fool the engine)
  it("Scenario 4: Rejects False-Positive Keyword Spammer Requiring Unsupported Technologies", () => {
    const job: NormalizedJobInput = {
      title: "Senior Kubernetes & Embedded C++ Graphics Engineer",
      company: "Legacy Infra Corp",
      remoteType: "onsite",
      employmentType: "full_time",
      description: "Requires 7+ years of bare-metal C++ kernel development, Vulkan graphics drivers, and Kubernetes bare-metal cluster management.",
      responsibilities: ["Write bare-metal C++ drivers", "Manage on-prem Kubernetes clusters"],
      requiredSkills: ["C++", "Vulkan", "Kubernetes", "Embedded Systems", "Security Clearance"],
      preferredSkills: [],
      domain: "Bare-Metal Systems",
      source: "golden_dataset",
    };

    const match = calculateDeterministicMatch(job, profile);
    expect(match.overallScore).toBeLessThan(60);
    expect(match.recommendation).toBe("Low Probability");
    
    const hardBlockers = match.blockers.filter((b) => b.severity === "hard_blocker");
    expect(hardBlockers.length).toBeGreaterThan(0);
    expect(match.negativeDeductions.length).toBeGreaterThan(0);
  });

  // Scenario 5: Hard Security / Geographic Blocker
  it("Scenario 5: Identifies Strict Hard Blockers and Penalizes Overall Fit", () => {
    const job: NormalizedJobInput = {
      title: "Defense Systems Software Engineer",
      company: "Defense Prime",
      remoteType: "onsite",
      employmentType: "full_time",
      description: "Must hold active Top Secret Security Clearance and US citizenship.",
      responsibilities: ["Classified systems maintenance"],
      requiredSkills: ["Security Clearance", "C++"],
      preferredSkills: [],
      domain: "Defense",
      source: "golden_dataset",
    };

    const match = calculateDeterministicMatch(job, profile);
    const hardBlockers = match.blockers.filter((b) => b.severity === "hard_blocker");
    expect(hardBlockers.length).toBeGreaterThan(0);
    expect(match.recommendation).toBe("Low Probability");
  });

  // Scenario 6: Learnable Gap with High Builder Fit
  it("Scenario 6: Treats Minor Secondary Libraries as Learnable Gaps with Mitigation", () => {
    const job: NormalizedJobInput = {
      title: "Product Engineer",
      company: "Vercel Partner",
      remoteType: "remote",
      employmentType: "full_time",
      description: "Building React applications using Next.js and AWS cloud primitives.",
      responsibilities: ["Build user interfaces", "Deploy cloud features"],
      requiredSkills: ["Next.js", "React", "TypeScript", "AWS"],
      preferredSkills: [],
      domain: "Web SaaS",
      source: "golden_dataset",
    };

    const match = calculateDeterministicMatch(job, profile);
    const learnableOrSignificant = match.blockers.filter((b) => b.severity !== "hard_blocker");
    expect(learnableOrSignificant.length).toBeGreaterThan(0);
    expect(match.overallScore).toBeGreaterThanOrEqual(70);
    expect(["High Priority", "Strong Fit"]).toContain(match.recommendation);
  });
});
