// ── Job Engine: Domain Types & Evidence Model (Phase 1 & Phase 2) ────────────

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
  extractionMethod: ExtractionMethod;
  confidence: "high" | "medium" | "low";
  extractedAt: string;
}

export interface CapabilityInference {
  id: string;
  name: string;
  category: "Architecture" | "Frontend" | "Backend" | "AI" | "Systems" | "Mobile" | "Automation";
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
    | "Automation";
  level: "Deep Production" | "Proficient" | "Working Knowledge";
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
  updatedAt: string;
}

// ── 4. Job Ingestion & Normalization Model ───────────────────────────────────

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
  | "interview"
  | "offer"
  | "rejected"
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
  builderFitScore: number; // 0 - 100
  builderFitReasoning: string;
  builderDimensions: {
    autonomyAndOwnership: number; // 0 - 100
    zeroToOneCreation: number;    // 0 - 100
    fullstackVersatility: number; // 0 - 100
    productAgency: number;        // 0 - 100
  };
  relevantDatabaytSolutions: DatabaytSolutionProof[];
  candidateStrategicAdvantage: string;
}

// ── 7. Phase 2: Application Strategy & Tailored Evidence Assets ──────────────

export interface InterviewStoryStar {
  questionType: string; // e.g. "Architecture & Systems Design", "AI Error Boundaries"
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
  jobFitScore: number;            // 0 - 100 (Technical/Capability match)
  builderFitScore: number;        // 0 - 100 (Product agency & 0-to-1 build scope)
  applicationReadinessScore: number; // 0 - 100 (Preparedness to submit right now)
  readinessAssessment?: string;
  readinessGapReasoning?: string;
  
  strategicPriorityRank: number; // 1 = highest priority
  strategicCareerValue: "Transformative" | "High Value" | "Solid Opportunity" | "Stepping Stone";
  
  positioningAngle: string;
  truthfulNarrative: string; // Grounded career story (EE systems foundations -> high-velocity SaaS/AI builder)
  
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
}
