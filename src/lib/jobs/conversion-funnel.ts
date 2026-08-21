import { DEFAULT_CAMPAIGNS, evaluateCampaignMatches } from "./campaigns";
import {
  CampaignConversionPerformance,
  CareerConversionFunnel,
  FullJobWithAssessment,
  JobCampaign,
  JobStatus,
  PositioningConversionPerformance,
  SourceQualityPerformance,
  WeeklyJobSearchReview,
} from "./types";

export function calculateConversionFunnel(jobs: FullJobWithAssessment[]): CareerConversionFunnel {
  let totalDiscovered = jobs.length;
  let totalQualified = 0;
  let totalPrepared = 0;
  let totalApplied = 0;
  let totalResponses = 0;
  let totalScreens = 0;
  let totalTechnicalRounds = 0;
  let totalFinalRounds = 0;
  let totalOffers = 0;
  let totalRejections = 0;

  for (const j of jobs) {
    const s = j.status;
    const score = j.assessment?.overallScore ?? 0;

    if (score >= 70 || ["qualified", "high_priority", "preparing", "ready_to_apply", "applied", "response", "screen", "interview", "technical_round", "final_round", "offer"].includes(s)) {
      totalQualified++;
    }

    if (["preparing", "ready_to_apply", "applied", "response", "screen", "interview", "technical_round", "final_round", "offer"].includes(s)) {
      totalPrepared++;
    }

    if (["applied", "response", "screen", "interview", "technical_round", "final_round", "offer", "rejected"].includes(s) && s !== "qualified" && s !== "analyzed" && s !== "discovered") {
      totalApplied++;
    }

    if (["response", "screen", "interview", "technical_round", "final_round", "offer"].includes(s)) {
      totalResponses++;
    }

    if (["screen", "interview", "technical_round", "final_round", "offer"].includes(s)) {
      totalScreens++;
    }

    if (["technical_round", "final_round", "offer"].includes(s)) {
      totalTechnicalRounds++;
    }

    if (["final_round", "offer"].includes(s)) {
      totalFinalRounds++;
    }

    if (s === "offer") {
      totalOffers++;
    }

    if (s === "rejected" || j.outcome?.outcome?.includes("rejected")) {
      totalRejections++;
    }
  }

  // Safe division rates
  const qualificationRate = totalDiscovered > 0 ? Math.round((totalQualified / totalDiscovered) * 100) : 0;
  const applicationRate = totalQualified > 0 ? Math.round((totalApplied / totalQualified) * 100) : 0;
  const responseRate = totalApplied > 0 ? Math.round((totalResponses / totalApplied) * 100) : 0;
  const interviewConversionRate = totalApplied > 0 ? Math.round((totalScreens / totalApplied) * 100) : 0;
  const technicalPassRate = totalTechnicalRounds > 0 ? Math.round((totalFinalRounds / totalTechnicalRounds) * 100) : 0;
  const offerRate = totalApplied > 0 ? Math.round((totalOffers / totalApplied) * 100) : 0;

  return {
    totalDiscovered,
    totalQualified,
    totalPrepared,
    totalApplied,
    totalResponses,
    totalScreens,
    totalTechnicalRounds,
    totalFinalRounds,
    totalOffers,
    totalRejections,
    qualificationRate,
    applicationRate,
    responseRate,
    interviewConversionRate,
    technicalPassRate,
    offerRate,
  };
}

export function calculateCampaignPerformance(
  jobs: FullJobWithAssessment[],
  campaigns: JobCampaign[] = DEFAULT_CAMPAIGNS
): CampaignConversionPerformance[] {
  return campaigns.map((camp) => {
    const matchedJobs = jobs.filter((j) => evaluateCampaignMatches(j, [camp]).length > 0);
    const qualified = matchedJobs.filter((j) => (j.assessment?.overallScore ?? 0) >= camp.minOverallScore).length;
    const applied = matchedJobs.filter((j) => ["applied", "response", "screen", "interview", "technical_round", "final_round", "offer"].includes(j.status)).length;
    const responses = matchedJobs.filter((j) => ["response", "screen", "interview", "technical_round", "final_round", "offer"].includes(j.status)).length;
    const interviews = matchedJobs.filter((j) => ["screen", "interview", "technical_round", "final_round", "offer"].includes(j.status)).length;
    const offers = matchedJobs.filter((j) => j.status === "offer").length;

    const responseRate = applied > 0 ? Math.round((responses / applied) * 100) : 0;
    const interviewRate = applied > 0 ? Math.round((interviews / applied) * 100) : 0;

    // Efficiency Score: 40% interview rate + 30% response rate + 30% qualification density
    const qualificationDensity = matchedJobs.length > 0 ? (qualified / matchedJobs.length) * 100 : 0;
    const efficiencyScore = Math.round(interviewRate * 0.4 + responseRate * 0.3 + qualificationDensity * 0.3);

    return {
      campaignId: camp.id,
      campaignName: camp.name,
      jobsFound: matchedJobs.length,
      qualified,
      applied,
      responses,
      interviews,
      offers,
      responseRate,
      interviewRate,
      efficiencyScore,
    };
  });
}

export function calculatePositioningPerformance(jobs: FullJobWithAssessment[]): PositioningConversionPerformance[] {
  const positioningMap: Record<string, { applied: number; responses: number; interviews: number; offers: number }> = {
    "Full-Stack AI Engineer": { applied: 0, responses: 0, interviews: 0, offers: 0 },
    "Founding Engineer / 0-to-1 Builder": { applied: 0, responses: 0, interviews: 0, offers: 0 },
    "Multi-Tenant SaaS Systems Architect": { applied: 0, responses: 0, interviews: 0, offers: 0 },
    "Senior Frontend & Design Systems": { applied: 0, responses: 0, interviews: 0, offers: 0 },
  };

  for (const j of jobs) {
    const angle = j.strategy?.positioningAngle || "Full-Stack AI Engineer";
    const key = Object.keys(positioningMap).find((k) => angle.toLowerCase().includes(k.toLowerCase().slice(0, 10))) || "Full-Stack AI Engineer";

    const s = j.status;
    const isApplied = ["applied", "response", "screen", "interview", "technical_round", "final_round", "offer"].includes(s);
    if (isApplied) positioningMap[key].applied++;
    if (["response", "screen", "interview", "technical_round", "final_round", "offer"].includes(s)) positioningMap[key].responses++;
    if (["screen", "interview", "technical_round", "final_round", "offer"].includes(s)) positioningMap[key].interviews++;
    if (s === "offer") positioningMap[key].offers++;
  }

  return Object.entries(positioningMap).map(([positioningAngle, stats]) => ({
    positioningAngle,
    applicationsCount: stats.applied,
    responsesCount: stats.responses,
    interviewsCount: stats.interviews,
    offersCount: stats.offers,
    responseRate: stats.applied > 0 ? Math.round((stats.responses / stats.applied) * 100) : 0,
    interviewRate: stats.applied > 0 ? Math.round((stats.interviews / stats.applied) * 100) : 0,
  }));
}

export function calculateSourceQuality(jobs: FullJobWithAssessment[]): SourceQualityPerformance[] {
  const sourcesMap: Record<string, { total: number; qualified: number; responses: number }> = {};

  for (const j of jobs) {
    const src = j.source || "manual";
    if (!sourcesMap[src]) {
      sourcesMap[src] = { total: 0, qualified: 0, responses: 0 };
    }
    sourcesMap[src].total++;
    if ((j.assessment?.overallScore ?? 0) >= 70) sourcesMap[src].qualified++;
    if (["response", "screen", "interview", "technical_round", "final_round", "offer"].includes(j.status)) {
      sourcesMap[src].responses++;
    }
  }

  return Object.entries(sourcesMap).map(([sourceName, data]) => ({
    sourceName,
    jobsCount: data.total,
    qualifiedCount: data.qualified,
    responsesCount: data.responses,
    qualificationRate: data.total > 0 ? Math.round((data.qualified / data.total) * 100) : 0,
    responseRate: data.total > 0 ? Math.round((data.responses / data.total) * 100) : 0,
  }));
}

export function generateWeeklyJobSearchReview(jobs: FullJobWithAssessment[]): WeeklyJobSearchReview {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const weekJobs = jobs.filter((j) => new Date(j.createdAt) >= weekAgo);
  const discoveredCount = weekJobs.length;
  const highPriorityCount = weekJobs.filter((j) => (j.assessment?.overallScore ?? 0) >= 80).length;
  const applicationsSentCount = weekJobs.filter((j) => ["applied", "response", "screen", "interview", "technical_round", "final_round", "offer"].includes(j.status)).length;
  const responsesCount = weekJobs.filter((j) => ["response", "screen", "interview", "technical_round", "final_round", "offer"].includes(j.status)).length;
  const interviewsCount = weekJobs.filter((j) => ["screen", "interview", "technical_round", "final_round", "offer"].includes(j.status)).length;

  const campaignPerf = calculateCampaignPerformance(jobs);
  const bestCampaign = campaignPerf.sort((a, b) => b.efficiencyScore - a.efficiencyScore)[0]?.campaignName || "Remote Full-Stack AI Builder";

  const posPerf = calculatePositioningPerformance(jobs);
  const bestPos = posPerf.sort((a, b) => b.responseRate - a.responseRate)[0]?.positioningAngle || "Founding Engineer / 0-to-1 Builder";

  // Identify recurring critical blockers from rejected or high-priority jobs
  const blockersCount: Record<string, number> = {};
  for (const j of jobs) {
    for (const b of j.assessment?.criticalMissing || []) {
      blockersCount[b] = (blockersCount[b] || 0) + 1;
    }
  }
  const topBlocker = Object.entries(blockersCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "System Design for Multi-Tenant Data Isolation";

  const recommendations = [
    `Focus next week's discovery primarily on '${bestCampaign}' which shows the highest conversion efficiency.`,
    `Leverage '${bestPos}' positioning angle for cold founder outreach and initial notes.`,
    `Spend 3-4 hours strengthening the case study artifact for '${topBlocker}' using Hogwarts/Kun code evidence.`,
    `Ensure all high-priority qualified applications are submitted within 24 hours of discovery to capture first-applicant advantage.`,
  ];

  return {
    weekStarting: weekAgo.toISOString().split("T")[0],
    weekEnding: now.toISOString().split("T")[0],
    discoveredCount,
    highPriorityCount,
    applicationsSentCount,
    responsesCount,
    interviewsCount,
    topPerformingCampaign: bestCampaign,
    topPerformingPositioning: bestPos,
    keySkillGapBottleneck: topBlocker,
    repeatedInterviewInsight: "Emphasize concrete PostgreSQL schema multi-tenancy and Vercel AI SDK structured generation in initial screens.",
    recommendedNextWeekFocus: recommendations,
    generatedAt: now.toISOString(),
  };
}
