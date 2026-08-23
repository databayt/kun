import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { fetchDatabaytOrgRepos } from "./github-fetcher";
import { RepositoryIdentity, RepositorySource } from "./types";

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
  // 1. Discover all repositories dynamically from the single source of truth: github.com/databayt
  const orgRepos = fetchDatabaytOrgRepos();

  return orgRepos.map((ghRepo) => {
    const repoId = ghRepo.name.toLowerCase();
    const defaultBranch = ghRepo.defaultBranchRef?.name || "main";

    // Candidate local clone directories. Local clones are an OPTIONAL Level 3
    // enrichment — every repo already has its canonical GitHub source above, so
    // a machine with no clones (CI, a teammate's laptop) still resolves a full
    // identity. Rooted at the current user's home rather than a hardcoded one;
    // DATABAYT_REPOS_DIR overrides it.
    const cloneRoot = process.env.DATABAYT_REPOS_DIR?.trim() || os.homedir();
    const candidateLocalPaths = [
      path.join(cloneRoot, repoId),
      path.join(cloneRoot, "oss", repoId),
    ];

    const existingLocalPath = candidateLocalPaths.find((p) => fs.existsSync(p));

    const sources: RepositorySource[] = [];

    // 1. GitHub Remote Source (Canonical Single Source of Truth)
    sources.push({
      type: "github",
      location: ghRepo.url || `https://github.com/databayt/${ghRepo.name}`,
      isAvailable: true,
      lastCheckedAt: new Date().toISOString(),
      fingerprint: ghRepo.pushedAt,
    });

    // 2. Local Filesystem Source (Available for Level 3 AST Enrichment)
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

    // Infer domain from description / topics / name
    const topics = (ghRepo.repositoryTopics || []).map((t) => t.name.toLowerCase());
    let domain = "Product Engineering & SaaS";
    if (topics.includes("education") || repoId.includes("hogwarts")) domain = "Education & Multi-tenant SaaS";
    else if (topics.includes("crm") || repoId.includes("crm") || repoId.includes("twenty")) domain = "CRM & Workflow Systems";
    else if (topics.includes("rust") || repoId.includes("distributed-computer")) domain = "Distributed Systems & P2P Protocols";
    else if (repoId.includes("ios") || repoId.includes("android")) domain = "Native Mobile Engineering";
    else if (repoId.includes("codebase") || repoId.includes("radix") || repoId.includes("shadcn")) domain = "Design Systems & UI Registry";
    else if (repoId.includes("kun")) domain = "AI Engineering & Operations OS";
    else if (repoId.includes("mkan")) domain = "Rental Marketplace";
    else if (repoId.includes("apple") || repoId.includes("nike")) domain = "Interactive UI Craft & Design";

    return {
      id: repoId,
      organization: "databayt",
      name: ghRepo.name,
      canonicalUrl: ghRepo.url || `https://github.com/databayt/${ghRepo.name}`,
      defaultBranch,
      visibility: ghRepo.isPrivate ? "private" : "public",
      description: ghRepo.description || `${ghRepo.name} repository under databayt organization`,
      primaryLanguage: ghRepo.primaryLanguage?.name || "TypeScript",
      domain,
      sources,
    };
  });
}
