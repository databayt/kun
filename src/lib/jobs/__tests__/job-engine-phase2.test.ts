import { describe, it, expect } from "vitest";
import { buildEvidenceKnowledgeProfile } from "../evidence-extractor";
import { calculateDeterministicProblemMatch } from "../problem-matcher";
import { calculateDeterministicStrategy } from "../strategy-generator";
import { calculateOpportunityPriority, DEFAULT_CAMPAIGNS, evaluateCampaignMatches } from "../campaigns";
import { calculateDeterministicMatch } from "../matcher";
import { FullJobWithAssessment, NormalizedJobInput } from "../types";

describe("Job Engine — Phase 2: Opportunity Intelligence & Operations", () => {
  const mockAIJob: NormalizedJobInput = {
    title: "Founding Full-Stack AI Engineer",
    company: "NexusAI Labs",
    companyUrl: "https://nexusai.example.com",
    location: "Remote",
    remoteType: "remote",
    employmentType: "full_time",
    salary: "$140,000 - $180,000",
    description: "Looking for a founding engineer to own our Next.js and LLM orchestration pipeline from 0 to 1.",
    responsibilities: [
      "Architect Next.js web application and PostgreSQL database",
      "Implement structured output LLM generation with error boundaries",
      "Own product delivery from UI components to deployment",
    ],
    requiredSkills: ["Next.js", "React", "TypeScript", "Prisma", "PostgreSQL", "AI"],
    preferredSkills: ["Tailwind CSS", "Docker", "CRM"],
    seniority: "Founding",
    domain: "AI & SaaS",
    source: "test",
  };

  it("extracts underlying company problems and calculates builder fit accurately", () => {
    const profile = buildEvidenceKnowledgeProfile();
    const analysis = calculateDeterministicProblemMatch(mockAIJob, profile);

    expect(analysis.companyUnderlyingProblems.length).toBeGreaterThan(0);
    expect(analysis.builderFitScore).toBeGreaterThanOrEqual(90);
    expect(analysis.builderDimensions.autonomyAndOwnership).toBeGreaterThanOrEqual(90);
    expect(analysis.builderDimensions.zeroToOneCreation).toBeGreaterThanOrEqual(90);

    // Verify solution mapping to Databayt codebases
    expect(analysis.relevantDatabaytSolutions.length).toBeGreaterThanOrEqual(2);
    const hogwarts = analysis.relevantDatabaytSolutions.find((s) => s.repoId === "hogwarts");
    const kun = analysis.relevantDatabaytSolutions.find((s) => s.repoId === "kun");
    expect(hogwarts || kun).toBeDefined();
  });

  it("calculates distinct Job Fit vs Application Readiness score and generates truthful narrative", () => {
    const profile = buildEvidenceKnowledgeProfile();
    const match = calculateDeterministicMatch(mockAIJob, profile);
    const problemAnalysis = calculateDeterministicProblemMatch(mockAIJob, profile);
    const strategy = calculateDeterministicStrategy(mockAIJob, match, problemAnalysis, profile);

    expect(strategy.jobFitScore).toBeGreaterThanOrEqual(85);
    expect(strategy.builderFitScore).toBeGreaterThanOrEqual(90);
    expect(strategy.applicationReadinessScore).toBeGreaterThanOrEqual(70);

    // Verify truthful transition narrative (EE -> full-stack builder)
    expect(strategy.truthfulNarrative).toContain("electrical engineering");
    expect(strategy.truthfulNarrative).toContain("Databayt");

    // Verify pre-application study checklist
    expect(strategy.studyChecklist.length).toBeGreaterThanOrEqual(2);
    expect(strategy.studyChecklist[0].estimatedHours).toBeGreaterThan(0);

    // Verify tailored assets are grounded
    expect(strategy.tailoredAssets.coverLetter).toContain("Hogwarts");
    expect(strategy.tailoredAssets.coverLetter).toContain("Kun");
    expect(strategy.tailoredAssets.recruiterDM).toBeTruthy();

    // Verify STAR stories in interview dossier
    expect(strategy.interviewDossier.length).toBeGreaterThanOrEqual(2);
    expect(strategy.interviewDossier[0].context).toBeTruthy();
    expect(strategy.interviewDossier[0].tradeoff).toBeTruthy();
    expect(strategy.interviewDossier[0].outcome).toBeTruthy();
  });

  it("evaluates active campaigns and calculates multi-factor opportunity priority", () => {
    const matchedCampaigns = evaluateCampaignMatches(mockAIJob, DEFAULT_CAMPAIGNS);
    expect(matchedCampaigns).toContain("campaign-remote-ai-builder");
    expect(matchedCampaigns).toContain("campaign-founding-engineer");

    const fullJob: FullJobWithAssessment = {
      id: "test-opp-1",
      title: mockAIJob.title,
      company: mockAIJob.company,
      companyUrl: mockAIJob.companyUrl || null,
      location: mockAIJob.location || null,
      remoteType: mockAIJob.remoteType,
      employmentType: mockAIJob.employmentType,
      salary: mockAIJob.salary || null,
      description: mockAIJob.description,
      responsibilities: mockAIJob.responsibilities,
      requiredSkills: mockAIJob.requiredSkills,
      preferredSkills: mockAIJob.preferredSkills,
      seniority: mockAIJob.seniority || null,
      domain: mockAIJob.domain || null,
      sourceUrl: null,
      source: "test",
      status: "analyzed",
      twentyOpportunityId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      assessment: {
        id: "assess-1",
        overallScore: 92,
        technicalMatch: 95,
        capabilityMatch: 94,
        domainMatch: 90,
        experienceMatch: 88,
        recommendation: "High Priority",
        whySummary: "Strong fit",
        strongEvidence: ["Hogwarts: Multi-tenant SaaS"],
        criticalMissing: [],
        niceToHaveMissing: [],
        risks: [],
        talkingPoints: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      problemMatch: {
        companyUnderlyingProblems: ["AI operations"],
        roleCoreNeed: "Own Next.js delivery",
        builderFitScore: 95,
        builderFitReasoning: "High builder fit",
        builderDimensions: {
          autonomyAndOwnership: 95,
          zeroToOneCreation: 95,
          fullstackVersatility: 95,
          productAgency: 95,
        },
        relevantDatabaytSolutions: [],
        candidateStrategicAdvantage: "Full stack builder",
      },
      strategy: {
        targetJobTitle: mockAIJob.title,
        companyName: mockAIJob.company,
        jobFitScore: 92,
        builderFitScore: 95,
        applicationReadinessScore: 88,
        readinessAssessment: "Ready to apply",
        strategicPriorityRank: 1,
        strategicCareerValue: "Transformative",
        positioningAngle: "Full-Stack AI Builder",
        truthfulNarrative: "Truthful narrative",
        keyProjectProofs: [],
        studyChecklist: [],
        tailoredAssets: {
          professionalSummary: "Summary",
          coverLetter: "Letter",
          recruiterDM: "DM",
          hiringManagerNote: "Note",
        },
        interviewDossier: [],
      },
    };

    const priority = calculateOpportunityPriority(fullJob, DEFAULT_CAMPAIGNS);
    expect(priority.priorityScore).toBeGreaterThanOrEqual(85);
    expect(priority.priorityRank).toBe(1);
    expect(priority.recommendationAction).toContain("High Priority");
  });
});
