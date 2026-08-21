import { execSync } from "node:child_process";
import fs from "node:fs";

export interface GitHubRepoItem {
  name: string;
  description: string | null;
  url: string;
  defaultBranchRef?: { name: string } | null;
  isPrivate: boolean;
  primaryLanguage?: { name: string } | null;
  repositoryTopics?: Array<{ name: string }> | null;
  pushedAt?: string;
}

let cachedOrgRepos: GitHubRepoItem[] | null = null;
let lastOrgFetchTime = 0;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

const fileContentCache = new Map<string, { content: string | null; fetchedAt: number }>();

export function getGitHubToken(): string | null {
  if (process.env.GITHUB_TOKEN?.trim()) {
    return process.env.GITHUB_TOKEN.trim();
  }
  if (process.env.GH_TOKEN?.trim()) {
    return process.env.GH_TOKEN.trim();
  }

  try {
    const token = execSync("gh auth token 2>/dev/null", { encoding: "utf-8", timeout: 1500 }).trim();
    if (token) return token;
  } catch {
    // ignore
  }

  return null;
}

export function fetchDatabaytOrgRepos(): GitHubRepoItem[] {
  const now = Date.now();
  if (cachedOrgRepos && now - lastOrgFetchTime < CACHE_TTL_MS) {
    return cachedOrgRepos;
  }

  // 1. Try gh CLI directly (Fastest and authenticates through keyring)
  try {
    const raw = execSync(
      "gh repo list databayt --limit 50 --json name,description,url,defaultBranchRef,isPrivate,primaryLanguage,repositoryTopics,pushedAt 2>/dev/null",
      { encoding: "utf-8", timeout: 3000 }
    );
    if (raw?.trim()) {
      const repos = JSON.parse(raw) as GitHubRepoItem[];
      if (Array.isArray(repos) && repos.length > 0) {
        cachedOrgRepos = repos;
        lastOrgFetchTime = now;
        return repos;
      }
    }
  } catch {
    // Fall back to memory file or curl
  }

  // 2. Fallback to memory file if offline or rate limited
  const memoryFile = "/Users/abdout/kun/.claude/memory/repositories.json";
  if (fs.existsSync(memoryFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(memoryFile, "utf-8"));
      const all = [
        ...(parsed.repositories?.core ?? []),
        ...(parsed.repositories?.products ?? []),
        ...(parsed.repositories?.specialized ?? []),
      ];
      const items: GitHubRepoItem[] = all.map((r) => ({
        name: String(r.id),
        description: String(r.name || ""),
        url: `https://github.com/databayt/${r.id}`,
        defaultBranchRef: { name: "main" },
        isPrivate: false,
        primaryLanguage: { name: "TypeScript" },
        repositoryTopics: null,
      }));
      cachedOrgRepos = items;
      lastOrgFetchTime = now;
      return items;
    } catch {
      // ignore
    }
  }

  return [];
}

export function fetchGitHubFileContent(
  repoName: string,
  filePath: string,
  branch = "main"
): string | null {
  const cacheKey = `${repoName}:${branch}:${filePath}`;
  const now = Date.now();
  const cached = fileContentCache.get(cacheKey);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.content;
  }

  // Fast fetch via curl with token and short timeout
  const token = getGitHubToken();
  const authHeader = token ? `-H "Authorization: Bearer ${token}"` : "";

  try {
    const res = execSync(
      `curl -s --max-time 1.5 ${authHeader} "https://raw.githubusercontent.com/databayt/${repoName}/${branch}/${filePath}" 2>/dev/null`,
      { encoding: "utf-8", timeout: 2000 }
    );
    if (res && !res.includes("404: Not Found") && res.length > 0) {
      fileContentCache.set(cacheKey, { content: res, fetchedAt: now });
      return res;
    }
  } catch {
    // ignore
  }

  fileContentCache.set(cacheKey, { content: null, fetchedAt: now });
  return null;
}
