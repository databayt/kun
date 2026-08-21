import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { RepositoryIdentity, RepositorySource } from "./types";

interface RepoRegistryJSON {
  repositories?: {
    core?: Array<Record<string, unknown>>;
    products?: Array<Record<string, unknown>>;
    specialized?: Array<Record<string, unknown>>;
  };
}

const CANONICAL_REPOS: Array<{
  id: string;
  name: string;
  domain: string;
  defaultLocalPath?: string;
  description: string;
  primaryLanguage: string;
}> = [
  {
    id: "hogwarts",
    name: "Hogwarts School SaaS",
    domain: "Education & SaaS",
    defaultLocalPath: "/Users/abdout/hogwarts",
    description: "Multi-tenant School Management SaaS with SIS, NextAuth v5, and WhatsApp integration",
    primaryLanguage: "TypeScript",
  },
  {
    id: "codebase",
    name: "Databayt Codebase Registry",
    domain: "Design Systems & UI Architecture",
    defaultLocalPath: "/Users/abdout/codebase",
    description: "Component library and atomic patterns source of truth (54 UI primitives, 62 atoms, 31 templates)",
    primaryLanguage: "TypeScript",
  },
  {
    id: "mkan",
    name: "Mkan Rental Marketplace",
    domain: "Marketplaces & Real Estate",
    defaultLocalPath: "/Users/abdout/mkan",
    description: "Airbnb-style property rental marketplace with interactive calendar and geographic search",
    primaryLanguage: "TypeScript",
  },
  {
    id: "apple",
    name: "Apple Design System Clone",
    domain: "High-End Frontend & Animation",
    defaultLocalPath: "/Users/abdout/apple",
    description: "Pixel-exact Apple design clone R&D in Next.js 16, React 19, and Tailwind CSS v4",
    primaryLanguage: "TypeScript",
  },
  {
    id: "nike",
    name: "Nike E-Commerce Clone",
    domain: "E-Commerce & Interactive UI",
    defaultLocalPath: "/Users/abdout/nike",
    description: "Interactive e-commerce product experience clone",
    primaryLanguage: "TypeScript",
  },
  {
    id: "distributed-computer",
    name: "Distributed Computer",
    domain: "Distributed Systems & P2P Protocols",
    defaultLocalPath: "/Users/abdout/distributed-computer",
    description: "Rust infrastructure for P2P networking with libp2p, Kademlia DHT, and token economics",
    primaryLanguage: "Rust",
  },
  {
    id: "ios-app",
    name: "Hogwarts iOS Companion",
    domain: "Native iOS Mobile",
    defaultLocalPath: "/Users/abdout/ios-app",
    description: "Native Swift 6 / SwiftUI application for iOS 18 with MVVM architecture and offline sync",
    primaryLanguage: "Swift",
  },
  {
    id: "android-app",
    name: "Hogwarts Android Companion",
    domain: "Native Android Mobile",
    defaultLocalPath: "/Users/abdout/android-app",
    description: "Native Kotlin / Jetpack Compose Android application mirroring iOS clean architecture",
    primaryLanguage: "Kotlin",
  },
  {
    id: "twenty",
    name: "Twenty CRM Fork",
    domain: "CRM Architecture & Workflows",
    defaultLocalPath: "/Users/abdout/twenty",
    description: "Self-hosted Twenty CRM fork with multi-workspace architecture and REST APIs",
    primaryLanguage: "TypeScript",
  },
  {
    id: "kun",
    name: "Kun Operations Engine",
    domain: "AI Engineering & Orchestration",
    defaultLocalPath: "/Users/abdout/kun",
    description: "Databayt engineering operating system, AI workflows, and job engine",
    primaryLanguage: "TypeScript",
  },
  {
    id: "souq",
    name: "Souq Marketplace",
    domain: "Multi-vendor E-Commerce",
    defaultLocalPath: "/Users/abdout/souq",
    description: "Multi-vendor e-commerce marketplace with Redux Toolkit and order management",
    primaryLanguage: "TypeScript",
  },
  {
    id: "shifa",
    name: "Shifa Medical Platform",
    domain: "Healthcare & Scheduling",
    defaultLocalPath: "/Users/abdout/shifa",
    description: "Healthcare clinic and appointment scheduling system",
    primaryLanguage: "TypeScript",
  },
];

function getRepoGitFingerprint(repoPath: string): string | undefined {
  try {
    if (fs.existsSync(path.join(repoPath, ".git"))) {
      const sha = execSync("git rev-parse --short HEAD 2>/dev/null", {
        cwd: repoPath,
        encoding: "utf-8",
      }).trim();
      if (sha) return sha;
    }
  } catch {
    // ignore
  }

  try {
    const stat = fs.statSync(repoPath);
    return `mtime-${Math.floor(stat.mtimeMs)}`;
  } catch {
    return undefined;
  }
}

export function resolveDatabaytRepositories(): RepositoryIdentity[] {
  let memoryRepos: Array<{ id: string; name?: string; local?: string; url?: string }> = [];
  const memoryFile = "/Users/abdout/kun/.claude/memory/repositories.json";

  if (fs.existsSync(memoryFile)) {
    try {
      const parsed: RepoRegistryJSON = JSON.parse(fs.readFileSync(memoryFile, "utf-8"));
      const all = [
        ...(parsed.repositories?.core ?? []),
        ...(parsed.repositories?.products ?? []),
        ...(parsed.repositories?.specialized ?? []),
      ];
      memoryRepos = all.map((r) => ({
        id: String(r.id || ""),
        name: String(r.name || ""),
        local: typeof r.local === "string" ? r.local : undefined,
        url: typeof r.url === "string" ? r.url : undefined,
      }));
    } catch {
      // ignore
    }
  }

  return CANONICAL_REPOS.map((item) => {
    const memMatch = memoryRepos.find((m) => m.id === item.id);
    const candidateLocalPaths = [
      item.defaultLocalPath,
      memMatch?.local,
      `/Users/abdout/${item.id}`,
      `/Users/abdout/oss/${item.id}`,
    ].filter((p): p is string => Boolean(p));

    const existingLocalPath = candidateLocalPaths.find((p) => fs.existsSync(p));

    const sources: RepositorySource[] = [];

    // 1. GitHub Remote Source (Always defined as canonical)
    sources.push({
      type: "github",
      location: memMatch?.url || `https://github.com/databayt/${item.id}`,
      isAvailable: true,
      lastCheckedAt: new Date().toISOString(),
    });

    // 2. Local Filesystem Source (If cloned locally)
    if (existingLocalPath) {
      const fingerprint = getRepoGitFingerprint(existingLocalPath);
      sources.push({
        type: "local",
        location: existingLocalPath,
        isAvailable: true,
        lastCheckedAt: new Date().toISOString(),
        fingerprint,
      });
    }

    return {
      id: item.id,
      organization: "databayt",
      name: item.name,
      canonicalUrl: `https://github.com/databayt/${item.id}`,
      defaultBranch: "main",
      visibility: "public",
      description: item.description,
      primaryLanguage: item.primaryLanguage,
      domain: item.domain,
      sources,
    };
  });
}
