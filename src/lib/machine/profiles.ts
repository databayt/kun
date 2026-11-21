// Profile lookups over the generated JSON (Cloudflare has no fs). Regenerate with
// `pnpm exec tsx scripts/machine-profiles.mts` after editing machines/*.json or departments/*/pack.json.
import { DEPARTMENTS } from "./contract";
import type { Department } from "./contract";
import { DEPARTMENT_PACKS, MACHINE_PROFILES } from "./profiles.generated";

export interface Profile {
  login: string;
  name: string;
  os: string;
  /** The default department, set by the registry; one of `departments`. */
  department: Department | null;
  departments: Department[];
  repos: string[];
  catalog: string;
}

const isDept = (d: string): d is Department => (DEPARTMENTS as readonly string[]).includes(d);

/** The registry's `department` when it is one of the authorized list, else the first of them. */
function defaultDepartment(d: string | null, list: Department[]): Department | null {
  return d && isDept(d) && list.includes(d) ? d : (list[0] ?? null);
}

export function allProfiles(): Profile[] {
  return MACHINE_PROFILES.map((p) => ({
    login: p.login,
    name: p.name,
    os: p.os,
    department: defaultDepartment(p.department, [...p.departments].filter(isDept)),
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
