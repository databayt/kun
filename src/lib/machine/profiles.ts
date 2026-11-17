// Profile lookups over the generated JSON (Cloudflare has no fs). Regenerate with
// `pnpm exec tsx scripts/machine-profiles.mts` after editing machines/*.json or departments/*/pack.json.
import { DEPARTMENTS } from "./contract";
import type { Department } from "./contract";
import { DEPARTMENT_PACKS, MACHINE_PROFILES } from "./profiles.generated";

export interface Profile {
  login: string;
  name: string;
  os: string;
  departments: Department[];
  repos: string[];
  catalog: string;
}

const isDept = (d: string): d is Department => (DEPARTMENTS as readonly string[]).includes(d);

export function allProfiles(): Profile[] {
  return MACHINE_PROFILES.map((p) => ({
    login: p.login,
    name: p.name,
    os: p.os,
    departments: [...p.departments].filter(isDept),
    repos: [...p.repos],
    catalog: p.catalog,
  }));
}

export function getProfile(login: string): Profile | null {
  return allProfiles().find((p) => p.login === login) ?? null;
}

/** Departments whose pack lists `repo` (packs without a repos list contribute nothing). */
export function departmentsOfRepo(repo: string): Department[] {
  return DEPARTMENT_PACKS.filter((p) => (p.repos as readonly string[]).includes(repo))
    .map((p) => p.name)
    .filter(isDept);
}

/** profile.repos ∪ repos of the profile's departments; `catalog: all` sees everything (null). */
export function allowedRepos(profile: Profile): Set<string> | null {
  if (profile.catalog === "all") return null;
  const set = new Set(profile.repos);
  for (const pack of DEPARTMENT_PACKS)
    if (profile.departments.includes(pack.name as Department))
      for (const r of pack.repos as readonly string[]) set.add(r);
  return set;
}
