import { authenticate, isResponse, json } from "@/lib/machine/auth";
import type { OrgRepo, ReposResponse } from "@/lib/machine/contract";
import { orgRepos } from "@/lib/machine/github";
import { allowedRepos, departmentsOfRepo } from "@/lib/machine/profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (isResponse(auth)) return auth;
  try {
    const allowed = allowedRepos(auth.profile); // null = the whole org (catalog: all)
    const repos: OrgRepo[] = (await orgRepos())
      .filter((r) => allowed === null || allowed.has(r.name))
      .map((r) => ({
        name: r.name,
        description: r.description,
        private: r.private,
        defaultBranch: r.default_branch,
        url: r.html_url,
        departments: departmentsOfRepo(r.name),
      }));
    return json({ repos } satisfies ReposResponse);
  } catch {
    return json({ error: "upstream" }, 502);
  }
}
