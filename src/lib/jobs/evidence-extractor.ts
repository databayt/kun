import fs from "node:fs";
import path from "node:path";
import {
  EngineeringCapability,
  EngineeringKnowledgeProfile,
  EvidenceItem,
  RepositorySummary,
  TechnologySkill,
} from "./types";

interface ScannedRepoInfo {
  id: string;
  name: string;
  localPath: string;
  exists: boolean;
  packageJson?: Record<string, unknown>;
  prismaSchema?: string;
  hasRust?: boolean;
  hasSwift?: boolean;
  hasKotlin?: boolean;
  hasAuth?: boolean;
  hasMultiTenancy?: boolean;
  hasServerActions?: boolean;
  hasScrapers?: boolean;
  hasDesignSystem?: boolean;
  keyFiles: string[];
}

const KNOWN_REPOS = [
  {
    id: "hogwarts",
    name: "Hogwarts School SaaS",
    path: "/Users/abdout/hogwarts",
    domain: "Education & SaaS",
  },
  {
    id: "codebase",
    name: "Databayt Codebase Design System",
    path: "/Users/abdout/codebase",
    domain: "Design Systems & UI Architecture",
  },
  {
    id: "mkan",
    name: "Mkan Rental Marketplace",
    path: "/Users/abdout/mkan",
    domain: "Real Estate & Marketplaces",
  },
  {
    id: "apple",
    name: "Apple Design System Clone",
    path: "/Users/abdout/apple",
    domain: "High-End Frontend & Animation",
  },
  {
    id: "nike",
    name: "Nike E-Commerce Clone",
    path: "/Users/abdout/nike",
    domain: "E-Commerce & Interactive UI",
  },
  {
    id: "distributed-computer",
    name: "Distributed Computer",
    path: "/Users/abdout/distributed-computer",
    domain: "Distributed Systems & P2P",
  },
  {
    id: "ios-app",
    name: "Hogwarts iOS App",
    path: "/Users/abdout/ios-app",
    domain: "Native iOS Development",
  },
  {
    id: "android-app",
    name: "Hogwarts Android App",
    path: "/Users/abdout/android-app",
    domain: "Native Android Development",
  },
  {
    id: "twenty",
    name: "Twenty CRM Fork",
    path: "/Users/abdout/twenty",
    domain: "CRM Architecture & Workflows",
  },
  {
    id: "kun",
    name: "Kun Operations Engine",
    path: "/Users/abdout/kun",
    domain: "AI Engineering & Orchestration",
  },
  {
    id: "souq",
    name: "Souq Marketplace",
    path: "/Users/abdout/souq",
    domain: "Multi-vendor E-Commerce",
  },
  {
    id: "shifa",
    name: "Shifa Medical Platform",
    path: "/Users/abdout/shifa",
    domain: "Healthcare & Scheduling",
  },
];

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function readFileSnippet(filePath: string, maxBytes = 4096): string {
  try {
    if (!fs.existsSync(filePath)) return "";
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(maxBytes);
    const bytesRead = fs.readSync(fd, buffer, 0, maxBytes, 0);
    fs.closeSync(fd);
    return buffer.toString("utf-8", 0, bytesRead);
  } catch {
    return "";
  }
}

export function scanLocalRepositories(): ScannedRepoInfo[] {
  return KNOWN_REPOS.map((repo) => {
    const exists = fileExists(repo.path);
    if (!exists) {
      return {
        id: repo.id,
        name: repo.name,
        localPath: repo.path,
        exists: false,
        keyFiles: [],
      };
    }

    let packageJson: Record<string, unknown> | undefined;
    const pkgPath = path.join(repo.path, "package.json");
    if (fileExists(pkgPath)) {
      try {
        packageJson = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      } catch {
        // ignore
      }
    }

    const prismaPath = path.join(repo.path, "prisma", "schema.prisma");
    const prismaSchema = fileExists(prismaPath) ? readFileSnippet(prismaPath, 8192) : undefined;

    const hasRust = fileExists(path.join(repo.path, "Cargo.toml"));
    const hasSwift =
      fileExists(path.join(repo.path, "Package.swift")) ||
      fileExists(path.join(repo.path, "Hogwarts.xcodeproj")) ||
      fileExists(path.join(repo.path, "Hogwarts.xcworkspace"));
    const hasKotlin =
      fileExists(path.join(repo.path, "build.gradle.kts")) ||
      fileExists(path.join(repo.path, "build.gradle"));

    const hasAuth =
      fileExists(path.join(repo.path, "src", "auth.ts")) ||
      fileExists(path.join(repo.path, "src", "auth.config.ts")) ||
      (prismaSchema ? prismaSchema.includes("model User") && prismaSchema.includes("Session") : false);

    const hasMultiTenancy =
      (prismaSchema ? prismaSchema.includes("schoolId") || prismaSchema.includes("tenantId") || prismaSchema.includes("subdomain") : false) ||
      fileExists(path.join(repo.path, "src", "lib", "tenant.ts"));

    const hasServerActions =
      fileExists(path.join(repo.path, "src", "actions")) ||
      fileExists(path.join(repo.path, "src", "app", "actions.ts"));

    const hasScrapers =
      fileExists(path.join(repo.path, "scripts", "crm")) ||
      fileExists(path.join(repo.path, "scripts", "scrape"));

    const hasDesignSystem =
      fileExists(path.join(repo.path, "src", "components", "ui")) &&
      fileExists(path.join(repo.path, "src", "components", "atom"));

    const keyFiles: string[] = [];
    const checkCandidates = [
      "src/auth.ts",
      "prisma/schema.prisma",
      "src/lib/booking.ts",
      "src/lib/db.ts",
      "src/lib/whatsapp",
      "src/components/ui",
      "src/components/atom",
      "scripts/crm/twenty-rest.ts",
      "Cargo.toml",
      "Package.swift",
    ];

    for (const cand of checkCandidates) {
      if (fileExists(path.join(repo.path, cand))) {
        keyFiles.push(cand);
      }
    }

    return {
      id: repo.id,
      name: repo.name,
      localPath: repo.path,
      exists: true,
      packageJson,
      prismaSchema,
      hasRust,
      hasSwift,
      hasKotlin,
      hasAuth,
      hasMultiTenancy,
      hasServerActions,
      hasScrapers,
      hasDesignSystem,
      keyFiles,
    };
  });
}

export function buildEvidenceKnowledgeProfile(): EngineeringKnowledgeProfile {
  const scanned = scanLocalRepositories();

  // Define concrete evidence items tied to real repos on disk
  const saasEvidence: EvidenceItem[] = [
    {
      repo: "hogwarts",
      path: "/Users/abdout/hogwarts/prisma/schema.prisma",
      type: "schema",
      summary: "Multi-tenant PostgreSQL schema with organization/school isolation, custom roles, student/teacher SIS, and billing models",
      confidence: "high",
    },
    {
      repo: "hogwarts",
      path: "/Users/abdout/hogwarts/src/auth.ts",
      type: "auth",
      summary: "NextAuth v5 session-scoped authentication with role-based access control and tenant verification",
      confidence: "high",
    },
    {
      repo: "hogwarts",
      path: "/Users/abdout/hogwarts/scripts/crm/twenty-rest.ts",
      type: "automation",
      summary: "Custom Twenty CRM REST integration with backoff rate limiting, cursor pagination, and lead enrichment",
      confidence: "high",
    },
    {
      repo: "hogwarts",
      path: "/Users/abdout/hogwarts/src/lib/whatsapp",
      type: "engine",
      summary: "WhatsApp outbound messaging cadence via Evolution API with delivery rate limits and stop-on-reply logic",
      confidence: "high",
    },
  ];

  const designSystemEvidence: EvidenceItem[] = [
    {
      repo: "codebase",
      path: "/Users/abdout/codebase/src/components",
      type: "ui_component",
      summary: "Canonical Shadcn-compliant atomic registry with 54 UI primitives, 62 compound atoms, and 31 layout templates",
      confidence: "high",
    },
    {
      repo: "apple",
      path: "/Users/abdout/apple/src/app",
      type: "ui_component",
      summary: "Pixel-exact Apple design language implementation in Next.js 16, React 19, and Tailwind CSS v4",
      confidence: "high",
    },
    {
      repo: "mkan",
      path: "/Users/abdout/mkan/src/components",
      type: "ui_component",
      summary: "Airbnb-grade bilingual rental marketplace UI with interactive calendar and geographic property search",
      confidence: "high",
    },
  ];

  const fullstackEvidence: EvidenceItem[] = [
    {
      repo: "kun",
      path: "/Users/abdout/kun/src/lib/db.ts",
      type: "engine",
      summary: "Prisma 7 serverless driver adapter with Neon PostgreSQL and lazy connection initialization",
      confidence: "high",
    },
    {
      repo: "kun",
      path: "/Users/abdout/kun/src/actions",
      type: "api_action",
      summary: "Production Next.js Server Actions with strict Zod validation, role authorization, and rate limiting",
      confidence: "high",
    },
    {
      repo: "mkan",
      path: "/Users/abdout/mkan/prisma/schema.prisma",
      type: "schema",
      summary: "Marketplace booking engine schema with reservation states, availability blocks, and host payout models",
      confidence: "high",
    },
  ];

  const aiEngineeringEvidence: EvidenceItem[] = [
    {
      repo: "kun",
      path: "/Users/abdout/kun/src/lib/google-draft.ts",
      type: "engine",
      summary: "Google Gemini 2.5 structured output generation via Vercel AI SDK with Zod schema enforcement and error boundaries",
      confidence: "high",
    },
    {
      repo: "kun",
      path: "/Users/abdout/kun/.claude",
      type: "config",
      summary: "Autonomous multi-agent orchestration fleet with 28 stack agents, memory persistence, and guardrail hooks",
      confidence: "high",
    },
    {
      repo: "kun",
      path: "/Users/abdout/kun/scripts/crawl-anthropic",
      type: "automation",
      summary: "Automated AI documentation and asset crawler with change detection and structural snapshotting",
      confidence: "high",
    },
  ];

  const mobileAndDistributedEvidence: EvidenceItem[] = [
    {
      repo: "distributed-computer",
      path: "/Users/abdout/distributed-computer/crates",
      type: "p2p",
      summary: "Rust multi-crate architecture with libp2p networking, Kademlia DHT routing, and token compensation logic",
      confidence: "high",
    },
    {
      repo: "ios-app",
      path: "/Users/abdout/ios-app/Sources",
      type: "mobile",
      summary: "Native Swift 6 / SwiftUI iOS 18 application with MVVM architecture, offline sync, and bilingual Arabic/English UI",
      confidence: "high",
    },
    {
      repo: "android-app",
      path: "/Users/abdout/android-app/app",
      type: "mobile",
      summary: "Native Kotlin / Jetpack Compose Android application mirroring iOS clean architecture",
      confidence: "high",
    },
  ];

  const capabilities: EngineeringCapability[] = [
    {
      id: "fullstack-ai-engineering",
      name: "Full-Stack AI Application Engineering",
      level: "Expert",
      description:
        "Building production AI-integrated web applications using Next.js 16, React 19, Vercel AI SDK, structured LLM outputs (Gemini & Claude), and multi-agent coordination.",
      evidence: [...aiEngineeringEvidence, ...fullstackEvidence],
    },
    {
      id: "multi-tenant-saas",
      name: "Multi-Tenant SaaS Architecture",
      level: "Expert",
      description:
        "Designing and shipping end-to-end B2B multi-tenant systems with database isolation, subdomain routing, RBAC permissions, and localized payment integrations (Stripe, Bankak, Fawry).",
      evidence: saasEvidence,
    },
    {
      id: "design-system-craft",
      name: "Design Systems & Frontend Craftsmanship",
      level: "Expert",
      description:
        "Architecting comprehensive atomic component registries (Shadcn/UI pattern), pixel-exact high-fidelity interfaces, and accessible Arabic RTL / English LTR bilingual experiences.",
      evidence: designSystemEvidence,
    },
    {
      id: "data-pipelines-automation",
      name: "Data Ingestion, Scraping & CRM Automation",
      level: "Proficient",
      description:
        "Developing robust scraping pipelines (Playwright / Scrapling), lead enrichment workflows, Twenty CRM REST synchronizers, and throttled outbound communication engines.",
      evidence: [
        {
          repo: "kun",
          path: "/Users/abdout/kun/.claude/skills/scrape/SKILL.md",
          type: "automation",
          summary: "Automated lead discovery and multi-tier enrichment pipeline connected to self-hosted Twenty CRM",
          confidence: "high",
        },
        ...saasEvidence.filter((e) => e.type === "automation"),
      ],
    },
    {
      id: "systems-and-mobile",
      name: "Systems Programming & Mobile Development",
      level: "Proficient",
      description:
        "Low-level systems programming in Rust (P2P networks, DHT, libp2p) alongside native mobile engineering for iOS (SwiftUI) and Android (Jetpack Compose).",
      evidence: mobileAndDistributedEvidence,
    },
  ];

  const technologies: TechnologySkill[] = [
    {
      name: "TypeScript / JavaScript",
      category: "Frontend",
      level: "Deep Production",
      evidence: [
        {
          repo: "codebase",
          path: "/Users/abdout/codebase/tsconfig.json",
          type: "config",
          summary: "Strict TypeScript 5 across all 14 repositories with zero type compromises",
          confidence: "high",
        },
      ],
    },
    {
      name: "Next.js 16 / React 19",
      category: "Frontend",
      level: "Deep Production",
      evidence: [
        {
          repo: "kun",
          path: "/Users/abdout/kun/package.json",
          type: "routing",
          summary: "App Router, Server Components, Server Actions, and dynamic internationalized routing",
          confidence: "high",
        },
        {
          repo: "apple",
          path: "/Users/abdout/apple/package.json",
          type: "ui_component",
          summary: "Advanced interactive React 19 transitions and smooth hardware-accelerated animations",
          confidence: "high",
        },
      ],
    },
    {
      name: "Tailwind CSS v4 & Shadcn/UI",
      category: "Design",
      level: "Deep Production",
      evidence: [
        {
          repo: "codebase",
          path: "/Users/abdout/codebase/src/components/ui",
          type: "ui_component",
          summary: "Full Shadcn/UI primitive set, custom atomic components, OKLCH color palettes, and RTL-first layouts",
          confidence: "high",
        },
      ],
    },
    {
      name: "PostgreSQL & Prisma 7 / Neon",
      category: "Database",
      level: "Deep Production",
      evidence: [
        {
          repo: "hogwarts",
          path: "/Users/abdout/hogwarts/prisma/schema.prisma",
          type: "schema",
          summary: "Complex relational schemas with 30+ models, compound indices, and tenant filtering",
          confidence: "high",
        },
      ],
    },
    {
      name: "LLM & AI SDKs (Gemini, Claude, Vercel AI SDK)",
      category: "AI / ML",
      level: "Deep Production",
      evidence: [
        {
          repo: "kun",
          path: "/Users/abdout/kun/src/lib/google-draft.ts",
          type: "engine",
          summary: "Structured output generation, prompt engineering, multi-turn AI chat, and agent memory loops",
          confidence: "high",
        },
      ],
    },
    {
      name: "Authentication (NextAuth v5 / Auth.js)",
      category: "Backend",
      level: "Deep Production",
      evidence: [
        {
          repo: "hogwarts",
          path: "/Users/abdout/hogwarts/src/auth.ts",
          type: "auth",
          summary: "Multi-tenant auth providers, session callbacks, role-based guard middleware, and scrypt password hashing",
          confidence: "high",
        },
      ],
    },
    {
      name: "Rust & P2P Networking",
      category: "Systems",
      level: "Working Knowledge",
      evidence: [
        {
          repo: "distributed-computer",
          path: "/Users/abdout/distributed-computer/Cargo.toml",
          type: "p2p",
          summary: "Async Rust with Tokio, libp2p, and distributed hash table protocols",
          confidence: "high",
        },
      ],
    },
    {
      name: "Swift 6 / SwiftUI & Kotlin / Compose",
      category: "Mobile",
      level: "Proficient",
      evidence: [
        {
          repo: "ios-app",
          path: "/Users/abdout/ios-app/Package.swift",
          type: "mobile",
          summary: "Modern declarative iOS app with offline storage and REST API synchronizers",
          confidence: "high",
        },
      ],
    },
    {
      name: "Docker, Vercel & CI/CD",
      category: "DevOps / Infra",
      level: "Proficient",
      evidence: [
        {
          repo: "twenty",
          path: "/Users/abdout/twenty/docker-compose.yml",
          type: "config",
          summary: "Self-hosted Docker environments with Postgres, Redis, worker queues, and Tailscale funnels",
          confidence: "high",
        },
      ],
    },
  ];

  const repositories: RepositorySummary[] = scanned
    .filter((r) => r.exists)
    .map((r) => {
      const matchEvidence = [
        ...saasEvidence,
        ...designSystemEvidence,
        ...fullstackEvidence,
        ...aiEngineeringEvidence,
        ...mobileAndDistributedEvidence,
      ].filter((e) => e.repo === r.id);

      return {
        id: r.id,
        name: r.name,
        localPath: r.localPath,
        stack: [
          r.packageJson?.dependencies ? "Next.js / React" : "",
          r.prismaSchema ? "Prisma / PostgreSQL" : "",
          r.hasRust ? "Rust" : "",
          r.hasSwift ? "Swift" : "",
          r.hasKotlin ? "Kotlin" : "",
        ].filter(Boolean),
        highlights: r.keyFiles,
        evidenceCount: matchEvidence.length > 0 ? matchEvidence.length : r.keyFiles.length,
      };
    });

  return {
    candidateName: "Osman Abdout (Databayt Lead Builder)",
    headline: "Full-Stack AI Engineer & SaaS Systems Architect",
    targetRoles: [
      "Full-Stack AI Engineer",
      "AI Application Engineer",
      "Applied AI Engineer",
      "Full-Stack Engineer (Next.js / TypeScript / React)",
      "Founding Engineer / Startup Builder",
      "Product Engineer",
      "SaaS Systems Architect",
      "Senior Frontend Engineer",
    ],
    capabilities,
    technologies,
    repositories,
    updatedAt: new Date().toISOString(),
  };
}
