// ── Job Engine: Domain Types, Provenance & Production Observability ─────────

export type EvidenceLevel = "level_1_metadata" | "level_2_source" | "level_3_deep_local";

export type ArtifactType =
  | "source_file"
  | "package_manifest"
  | "database_schema"
  | "api_route"
  | "component"
  | "workflow"
  | "test"
  | "git_commit"
  | "documentation"
  | "configuration"
  | "deployment";

export type ExtractionMethod =
  | "deterministic"
  | "static_analysis"
  | "ast_analysis"
  | "ai_inference"
  | "manual";

export type SourceType = "local" | "github" | "git" | "snapshot" | "manual";

export type EvidenceWeight = "deep_production_proof" | "surface_manifest_proof" | "metadata_proof";

export type EvidenceFreshness = "fresh" | "aging" | "stale";

// ── 1. Repository Identity vs Repository Source ──────────────────────────────

export interface RepositorySource {
  type: SourceType;
  location: string;
  isAvailable: boolean;
  lastCheckedAt?: string;
  fingerprint?: string;
}

export interface RepositoryIdentity {
  id: string;
  organization: string;
  name: string;
  canonicalUrl: string;
  defaultBranch: string;
  visibility: "public" | "private" | "internal";
  description: string;
  primaryLanguage: string;
  domain: string;
  sources: RepositorySource[];
}

// ── 2. Explicit Evidence & Provenance Model ──────────────────────────────────

export interface EvidenceFact {
  id: string;
  repositoryId: string;
  sourceType: SourceType;
  artifactType: ArtifactType;
  artifactPath: string;
  claim: string;
  rawProof?: string;
  evidenceWeight: EvidenceWeight;
  freshness: EvidenceFreshness;
  revisionFingerprint?: string;
  extractionMethod: ExtractionMethod;
  confidence: "high" | "medium" | "low";
  extractedAt: string;
}

export interface CapabilityInference {
  id: string;
  name: string;
  category:
    | "Architecture"
    | "Frontend"
    | "Backend"
    | "AI"
    | "Systems"
    | "Mobile"
    | "Automation"
    // Non-software engineering lanes, evidenced from the CV rather than a repo.
    | "Power Systems"
    | "Marine";
  level: "Expert" | "Proficient" | "Advanced" | "Foundational";
  description: string;
  reasoning: string;
  confidence: "high" | "medium" | "low";
  supportingFactIds: string[];
  facts: EvidenceFact[];
}

export interface MarketPositioningRole {
  title: string;
  justification: string;
  readinessScore: number;
  supportingCapabilityIds: string[];
  strongestProjectProofs: string[];
}

export interface TechnologySkillFact {
  name: string;
  category:
    | "Frontend"
    | "Backend"
    | "Database"
    | "AI / ML"
    | "DevOps / Infra"
    | "Mobile"
    | "Systems"
    | "Design"
    | "Automation"
    // Non-software engineering lanes. These carry CV-sourced evidence rather
    // than repository evidence, and the matcher partitions on them so a
    // software job never sees a protection relay in its verified stack.
    | "Power Systems"
    | "Industrial & Plant"
    | "Marine";
  level: "Deep Production" | "Proficient" | "Working Knowledge";
  depth: EvidenceWeight;
  facts: EvidenceFact[];
}

// ── 3. Candidate Engineering Knowledge Profile (3-Layer Model) ───────────────

export interface EngineeringKnowledgeProfile {
  candidateName: string;
  headline: string;
  analyzerVersion: string;
  facts: EvidenceFact[];
  capabilities: CapabilityInference[];
  positioningRoles: MarketPositioningRole[];
  technologies: TechnologySkillFact[];
  repositories: RepositoryIdentity[];
  overallFreshness: EvidenceFreshness;
  updatedAt: string;
}

// ── 4. Job Ingestion, Normalization & Deduplication ──────────────────────────

export type RemoteType = "remote" | "hybrid" | "onsite";
export type EmploymentType = "full_time" | "part_time" | "contract" | "freelance";
export type JobStatus =
  | "discovered"
  | "analyzed"
  | "needs_review"
  | "qualified"
  | "high_priority"
  | "preparing"
  | "ready_to_apply"
  | "applied"
  | "response"
  | "screen"
  | "interview"
  | "technical_round"
  | "final_round"
  | "offer"
  | "rejected"
  | "withdrawn"
  | "ghosted"
  | "archived";

export type JobOpportunityStatus = JobStatus;

export interface NormalizedJobInput {
  title: string;
  company: string;
  companyUrl?: string;
  location?: string;
  remoteType: RemoteType;
  employmentType: EmploymentType;
  salary?: string;
  description: string;
  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  seniority?: string;
  domain?: string;
  sourceUrl?: string;
  source?: string;
  rawTextSnapshot?: string;
  fingerprint?: string; // Deterministic hash of (company + title + remoteType)
}

// ── 5. Explainable 5D Match & Blocker Breakdown ──────────────────────────────

export type BlockerSeverity = "hard_blocker" | "significant_gap" | "learnable_gap";

export interface BlockerItem {
  skillOrRequirement: string;
  severity: BlockerSeverity;
  reason: string;
  mitigationStrategy?: string;
}

export interface DimensionScore {
  name: string;
  score: number;
  weight: number;
  weightedContribution: number;
  explanation: string;
  contributingFacts: string[];
}

export interface MatchScoreBreakdown {
  overallScore: number;
  fitConfidence: "high" | "medium" | "low";
  confidenceReasoning: string;
  dimensions: {
    technical: DimensionScore;
    capability: DimensionScore;
    domain: DimensionScore;
    seniority: DimensionScore;
  };
  recommendation:
    | "High Priority"
    | "Strong Fit"
    | "Prepare & Apply"
    | "Low Probability"
    | "Not a Fit";
  whySummary: string;
  positiveContributions: string[];
  negativeDeductions: string[];
  strongEvidence: string[];
  blockers: BlockerItem[];
  criticalMissing: string[];
  niceToHaveMissing: string[];
  risks: string[];
  assumptions: string[];
  talkingPoints: string[];
}

// ── 6. Phase 2: Opportunity & Problem-Based Intelligence ─────────────────────

export type CompanyStage = "early_stage" | "growth_scaleup" | "mature_enterprise" | "agency_studio";
export type AIAdoptionLevel = "core_product" | "internal_efficiency" | "exploratory" | "none";
export type TeamDistributionModel = "fully_remote" | "distributed_hybrid" | "onsite_centric";

export interface CompanyIntelligence {
  companyName: string;
  stage: CompanyStage;
  aiAdoption: AIAdoptionLevel;
  teamDistribution: TeamDistributionModel;
  engineeringCultureSignals: string[];
  primaryProductType: string;
  strategicAdvantageForCandidate: string;
  confidence: "high" | "medium" | "low";
}

export interface DatabaytSolutionProof {
  repoId: string;
  projectName: string;
  problemSolved: string;
  architecturalSolution: string;
  verifiedProofs: string[];
}

export interface ProblemMatchAnalysis {
  companyUnderlyingProblems: string[];
  roleCoreNeed: string;
  builderFitScore: number;
  builderFitReasoning: string;
  builderDimensions: {
    autonomyAndOwnership: number;
    zeroToOneCreation: number;
    fullstackVersatility: number;
    productAgency: number;
  };
  relevantDatabaytSolutions: DatabaytSolutionProof[];
  candidateStrategicAdvantage: string;
}

// ── 7. Phase 2: Application Strategy & Tailored Evidence Assets ──────────────

export interface InterviewStoryStar {
  questionType: string;
  context: string;
  problem: string;
  decision: string;
  tradeoff: string;
  implementation: string;
  outcome: string;
  projectProof: string;
}

export interface StudyTaskItem {
  topic: string;
  whyNeeded: string;
  urgency: "critical" | "recommended" | "optional";
  estimatedHours: number;
}

export interface ApplicationStrategy {
  targetJobTitle: string;
  companyName: string;
  jobFitScore: number;
  builderFitScore: number;
  applicationReadinessScore: number;
  readinessAssessment?: string;
  readinessGapReasoning?: string;
  
  strategicPriorityRank: number;
  strategicCareerValue: "Transformative" | "High Value" | "Solid Opportunity" | "Stepping Stone";
  
  positioningAngle: string;
  truthfulNarrative: string;
  
  keyProjectProofs: Array<{
    name: string;
    canonicalUrl: string;
    oneLinerProof: string;
  }>;
  
  studyChecklist: StudyTaskItem[];
  
  tailoredAssets: {
    professionalSummary: string;
    coverLetter: string;
    recruiterDM: string;
    hiringManagerNote: string;
  };
  
  interviewDossier: InterviewStoryStar[];
}

// ── 8. Phase 2: Campaigns & Ingestion Filters ────────────────────────────────

export interface JobCampaign {
  id: string;
  name: string;
  description: string;
  targetRoles: string[];
  targetLocations: string[];
  remoteOnly: boolean;
  minOverallScore: number;
  minBuilderFit: number;
  focusKeywords: string[];
  isActive: boolean;
}

// ── 9. Phase 3A: Outcome Intelligence & Conversion Funnel ────────────────────

export type OutcomeCategory =
  | "offer"
  | "rejected_pre_interview"
  | "rejected_recruiter_screen"
  | "rejected_technical"
  | "rejected_final"
  | "withdrew"
  | "ghosted_no_response"
  | "role_closed";

export type OutcomeReasonCategory =
  | "skills_gap"
  | "seniority_mismatch"
  | "location_visa"
  | "compensation_mismatch"
  | "culture_fit"
  | "competition_volume"
  | "timing_role_filled"
  | "unknown";

export interface JobOutcomeRecord {
  id: string;
  jobId: string;
  appliedAt?: string;
  positioningAngle?: string;
  campaignId?: string;
  stage: JobStatus;
  outcome?: OutcomeCategory;
  reasonCategory?: OutcomeReasonCategory;
  observedFeedback?: string;
  candidateHypothesis?: string;
  recordedAt: string;
}

export interface CareerConversionFunnel {
  totalDiscovered: number;
  totalQualified: number;
  totalPrepared: number;
  totalApplied: number;
  totalResponses: number;
  totalScreens: number;
  totalTechnicalRounds: number;
  totalFinalRounds: number;
  totalOffers: number;
  totalRejections: number;
  
  // Rates
  qualificationRate: number;     // qualified / discovered
  applicationRate: number;       // applied / qualified
  responseRate: number;          // responses / applied
  interviewConversionRate: number;// screens / applied
  technicalPassRate: number;     // final / technical
  offerRate: number;             // offers / applied
}

export interface CampaignConversionPerformance {
  campaignId: string;
  campaignName: string;
  jobsFound: number;
  qualified: number;
  applied: number;
  responses: number;
  interviews: number;
  offers: number;
  responseRate: number;
  interviewRate: number;
  efficiencyScore: number; // Combined conversion score
}

export interface PositioningConversionPerformance {
  positioningAngle: string;
  applicationsCount: number;
  responsesCount: number;
  interviewsCount: number;
  offersCount: number;
  responseRate: number;
  interviewRate: number;
}

export interface SourceQualityPerformance {
  sourceName: string;
  jobsCount: number;
  qualifiedCount: number;
  responsesCount: number;
  qualificationRate: number;
  responseRate: number;
}

export interface WeeklyJobSearchReview {
  weekStarting: string;
  weekEnding: string;
  discoveredCount: number;
  highPriorityCount: number;
  applicationsSentCount: number;
  responsesCount: number;
  interviewsCount: number;
  topPerformingCampaign: string;
  topPerformingPositioning: string;
  keySkillGapBottleneck: string;
  repeatedInterviewInsight: string;
  recommendedNextWeekFocus: string[];
  generatedAt: string;
}

// ── 10. Production Observability & Health Telemetry ──────────────────────────

export interface EngineObservabilityStats {
  repositoriesDiscovered: number;
  repositoriesAnalyzed: number;
  totalFactsExtracted: number;
  factsByWeight: {
    deepProduction: number;
    surfaceManifest: number;
    metadata: number;
  };
  evidenceFreshness: EvidenceFreshness;
  lastScannedAt: string;
  analyzerVersion: string;
  activeCampaignsCount: number;
}

export interface FullJobWithAssessment {
  id: string;
  title: string;
  company: string;
  companyUrl: string | null;
  location: string | null;
  remoteType: RemoteType;
  employmentType: EmploymentType;
  salary: string | null;
  description: string;
  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  seniority: string | null;
  domain: string | null;
  sourceUrl: string | null;
  source: string;
  status: JobStatus;
  twentyOpportunityId: string | null;
  createdAt: Date;
  updatedAt: Date;
  assessment: {
    id: string;
    overallScore: number;
    technicalMatch: number;
    capabilityMatch: number;
    domainMatch: number;
    experienceMatch: number;
    recommendation: string;
    whySummary: string;
    strongEvidence: string[];
    criticalMissing: string[];
    niceToHaveMissing: string[];
    risks: string[];
    talkingPoints: string[];
    createdAt: Date;
    updatedAt: Date;
  } | null;
  problemMatch?: ProblemMatchAnalysis | null;
  strategy?: ApplicationStrategy | null;
  outcome?: JobOutcomeRecord | null;
}
