import { describe, it, expect } from "vitest";
import {
  calculateCampaignPerformance,
  calculateConversionFunnel,
  calculatePositioningPerformance,
  calculateSourceQuality,
  generateWeeklyJobSearchReview,
} from "../conversion-funnel";
import { DEFAULT_CAMPAIGNS } from "../campaigns";
import { FullJobWithAssessment } from "../types";

describe("Job Engine — Phase 3A: Conversion Intelligence & Funnel Analytics", () => {
  const mockJobs: FullJobWithAssessment[] = [
    {
      id: "job-1",
      title: "Founding Full-Stack AI Engineer",
      company: "NexusAI",
      companyUrl: null,
      location: "Remote",
      remoteType: "remote",
      employmentType: "full_time",
      salary: "$140k",
      description: "Next.js and AI SDK",
      responsibilities: ["Build apps"],
      requiredSkills: ["Next.js", "TypeScript", "AI"],
      preferredSkills: [],
      seniority: "Founding",
      domain: "AI SaaS",
      sourceUrl: null,
      source: "github",
      status: "offer",
      twentyOpportunityId: "opp-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      assessment: {
        id: "a-1",
        overallScore: 92,
        technicalMatch: 95,
        capabilityMatch: 90,
        domainMatch: 90,
        experienceMatch: 88,
        recommendation: "High Priority",
        whySummary: "Strong fit",
        strongEvidence: ["Kun"],
        criticalMissing: [],
        niceToHaveMissing: [],
        risks: [],
        talkingPoints: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      strategy: {
        targetJobTitle: "Founding Full-Stack AI Engineer",
        companyName: "NexusAI",
        jobFitScore: 92,
        builderFitScore: 95,
        applicationReadinessScore: 90,
        strategicPriorityRank: 1,
        strategicCareerValue: "Transformative",
        positioningAngle: "Founding Engineer / 0-to-1 Builder",
        truthfulNarrative: "Narrative",
        keyProjectProofs: [],
        studyChecklist: [],
        tailoredAssets: {
          professionalSummary: "Summary",
          coverLetter: "Cover",
          recruiterDM: "DM",
          hiringManagerNote: "Note",
        },
        interviewDossier: [],
      },
    },
    {
      id: "job-2",
      title: "Senior Product Engineer",
      company: "Acme SaaS",
      companyUrl: null,
      location: "Remote",
      remoteType: "remote",
      employmentType: "full_time",
      salary: "$120k",
      description: "Multi-tenant SaaS",
      responsibilities: ["Build SaaS"],
      requiredSkills: ["Next.js", "Prisma", "PostgreSQL"],
      preferredSkills: [],
      seniority: "Senior",
      domain: "B2B SaaS",
      sourceUrl: null,
      source: "remoteok",
      status: "applied",
      twentyOpportunityId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      assessment: {
        id: "a-2",
        overallScore: 84,
        technicalMatch: 85,
        capabilityMatch: 85,
        domainMatch: 80,
        experienceMatch: 80,
        recommendation: "High Priority",
        whySummary: "Strong fit",
        strongEvidence: ["Hogwarts"],
        criticalMissing: [],
        niceToHaveMissing: [],
        risks: [],
        talkingPoints: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      strategy: {
        targetJobTitle: "Senior Product Engineer",
        companyName: "Acme SaaS",
        jobFitScore: 84,
        builderFitScore: 88,
        applicationReadinessScore: 80,
        strategicPriorityRank: 1,
        strategicCareerValue: "High Value",
        positioningAngle: "Full-Stack AI Engineer",
        truthfulNarrative: "Narrative",
        keyProjectProofs: [],
        studyChecklist: [],
        tailoredAssets: {
          professionalSummary: "Summary",
          coverLetter: "Cover",
          recruiterDM: "DM",
          hiringManagerNote: "Note",
        },
        interviewDossier: [],
      },
    },
    {
      id: "job-3",
      title: "Bare-Metal Embedded Engineer",
      company: "Legacy Corp",
      companyUrl: null,
      location: "Onsite",
      remoteType: "onsite",
      employmentType: "full_time",
      salary: null,
      description: "C++ drivers",
      responsibilities: ["Drivers"],
      requiredSkills: ["C++", "Vulkan"],
      preferredSkills: [],
      seniority: "Lead",
      domain: "Embedded",
      sourceUrl: null,
      source: "manual",
      status: "discovered",
      twentyOpportunityId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      assessment: {
        id: "a-3",
        overallScore: 40,
        technicalMatch: 30,
        capabilityMatch: 40,
        domainMatch: 30,
        experienceMatch: 50,
        recommendation: "Low Probability",
        whySummary: "Gaps",
        strongEvidence: [],
        criticalMissing: ["C++ kernel drivers"],
        niceToHaveMissing: [],
        risks: [],
        talkingPoints: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
  ];

  it("calculates conversion funnel stages and conversion rates accurately", () => {
    const funnel = calculateConversionFunnel(mockJobs);
    expect(funnel.totalDiscovered).toBe(3);
    expect(funnel.totalQualified).toBe(2);
    expect(funnel.totalApplied).toBe(2);
    expect(funnel.totalOffers).toBe(1);
    expect(funnel.qualificationRate).toBe(67);
    expect(funnel.offerRate).toBe(50);
  });

  it("evaluates campaign conversion performance and efficiency scoring", () => {
    const campaignPerf = calculateCampaignPerformance(mockJobs, DEFAULT_CAMPAIGNS);
    expect(campaignPerf.length).toBeGreaterThan(0);

    const foundingCamp = campaignPerf.find((c) => c.campaignId === "campaign-founding-engineer");
    expect(foundingCamp).toBeDefined();
    expect(foundingCamp?.jobsFound).toBeGreaterThanOrEqual(1);
    expect(foundingCamp?.offers).toBe(1);
    expect(foundingCamp?.efficiencyScore).toBeGreaterThan(0);
  });

  it("tracks dynamic positioning performance across angles", () => {
    const posPerf = calculatePositioningPerformance(mockJobs);
    expect(posPerf.length).toBeGreaterThanOrEqual(2);
    const foundingPos = posPerf.find((p) => p.positioningAngle.includes("Founding"));
    expect(foundingPos).toBeDefined();
    expect(foundingPos?.offersCount).toBe(1);
  });

  it("measures source quality matrix", () => {
    const sourceQuality = calculateSourceQuality(mockJobs);
    expect(sourceQuality.length).toBe(3);
    const githubSrc = sourceQuality.find((s) => s.sourceName === "github");
    expect(githubSrc?.qualificationRate).toBe(100);
  });

  it("generates structured weekly review with actionable recommendations", () => {
    const review = generateWeeklyJobSearchReview(mockJobs);
    expect(review.discoveredCount).toBe(3);
    expect(review.topPerformingCampaign).toBeTruthy();
    expect(review.recommendedNextWeekFocus.length).toBeGreaterThanOrEqual(3);
    expect(review.weekStarting).toBeTruthy();
    expect(review.weekEnding).toBeTruthy();
  });
});
