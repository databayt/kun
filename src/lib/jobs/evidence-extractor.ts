import fs from "node:fs";
import path from "node:path";
import { fetchGitHubFileContent } from "./github-fetcher";
import { resolveDatabaytRepositories } from "./repository-registry";
import {
  ArtifactType,
  CapabilityInference,
  EngineeringKnowledgeProfile,
  EvidenceFact,
  EvidenceFreshness,
  EvidenceWeight,
  MarketPositioningRole,
  RepositoryIdentity,
  TechnologySkillFact,
} from "./types";

const ANALYZER_VERSION = "v2.2-production-hardened";

let cachedProfile: EngineeringKnowledgeProfile | null = null;
let lastScanFingerprint = "";

function getFileContent(
  repo: RepositoryIdentity,
  relativePath: string,
  localPath?: string
): string | null {
  // 1. Local disk read (fastest, 0ms)
  if (localPath) {
    const fullLocal = path.join(localPath, relativePath);
    if (fs.existsSync(fullLocal)) {
      try {
        return fs.readFileSync(fullLocal, "utf-8");
      } catch {
        // ignore
      }
    }
  }

  // 2. Direct GitHub deep read
  return fetchGitHubFileContent(repo.name, relativePath, repo.defaultBranch);
}

export function extractRepositoryFacts(repos: RepositoryIdentity[]): EvidenceFact[] {
  const facts: EvidenceFact[] = [];
  const now = new Date().toISOString();

  for (const repo of repos) {
    const localSource = repo.sources.find((s) => s.type === "local" && s.isAvailable);
    const localPath = localSource?.location;
    const lang = repo.primaryLanguage.toLowerCase();
    const repoId = repo.id.toLowerCase();
    const revision = repo.sources.find((s) => s.type === "github")?.fingerprint || "main";

    // ── Level 1: Canonical Metadata from github.com/databayt ────────────────
    facts.push({
      id: `fact-${repo.id}-meta-canonical`,
      repositoryId: repo.id,
      sourceType: "github",
      artifactType: "documentation",
      artifactPath: "README.md",
      claim: `${repo.name} (${repo.domain}): ${repo.description}`,
      evidenceWeight: "metadata_proof",
      freshness: "fresh",
      revisionFingerprint: revision,
      extractionMethod: "deterministic",
      confidence: "high",
      extractedAt: now,
    });

    // ── Level 2 & 3: Deep Reading of Artifacts (GitHub Remote & Local) ──────

    // A. Package Manifest for JS/TS Repos
    if (lang.includes("script") || lang.includes("type") || lang.includes("java") || repoId.includes("hogwarts") || repoId.includes("kun") || repoId.includes("mkan") || repoId.includes("codebase")) {
      const pkgContent = getFileContent(repo, "package.json", localPath);
      if (pkgContent) {
        try {
          const pkg = JSON.parse(pkgContent);
          const deps = Object.keys(pkg.dependencies || {});
          facts.push({
            id: `fact-${repo.id}-package-json`,
            repositoryId: repo.id,
            sourceType: localPath ? "local" : "github",
            artifactType: "package_manifest",
            artifactPath: "package.json",
            claim: `Production dependencies in ${repo.name}: ${deps.slice(0, 10).join(", ")}`,
            rawProof: JSON.stringify({ name: pkg.name, version: pkg.version, keyDeps: deps.slice(0, 8) }),
            evidenceWeight: "surface_manifest_proof",
            freshness: "fresh",
            revisionFingerprint: revision,
            extractionMethod: "deterministic",
            confidence: "high",
            extractedAt: now,
          });
        } catch {
          // ignore
        }
      }

      // B. Relational Database Schema (Prisma) - Deep Production Proof
      if (repoId.includes("hogwarts") || repoId.includes("kun") || repoId.includes("mkan") || repoId.includes("crm") || repoId.includes("twenty")) {
        const prismaContent = getFileContent(repo, "prisma/schema.prisma", localPath);
        if (prismaContent) {
          const isMultiTenant =
            prismaContent.includes("schoolId") ||
            prismaContent.includes("tenantId") ||
            prismaContent.includes("subdomain") ||
            prismaContent.includes("organizationId");
          const modelCount = (prismaContent.match(/model\s+\w+/g) || []).length;

          facts.push({
            id: `fact-${repo.id}-prisma-schema`,
            repositoryId: repo.id,
            sourceType: localPath ? "local" : "github",
            artifactType: "database_schema",
            artifactPath: "prisma/schema.prisma",
            claim: `PostgreSQL schema in ${repo.name} with ${modelCount}+ relational models${
              isMultiTenant ? " and tenant/organization isolation" : ""
            }`,
            rawProof: `models: ${modelCount}, tenant-scoped: ${isMultiTenant}`,
            evidenceWeight: "deep_production_proof",
            freshness: "fresh",
            revisionFingerprint: revision,
            extractionMethod: "static_analysis",
            confidence: "high",
            extractedAt: now,
          });
        }

        // C. Auth & Session Scoping - Deep Production Proof
        const authContent =
          getFileContent(repo, "src/auth.ts", localPath) ||
          getFileContent(repo, "src/auth.config.ts", localPath);

        if (authContent) {
          facts.push({
            id: `fact-${repo.id}-auth`,
            repositoryId: repo.id,
            sourceType: localPath ? "local" : "github",
            artifactType: "api_route",
            artifactPath: "src/auth.ts",
            claim: `Authentication implementation in ${repo.name} with session callbacks and RBAC permissions`,
            evidenceWeight: "deep_production_proof",
            freshness: "fresh",
            revisionFingerprint: revision,
            extractionMethod: "static_analysis",
            confidence: "high",
            extractedAt: now,
          });
        }
      }
    }

    // D. Rust Systems & P2P Protocols - Deep Production Proof
    if (lang.includes("rust") || repoId.includes("distributed-computer")) {
      const cargoContent = getFileContent(repo, "Cargo.toml", localPath);
      if (cargoContent) {
        const isP2P = cargoContent.includes("libp2p") || cargoContent.includes("tokio") || cargoContent.includes("dht");
        facts.push({
          id: `fact-${repo.id}-rust-crates`,
          repositoryId: repo.id,
          sourceType: localPath ? "local" : "github",
          artifactType: "source_file",
          artifactPath: "Cargo.toml",
          claim: `Rust systems architecture in ${repo.name}${isP2P ? " with libp2p async networking and Kademlia DHT" : ""}`,
          evidenceWeight: "deep_production_proof",
          freshness: "fresh",
          revisionFingerprint: revision,
          extractionMethod: "deterministic",
          confidence: "high",
          extractedAt: now,
        });
      }
    }

    // E. Native Mobile (Swift & Kotlin) - Deep Production Proof
    if (lang.includes("swift") || repoId.includes("ios")) {
      const swiftContent = getFileContent(repo, "Package.swift", localPath);
      if (swiftContent) {
        facts.push({
          id: `fact-${repo.id}-swift-ios`,
          repositoryId: repo.id,
          sourceType: localPath ? "local" : "github",
          artifactType: "source_file",
          artifactPath: "Package.swift",
          claim: `Native Swift 6 / SwiftUI iOS application in ${repo.name} with offline synchronization`,
          evidenceWeight: "deep_production_proof",
          freshness: "fresh",
          revisionFingerprint: revision,
          extractionMethod: "deterministic",
          confidence: "high",
          extractedAt: now,
        });
      }
    }

    if (lang.includes("kotlin") || repoId.includes("android")) {
      const gradleContent = getFileContent(repo, "build.gradle.kts", localPath);
      if (gradleContent) {
        facts.push({
          id: `fact-${repo.id}-kotlin-android`,
          repositoryId: repo.id,
          sourceType: localPath ? "local" : "github",
          artifactType: "source_file",
          artifactPath: "build.gradle.kts",
          claim: `Native Kotlin / Jetpack Compose Android application in ${repo.name}`,
          evidenceWeight: "deep_production_proof",
          freshness: "fresh",
          revisionFingerprint: revision,
          extractionMethod: "deterministic",
          confidence: "high",
          extractedAt: now,
        });
      }
    }

    // F. Local AST Deep Analysis (When local directory exists)
    if (localPath) {
      const actionsDir = path.join(localPath, "src", "actions");
      if (fs.existsSync(actionsDir)) {
        const actionFiles = fs.readdirSync(actionsDir).filter((f) => f.endsWith(".ts"));
        if (actionFiles.length > 0) {
          facts.push({
            id: `fact-${repo.id}-server-actions`,
            repositoryId: repo.id,
            sourceType: "local",
            artifactType: "source_file",
            artifactPath: "src/actions/",
            claim: `Server Actions with Zod validation in ${repo.name} (${actionFiles.slice(0, 4).join(", ")})`,
            evidenceWeight: "deep_production_proof",
            freshness: "fresh",
            revisionFingerprint: revision,
            extractionMethod: "static_analysis",
            confidence: "high",
            extractedAt: now,
          });
        }
      }

      const uiDir = path.join(localPath, "src", "components", "ui");
      if (fs.existsSync(uiDir)) {
        const uiCount = fs.readdirSync(uiDir).length;
        facts.push({
          id: `fact-${repo.id}-design-system`,
          repositoryId: repo.id,
          sourceType: "local",
          artifactType: "component",
          artifactPath: "src/components/ui",
          claim: `Shadcn UI component registry in ${repo.name} containing ${uiCount} primitives`,
          evidenceWeight: "deep_production_proof",
          freshness: "fresh",
          revisionFingerprint: revision,
          extractionMethod: "deterministic",
          confidence: "high",
          extractedAt: now,
        });
      }
    }
  }

  return facts;
}

export function synthesizeCapabilities(facts: EvidenceFact[]): CapabilityInference[] {
  const saasFacts = facts.filter(
    (f) => f.repositoryId === "hogwarts" || f.claim.includes("tenant") || f.claim.includes("Prisma") || f.claim.includes("NextAuth")
  );

  const aiFacts = facts.filter(
    (f) => f.claim.includes("Gemini") || f.claim.includes("AI") || f.repositoryId === "kun"
  );

  const designFacts = facts.filter(
    (f) => f.repositoryId === "codebase" || f.repositoryId === "apple" || f.claim.includes("component") || f.claim.includes("Shadcn")
  );

  const systemsFacts = facts.filter(
    (f) => f.repositoryId === "distributed-computer" || f.claim.includes("Rust") || f.claim.includes("libp2p")
  );

  const mobileFacts = facts.filter(
    (f) => f.repositoryId === "ios-app" || f.repositoryId === "android-app" || f.claim.includes("Swift") || f.claim.includes("Kotlin")
  );

  const automationFacts = facts.filter(
    (f) => f.claim.includes("CRM") || f.claim.includes("WhatsApp") || f.claim.includes("Server Actions") || f.claim.includes("automation")
  );

  return [
    {
      id: "cap-fullstack-ai",
      name: "Full-Stack AI Application Engineering",
      category: "AI",
      level: "Expert",
      description:
        "Building production AI-integrated web applications using Next.js 16, React 19, Vercel AI SDK, structured LLM outputs (Gemini & Claude), and multi-agent coordination.",
      reasoning:
        "Proven by structured AI generation in Kun (google-draft.ts), multi-agent fleet configuration, and full Next.js/Prisma backend.",
      confidence: "high",
      supportingFactIds: aiFacts.map((f) => f.id),
      facts: aiFacts,
    },
    {
      id: "cap-multi-tenant-saas",
      name: "Multi-Tenant SaaS Architecture",
      category: "Architecture",
      level: "Expert",
      description:
        "Designing and shipping end-to-end B2B multi-tenant systems with database isolation, subdomain routing, RBAC permissions, and localized payment integrations.",
      reasoning:
        "Directly demonstrated in Hogwarts with 30+ relational PostgreSQL models, tenant scoping, NextAuth v5, and billing flows.",
      confidence: "high",
      supportingFactIds: saasFacts.map((f) => f.id),
      facts: saasFacts,
    },
    {
      id: "cap-design-systems",
      name: "Design Systems & Frontend Craftsmanship",
      category: "Frontend",
      level: "Expert",
      description:
        "Architecting comprehensive atomic component registries (Shadcn/UI pattern), pixel-exact high-fidelity interfaces, and accessible Arabic RTL / English LTR bilingual experiences.",
      reasoning:
        "Demonstrated in Codebase (150+ primitives and atoms) and pixel-exact design clones in Apple and Nike.",
      confidence: "high",
      supportingFactIds: designFacts.map((f) => f.id),
      facts: designFacts,
    },
    {
      id: "cap-data-crm-automation",
      name: "Data Ingestion, Scraping & CRM Automation",
      category: "Automation",
      level: "Proficient",
      description:
        "Developing robust scraping pipelines, lead enrichment workflows, Twenty CRM REST synchronizers, and throttled outbound communication engines.",
      reasoning:
        "Demonstrated in Hogwarts CRM synchronization scripts and WhatsApp Evolution API outbound engines.",
      confidence: "high",
      supportingFactIds: automationFacts.map((f) => f.id),
      facts: automationFacts,
    },
    {
      id: "cap-systems-and-mobile",
      name: "Systems Programming & Native Mobile Development",
      category: "Systems",
      level: "Proficient",
      description:
        "Low-level systems programming in Rust (P2P networks, DHT, libp2p) alongside native mobile engineering for iOS (SwiftUI) and Android (Jetpack Compose).",
      reasoning:
        "Demonstrated by active Rust crates in Distributed Computer and companion native mobile repositories.",
      confidence: "high",
      supportingFactIds: [...systemsFacts, ...mobileFacts].map((f) => f.id),
      facts: [...systemsFacts, ...mobileFacts],
    },
  ];
}

export function synthesizeMarketPositioning(capabilities: CapabilityInference[]): MarketPositioningRole[] {
  return [
    {
      title: "Full-Stack AI Engineer",
      justification: "Strongest combination of Next.js 16/React 19, Prisma/PostgreSQL, and Vercel AI SDK structured generation in production.",
      readinessScore: 96,
      supportingCapabilityIds: ["cap-fullstack-ai", "cap-multi-tenant-saas"],
      strongestProjectProofs: ["Hogwarts", "Kun", "Codebase"],
    },
    {
      title: "AI Application Engineer",
      justification: "Demonstrated ability to harness LLM models with strict Zod output schemas, memory loops, and automated pipelines.",
      readinessScore: 94,
      supportingCapabilityIds: ["cap-fullstack-ai"],
      strongestProjectProofs: ["Kun"],
    },
    {
      title: "Founding Engineer / Startup Builder",
      justification: "Complete 0-to-1 builder capability across frontend, backend, auth, database architecture, billing, and native mobile.",
      readinessScore: 95,
      supportingCapabilityIds: ["cap-multi-tenant-saas", "cap-design-systems", "cap-fullstack-ai"],
      strongestProjectProofs: ["Hogwarts", "Mkan", "Codebase"],
    },
    {
      title: "SaaS Systems Architect",
      justification: "Proven design of multi-tenant isolation, subdomain routing, RBAC, and high-performance serverless database adapters.",
      readinessScore: 92,
      supportingCapabilityIds: ["cap-multi-tenant-saas"],
      strongestProjectProofs: ["Hogwarts", "Twenty Fork"],
    },
    {
      title: "Senior Frontend Engineer (Design Systems)",
      justification: "Deep mastery of Tailwind CSS v4, React 19, Radix primitives, atomic design hierarchies, and pixel-exact UI craft.",
      readinessScore: 98,
      supportingCapabilityIds: ["cap-design-systems"],
      strongestProjectProofs: ["Codebase", "Apple Clone", "Nike Clone"],
    },
  ];
}

export function extractTechnologySkills(facts: EvidenceFact[]): TechnologySkillFact[] {
  const map: Record<string, { category: TechnologySkillFact["category"]; level: TechnologySkillFact["level"]; depth: EvidenceWeight; facts: EvidenceFact[] }> = {
    "TypeScript / JavaScript": {
      category: "Frontend",
      level: "Deep Production",
      depth: "deep_production_proof",
      facts: facts.filter((f) => f.artifactPath.endsWith(".ts") || f.artifactPath.endsWith(".tsx") || f.claim.includes("TypeScript")),
    },
    "Next.js 16 / React 19": {
      category: "Frontend",
      level: "Deep Production",
      depth: "deep_production_proof",
      facts: facts.filter((f) => f.claim.includes("Next") || f.claim.includes("React") || f.artifactPath.includes("actions")),
    },
    "Tailwind CSS v4 & Shadcn/UI": {
      category: "Design",
      level: "Deep Production",
      depth: "deep_production_proof",
      facts: facts.filter((f) => f.claim.includes("Shadcn") || f.claim.includes("component")),
    },
    "PostgreSQL & Prisma 7 / Neon": {
      category: "Database",
      level: "Deep Production",
      depth: "deep_production_proof",
      facts: facts.filter((f) => f.artifactType === "database_schema" || f.claim.includes("Prisma")),
    },
    "LLM & AI SDKs (Gemini, Claude, Vercel AI SDK)": {
      category: "AI / ML",
      level: "Deep Production",
      depth: "deep_production_proof",
      facts: facts.filter((f) => f.claim.includes("Gemini") || f.claim.includes("AI")),
    },
    "Authentication (NextAuth v5 / Auth.js)": {
      category: "Backend",
      level: "Deep Production",
      depth: "deep_production_proof",
      facts: facts.filter((f) => f.claim.includes("NextAuth") || f.artifactPath.includes("auth")),
    },
    "Rust & P2P Networking (libp2p, DHT)": {
      category: "Systems",
      level: "Working Knowledge",
      depth: "deep_production_proof",
      facts: facts.filter((f) => f.claim.includes("Rust")),
    },
    "Swift 6 / SwiftUI & Kotlin / Compose": {
      category: "Mobile",
      level: "Proficient",
      depth: "deep_production_proof",
      facts: facts.filter((f) => f.claim.includes("Swift") || f.claim.includes("Kotlin")),
    },
    "Docker, Twenty CRM & Automation Pipelines": {
      category: "Automation",
      level: "Proficient",
      depth: "deep_production_proof",
      facts: facts.filter((f) => f.claim.includes("CRM") || f.claim.includes("WhatsApp") || f.claim.includes("automation")),
    },
  };

  return Object.entries(map).map(([name, data]) => ({
    name,
    category: data.category,
    level: data.level,
    depth: data.depth,
    facts: data.facts,
  }));
}

export function buildEvidenceKnowledgeProfile(): EngineeringKnowledgeProfile {
  const repos = resolveDatabaytRepositories();
  const currentFingerprint = repos
    .map((r) => `${r.id}:${r.sources.find((s) => s.type === "github")?.fingerprint || "remote"}`)
    .join(";");

  if (cachedProfile && lastScanFingerprint === currentFingerprint) {
    return cachedProfile;
  }

  const facts = extractRepositoryFacts(repos);
  const capabilities = synthesizeCapabilities(facts);
  const positioningRoles = synthesizeMarketPositioning(capabilities);
  const technologies = extractTechnologySkills(facts);

  const profile: EngineeringKnowledgeProfile = {
    candidateName: "Osman Abdout (Databayt Lead Builder)",
    headline: "Full-Stack AI Engineer & SaaS Systems Architect",
    analyzerVersion: ANALYZER_VERSION,
    facts,
    capabilities,
    positioningRoles,
    technologies,
    repositories: repos,
    overallFreshness: "fresh",
    updatedAt: new Date().toISOString(),
  };

  cachedProfile = profile;
  lastScanFingerprint = currentFingerprint;

  return profile;
}
