import { describe, it, expect } from "vitest";
import { resolveDatabaytRepositories } from "../repository-registry";
import { buildEvidenceKnowledgeProfile, extractRepositoryFacts } from "../evidence-extractor";
import { calculateDeterministicMatch } from "../matcher";
import { pushJobToTwentyCRM } from "../twenty-crm";
import { FullJobWithAssessment, NormalizedJobInput } from "../types";

describe("Kun Job Engine (Hardened & Modular Architecture)", () => {
  it("resolves repository identities independently of local clone existence", () => {
    const repos = resolveDatabaytRepositories();
    expect(repos.length).toBeGreaterThanOrEqual(10);

    const hogwarts = repos.find((r) => r.id === "hogwarts");
    expect(hogwarts).toBeDefined();
    expect(hogwarts?.organization).toBe("databayt");
    expect(hogwarts?.canonicalUrl).toBe("https://github.com/databayt/hogwarts");

    // Every repo must have at least a canonical GitHub remote source
    const githubSource = hogwarts?.sources.find((s) => s.type === "github");
    expect(githubSource).toBeDefined();
    expect(githubSource?.isAvailable).toBe(true);
  });

  it("extracts Level 1 metadata and Level 2/3 code facts", () => {
    const repos = resolveDatabaytRepositories();
    const facts = extractRepositoryFacts(repos);
    expect(facts.length).toBeGreaterThan(5);

    // Level 1 metadata fact check
    const metaFact = facts.find((f) => f.artifactType === "documentation");
    expect(metaFact).toBeDefined();
    expect(metaFact?.extractionMethod).toBe("deterministic");

    // Level 2/3 Prisma schema fact check
    const schemaFact = facts.find((f) => f.artifactType === "database_schema");
    if (schemaFact) {
      expect(schemaFact.claim).toContain("PostgreSQL schema");
      expect(schemaFact.confidence).toBe("high");
    }
  });

  it("synthesizes the 3-Layer Knowledge Profile (Facts -> Capabilities -> Market Positioning)", () => {
    const profile = buildEvidenceKnowledgeProfile();
    expect(profile.candidateName).toContain("Osman Abdout");
    expect(profile.analyzerVersion).toContain("v2");

    // Layer A: Verified Facts
    expect(profile.facts.length).toBeGreaterThan(0);

    // Layer B: Capabilities with supporting facts & reasoning
    expect(profile.capabilities.length).toBeGreaterThanOrEqual(4);
    const saasCap = profile.capabilities.find((c) => c.id === "cap-multi-tenant-saas");
    expect(saasCap).toBeDefined();
    expect(saasCap?.supportingFactIds.length).toBeGreaterThan(0);
    expect(saasCap?.reasoning).toBeTruthy();

    // Layer C: Market Positioning Roles
    expect(profile.positioningRoles.length).toBeGreaterThanOrEqual(3);
    const aiRole = profile.positioningRoles.find((r) => r.title === "Full-Stack AI Engineer");
    expect(aiRole).toBeDefined();
    expect(aiRole?.readinessScore).toBeGreaterThanOrEqual(90);
  });

  it("evaluates a Full-Stack AI Engineer job with 5D dimensional breakdown and high confidence", () => {
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
    expect(match.overallScore).toBeGreaterThanOrEqual(85);
    expect(match.recommendation).toBe("High Priority");
    expect(match.fitConfidence).toBe("high");
    expect(match.dimensions.technical.score).toBeGreaterThanOrEqual(80);
    expect(match.dimensions.capability.score).toBeGreaterThanOrEqual(90);
    expect(match.positiveContributions.length).toBeGreaterThan(0);
    expect(match.talkingPoints.length).toBeGreaterThan(0);
  });

  it("properly penalizes hard blockers while treating learnable gaps with mitigation", () => {
    const profile = buildEvidenceKnowledgeProfile();
    const jobWithHardBlocker: NormalizedJobInput = {
      title: "C++ Bare-Metal Graphics Systems Engineer",
      company: "Epic Games",
      remoteType: "onsite",
      employmentType: "full_time",
      description: "Writing Vulkan graphics kernels and C++ drivers",
      responsibilities: ["Write C++ driver logic", "Optimize bare-metal Vulkan rendering"],
      requiredSkills: ["C++", "Vulkan", "Embedded Graphics", "Security Clearance"],
      preferredSkills: [],
      domain: "Gaming & Graphics",
      source: "test",
    };

    const match = calculateDeterministicMatch(jobWithHardBlocker, profile);
    expect(match.overallScore).toBeLessThan(60);
    expect(match.recommendation).toBe("Low Probability");

    const hardBlockers = match.blockers.filter((b) => b.severity === "hard_blocker");
    expect(hardBlockers.length).toBeGreaterThan(0);
    expect(match.negativeDeductions.length).toBeGreaterThan(0);
  });

  it("handles Twenty CRM sync gracefully and never throws on offline backend", async () => {
    const mockJob: FullJobWithAssessment = {
      id: "job-test-1",
      title: "Full-Stack Engineer",
      company: "Databayt Tech Partner",
      companyUrl: "https://example.com",
      location: "Remote",
      remoteType: "remote",
      employmentType: "full_time",
      salary: "$120,000",
      description: "Test description",
      responsibilities: ["Build apps"],
      requiredSkills: ["Next.js", "TypeScript"],
      preferredSkills: [],
      seniority: "Senior",
      domain: "SaaS",
      sourceUrl: "https://example.com/job",
      source: "test",
      status: "qualified",
      twentyOpportunityId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      assessment: {
        id: "assess-1",
        overallScore: 92,
        technicalMatch: 95,
        capabilityMatch: 92,
        domainMatch: 90,
        experienceMatch: 88,
        recommendation: "High Priority",
        whySummary: "Strong fit based on Hogwarts SaaS proof",
        strongEvidence: ["Hogwarts: Multi-tenant PostgreSQL"],
        criticalMissing: [],
        niceToHaveMissing: [],
        risks: [],
        talkingPoints: ["Mention Hogwarts multi-tenancy"],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    // The test name says "offline backend" but nothing here made it offline —
    // so with the Twenty Docker stack up and the Keychain key present, this
    // wrote a real record into the production CRM on every run. It went
    // unnoticed while pushJobToTwentyCRM was broken and always got a 400;
    // fixing that function turned a silent no-op into three duplicate
    // "Full-Stack Engineer @ Databayt Tech Partner" rows in one afternoon.
    //
    // Port 1 is reserved and never listening, so this forces the connection
    // failure the assertions are actually about.
    const realApiUrl = process.env.TWENTY_API_URL;
    process.env.TWENTY_API_URL = "http://127.0.0.1:1";

    try {
      const res = await pushJobToTwentyCRM(mockJob);
      expect(res).toBeDefined();
      expect(typeof res.ok).toBe("boolean");
      expect(res.message).toBeTruthy();
      expect(res.ok).toBe(false);
    } finally {
      if (realApiUrl === undefined) delete process.env.TWENTY_API_URL;
      else process.env.TWENTY_API_URL = realApiUrl;
    }
  });
});
