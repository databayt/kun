import { describe, it, expect } from "vitest";
import { buildEvidenceKnowledgeProfile } from "./src/lib/jobs/evidence-extractor";
import { calculateDeterministicMatch } from "./src/lib/jobs/matcher";
import { NormalizedJobInput } from "./src/lib/jobs/types";

describe("Kun Job Intelligence Engine", () => {
  it("extracts evidence knowledge profile from local repositories", () => {
    const profile = buildEvidenceKnowledgeProfile();
    expect(profile.candidateName).toContain("Osman Abdout");
    expect(profile.capabilities.length).toBeGreaterThan(3);
    expect(profile.technologies.length).toBeGreaterThan(5);
    expect(profile.repositories.length).toBeGreaterThan(0);

    const saasCap = profile.capabilities.find((c) => c.id === "multi-tenant-saas");
    expect(saasCap).toBeDefined();
    expect(saasCap?.evidence.length).toBeGreaterThan(0);
  });

  it("evaluates a Full-Stack AI Engineer job with explainable scoring", () => {
    const profile = buildEvidenceKnowledgeProfile();
    const job: NormalizedJobInput = {
      title: "Senior Full-Stack AI Engineer",
      company: "Scale AI",
      remoteType: "remote",
      employmentType: "full_time",
      description: "Building production Next.js and AI applications",
      responsibilities: ["Build Next.js web applications", "Integrate LLMs", "Design PostgreSQL schemas"],
      requiredSkills: ["Next.js", "React", "TypeScript", "PostgreSQL", "Prisma", "AI"],
      preferredSkills: ["Tailwind CSS", "Docker"],
      domain: "SaaS & AI",
      seniority: "Senior",
      source: "test",
    };

    const match = calculateDeterministicMatch(job, profile);
    expect(match.overallScore).toBeGreaterThanOrEqual(80);
    expect(match.recommendation).toBe("High Priority");
    expect(match.strongEvidence.length).toBeGreaterThan(0);
    expect(match.talkingPoints.length).toBeGreaterThan(0);
  });
});
