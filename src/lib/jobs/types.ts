// ── Job Engine: Domain Types & Evidence Model ───────────────────────────────

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
  location: string; // e.g. "/Users/abdout/hogwarts" or "https://github.com/databayt/hogwarts"
  isAvailable: boolean;
  lastCheckedAt?: string;
  fingerprint?: string; // Commit SHA, tree hash, or mtime fingerprint
}

export interface RepositoryIdentity {
  id: string; // e.g. "hogwarts", "codebase", "mkan"
  organization: string; // e.g. "databayt"
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
  claim: string; // Directly observable fact (e.g. "Contains Prisma schema with schoolId tenant isolation")
  rawProof?: string; // Code snippet, file signature, or manifest line
  extractionMethod: ExtractionMethod;
  confidence: "high" | "medium" | "low";
  extractedAt: string;
}

export interface CapabilityInference {
  id: string;
  name: string; // e.g. "Multi-Tenant SaaS Architecture"
  category: "Architecture" | "Frontend" | "Backend" | "AI" | "Systems" | "Mobile" | "Automation";
  level: "Expert" | "Proficient" | "Advanced" | "Foundational";
  description: string;
  reasoning: string; // Why the facts lead to this conclusion
  confidence: "high" | "medium" | "low";
  supportingFactIds: string[];
  facts: EvidenceFact[];
}

export interface MarketPositioningRole {
  title: string; // e.g. "Full-Stack AI Engineer", "Founding Engineer"
  justification: string;
  readinessScore: number; // 0 - 100
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
  
  // Layer A: Verified Observable Facts
  facts: EvidenceFact[];
  
  // Layer B: Inferred Capabilities with Provenance
  capabilities: CapabilityInference[];
  
  // Layer C: Market Positioning Driven by Evidence
  positioningRoles: MarketPositioningRole[];
  
  // Verified Technology Stack
  technologies: TechnologySkillFact[];
  
  // Repositories Registry
  repositories: RepositoryIdentity[];
  
  updatedAt: string;
}

// ── 4. Job Ingestion & Normalization Model ───────────────────────────────────

export type RemoteType = "remote" | "hybrid" | "onsite";
export type EmploymentType = "full_time" | "part_time" | "contract" | "freelance";
export type JobStatus =
  | "discovered"
  | "analyzed"
  | "qualified"
  | "high_priority"
  | "applied"
  | "interview"
  | "offer"
  | "rejected"
  | "archived";

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
  rawTextSnapshot?: string; // Preserves raw original posting for re-normalization
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
  score: number; // 0 - 100
  weight: number; // e.g. 0.40
  weightedContribution: number;
  explanation: string;
  contributingFacts: string[];
}

export interface MatchScoreBreakdown {
  overallScore: number; // 0 - 100
  fitConfidence: "high" | "medium" | "low"; // Confidence in the assessment
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
  
  // Explainability deltas
  positiveContributions: string[];
  negativeDeductions: string[];
  
  strongEvidence: string[];
  blockers: BlockerItem[];
  criticalMissing: string[]; // For backward compatibility
  niceToHaveMissing: string[]; // For backward compatibility
  risks: string[];
  assumptions: string[];
  talkingPoints: string[];
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
}
