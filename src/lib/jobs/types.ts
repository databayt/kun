export type EvidenceCategory =
  | "schema"
  | "routing"
  | "auth"
  | "ui_component"
  | "api_action"
  | "engine"
  | "p2p"
  | "mobile"
  | "automation"
  | "config";

export interface EvidenceItem {
  repo: string;
  path: string;
  type: EvidenceCategory;
  summary: string;
  confidence: "high" | "medium";
}

export interface EngineeringCapability {
  id: string;
  name: string;
  level: "Expert" | "Proficient" | "Advanced";
  description: string;
  evidence: EvidenceItem[];
}

export interface TechnologySkill {
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
  evidence: EvidenceItem[];
}

export interface RepositorySummary {
  id: string;
  name: string;
  localPath: string;
  stack: string[];
  highlights: string[];
  evidenceCount: number;
}

export interface EngineeringKnowledgeProfile {
  candidateName: string;
  headline: string;
  targetRoles: string[];
  capabilities: EngineeringCapability[];
  technologies: TechnologySkill[];
  repositories: RepositorySummary[];
  updatedAt: string;
}

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
}

export interface MatchScoreBreakdown {
  overallScore: number; // 0 - 100
  technicalMatch: number; // 0 - 100
  capabilityMatch: number; // 0 - 100
  domainMatch: number; // 0 - 100
  experienceMatch: number; // 0 - 100
  recommendation:
    | "High Priority"
    | "Strong Fit"
    | "Prepare & Apply"
    | "Low Probability"
    | "Not a Fit";
  whySummary: string;
  strongEvidence: string[];
  criticalMissing: string[];
  niceToHaveMissing: string[];
  risks: string[];
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
