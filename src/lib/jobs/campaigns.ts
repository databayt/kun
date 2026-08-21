import { FullJobWithAssessment, JobCampaign, NormalizedJobInput } from "./types";

export const DEFAULT_CAMPAIGNS: JobCampaign[] = [
  {
    id: "campaign-remote-ai-builder",
    name: "Remote Full-Stack AI Builder",
    description: "Global remote roles focused on Next.js, AI SDK integration, and high-velocity product delivery.",
    targetRoles: ["Full-Stack AI Engineer", "AI Application Engineer", "Product Engineer", "Full-Stack Engineer"],
    targetLocations: ["Remote", "Global", "US Remote", "Europe Remote"],
    remoteOnly: true,
    minOverallScore: 75,
    minBuilderFit: 80,
    focusKeywords: ["AI", "Next.js", "TypeScript", "Prisma", "LLM", "React"],
    isActive: true,
  },
  {
    id: "campaign-mena-startups",
    name: "Gulf & MENA Startup Engineering",
    description: "High-growth startup and scaleup opportunities in Saudi Arabia, UAE, and Qatar.",
    targetRoles: ["Founding Engineer", "Lead Full-Stack Engineer", "Senior Software Engineer", "SaaS Architect"],
    targetLocations: ["Saudi Arabia", "Riyadh", "UAE", "Dubai", "Qatar", "Doha", "Remote"],
    remoteOnly: false,
    minOverallScore: 70,
    minBuilderFit: 85,
    focusKeywords: ["SaaS", "Bilingual", "Arabic", "Architecture", "Startup"],
    isActive: true,
  },
  {
    id: "campaign-founding-engineer",
    name: "0-to-1 Founding Product Engineer",
    description: "Early-stage startup roles seeking generalists with end-to-end product ownership.",
    targetRoles: ["Founding Engineer", "Lead Product Engineer", "Staff Software Engineer", "CTO / Technical Co-founder"],
    targetLocations: ["Remote", "Global"],
    remoteOnly: true,
    minOverallScore: 70,
    minBuilderFit: 90,
    focusKeywords: ["0 to 1", "Founding", "Product", "Generalist", "Full-Stack"],
    isActive: true,
  },
  {
    id: "campaign-design-systems",
    name: "Senior Frontend & Design Systems",
    description: "Roles valuing pixel-exact design craftsmanship, atomic component architecture, and accessibility.",
    targetRoles: ["Senior Frontend Engineer", "Design Systems Engineer", "UI Architect"],
    targetLocations: ["Remote", "Global"],
    remoteOnly: true,
    minOverallScore: 80,
    minBuilderFit: 70,
    focusKeywords: ["Design System", "Tailwind CSS", "React", "Radix", "Component"],
    isActive: true,
  },
];

export interface PrioritizedOpportunity {
  job: FullJobWithAssessment;
  priorityScore: number; // 0 - 100
  matchedCampaignIds: string[];
  priorityRank: number;
  recommendationAction: string;
}

export function evaluateCampaignMatches(
  job: NormalizedJobInput | FullJobWithAssessment,
  campaigns: JobCampaign[] = DEFAULT_CAMPAIGNS
): string[] {
  const matchedIds: string[] = [];
  const text = `${job.title} ${job.description} ${(job.requiredSkills || []).join(" ")} ${job.location || ""}`.toLowerCase();

  for (const c of campaigns) {
    if (!c.isActive) continue;

    if (c.remoteOnly && job.remoteType !== "remote") {
      continue;
    }

    const matchesRole = c.targetRoles.some((r) => job.title.toLowerCase().includes(r.toLowerCase()));
    const matchesKeyword = c.focusKeywords.some((k) => text.includes(k.toLowerCase()));

    if (matchesRole || matchesKeyword) {
      matchedIds.push(c.id);
    }
  }

  return matchedIds;
}

export function calculateOpportunityPriority(
  job: FullJobWithAssessment,
  campaigns: JobCampaign[] = DEFAULT_CAMPAIGNS
): PrioritizedOpportunity {
  const fitScore = job.assessment?.overallScore ?? 70;
  const builderFitScore = job.problemMatch?.builderFitScore ?? 85;
  const readinessScore = job.strategy?.applicationReadinessScore ?? fitScore;

  const matchedCampaigns = evaluateCampaignMatches(job, campaigns);
  const campaignRelevance = matchedCampaigns.length > 0 ? 95 : 60;

  // Priority formula: 35% Job Fit + 25% Builder Fit + 20% Readiness + 20% Campaign Alignment
  const priorityScore = Math.round(
    fitScore * 0.35 +
    builderFitScore * 0.25 +
    readinessScore * 0.20 +
    campaignRelevance * 0.20
  );

  let recommendationAction = "Review & Prepare";
  if (priorityScore >= 85) {
    recommendationAction = "High Priority: Prepare application assets & apply within 24h";
  } else if (priorityScore >= 70) {
    recommendationAction = "Strong Fit: Review study checklist and tailor portfolio";
  } else if (priorityScore < 55) {
    recommendationAction = "Low Probability: Archive or monitor";
  }

  return {
    job,
    priorityScore,
    matchedCampaignIds: matchedCampaigns,
    priorityRank: priorityScore >= 85 ? 1 : priorityScore >= 70 ? 2 : 3,
    recommendationAction,
  };
}
