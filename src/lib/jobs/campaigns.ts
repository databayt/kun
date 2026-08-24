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

  // ── Kigali, Aug 31 – Sep 30 2026 ───────────────────────────────────────────
  // Mirrors jobs/kigali-campaigns.json. Keep the two in step — that file is the
  // canonical campaign data and this array is what the engine actually reads.
  //
  // Matching here is bare substring over title + description + skills +
  // location (evaluateCampaignMatches, below), so two-letter keywords are
  // poison: the researched file listed "CT" and "VT", and "ct" lives inside
  // "produ(ct)", "conne(ct)" and "ele(ct)rical" — the protection campaign
  // claimed 13 of 16 jobs, Irembo and a biomedical role included.
  {
    id: "kigali-protection-engineer",
    name: "Protection Engineer — Kigali",
    description:
      "Protection relay testing & substation commissioning roles in Rwanda: REG/EUCL/EDCL recruitment cycles, EPC substation contractors, utility-scale projects. Evidence: 4 years SEC/SWCC/EEIC 33/13.8 kV testing, OMICRON + Megger bench.",
    targetRoles: [
      "Protection Engineer",
      "Testing & Commissioning Engineer",
      "Substation Engineer",
      "Grid Protection Engineer",
      "SCADA Engineer",
    ],
    targetLocations: ["Kigali", "Rwanda"],
    remoteOnly: false,
    minOverallScore: 55,
    minBuilderFit: 0,
    focusKeywords: [
      "protection relay",
      "substation",
      "testing and commissioning",
      "33kV",
      "SCADA",
      "CT/VT",
      "instrument transformer",
      "switchgear",
      "VCB",
      "OMICRON",
      "Megger",
      "EUCL",
      "Rwanda Energy Group",
    ],
    isActive: true,
  },
  {
    id: "kigali-electrical-engineer",
    name: "Electrical Engineer — Kigali",
    description:
      "Industrial & energy electrical engineering in Rwanda: mines (Trinity Metals), brewery/cement plants (Bralirwa, CIMERWA), e-mobility (Ampersand), solar/energy access (BBOXX, ENGIE). BSc EE + Saudi Council of Engineers.",
    targetRoles: [
      "Electrical Engineer",
      "E&I Engineer",
      "Electromechanical Engineer",
      "Maintenance Engineer",
      "Plant Engineer",
      "Biomedical Engineer",
    ],
    targetLocations: ["Kigali", "Rwanda"],
    remoteOnly: false,
    minOverallScore: 55,
    minBuilderFit: 0,
    focusKeywords: [
      "electrical",
      "electromechanical",
      "maintenance",
      "switchgear",
      "motors",
      "industrial",
      "solar",
      "battery",
      "medium voltage",
      "instrumentation",
    ],
    isActive: true,
  },
  {
    id: "kivu-marine-eto",
    name: "Marine ETO — Lake Kivu",
    description:
      "Electro-Technical Officer & marine-electrical roles on Lake Kivu: KivuWatt methane barge + Wärtsilä power plant (ContourGlobal), Mantis Kivu Queen uBuranga cruise vessel, Kivu Belt water transport. Evidence: 2014–2021 ETO across four shipping lines, STCW certs, Sudanese seaman's book.",
    targetRoles: [
      "Electro-Technical Officer",
      "Marine Electrician",
      "Plant Electrical Technician",
      "Barge Technician",
      "Technical Crew",
    ],
    targetLocations: ["Karongi", "Kibuye", "Rubavu", "Lake Kivu", "Rwanda"],
    remoteOnly: false,
    minOverallScore: 55,
    minBuilderFit: 0,
    focusKeywords: [
      "electro-technical",
      "marine",
      "vessel",
      "barge",
      "Wärtsilä",
      "main engine",
      "auxiliary engine",
      "switchboard",
      "STCW",
      "power plant",
    ],
    isActive: true,
  },
  {
    id: "kigali-web-developer",
    name: "Web Developer — Kigali",
    description:
      "Full-stack web roles + Databayt agency/partnership leads in Kigali: Irembo, Zipline, BK TecHouse, Kasha, One Acre Fund tech, Norrsken House startups, kLab network. Stack: Next.js, React, TypeScript, Postgres/Neon, Auth.js, shadcn, Zod + Databayt repo evidence (hogwarts, codebase, mkan).",
    targetRoles: [
      "Web Developer",
      "Full-Stack Developer",
      "Frontend Developer",
      "Software Engineer",
      "Product Engineer",
      "Data Engineer",
      "Developer",
      "IT Operations Administrator",
    ],
    targetLocations: ["Kigali", "Rwanda", "Remote"],
    remoteOnly: false,
    minOverallScore: 55,
    minBuilderFit: 40,
    focusKeywords: [
      "Next.js",
      "React",
      "TypeScript",
      "full-stack",
      "Postgres",
      "mobile money",
      "MoMo",
      "fintech",
      "Norrsken",
      "kLab",
      "developer",
      "software",
      "referral",
    ],
    isActive: true,
  },
  {
    id: "remote-web-developer-worldwide",
    name: "Remote Web Developer — Worldwide",
    description:
      "Fully-remote Next.js/React/TypeScript roles anywhere in the world, filtered for overlap with Kigali time (CAT, UTC+2): European hours overlap fully, US-Eastern from the Kigali afternoon, US-Pacific rarely. A remote contract is what funds the Kigali stay.",
    targetRoles: [
      "Web Developer",
      "Full-Stack Developer",
      "Frontend Developer",
      "Software Engineer",
      "Product Engineer",
      "Founding Engineer",
    ],
    targetLocations: ["Remote", "Worldwide", "Global", "EMEA", "Europe Remote", "US Remote"],
    remoteOnly: true,
    minOverallScore: 70,
    minBuilderFit: 40,
    focusKeywords: [
      "Next.js",
      "React",
      "TypeScript",
      "remote",
      "Postgres",
      "Prisma",
      "full-stack",
      "distributed team",
      "async",
    ],
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
