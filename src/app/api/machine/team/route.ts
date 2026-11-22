import { db } from "@/lib/db";
import { authenticate, isResponse, json } from "@/lib/machine/auth";
import { DEPARTMENTS, ONLINE_WINDOW_MS, resourcesSchema, shareSchema } from "@/lib/machine/contract";
import type { MachineStatus, TeamResponse } from "@/lib/machine/contract";
import { allProfiles } from "@/lib/machine/profiles";
import { healthOk } from "@/lib/machine/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (isResponse(auth)) return auth;
  const dept = new URL(request.url).searchParams.get("department");
  if (dept && !(DEPARTMENTS as readonly string[]).includes(dept))
    return json({ error: "bad_department" }, 400);
  const rows = await db.machine.findMany({
    select: { login: true, os: true, lastSeenAt: true, health: true, currentTask: true, resources: true, share: true },
  });
  const byLogin = new Map(rows.map((r) => [r.login, r]));
  const machines: MachineStatus[] = allProfiles()
    .filter((p) => !dept || p.departments.includes(dept as never))
    .map((p) => {
      const r = byLogin.get(p.login);
      const resources = resourcesSchema.safeParse(r?.resources);
      const share = shareSchema.safeParse(r?.share);
      return {
        login: p.login,
        name: p.name,
        os: r?.os || p.os,
        departments: p.departments,
        lastSeenAt: r?.lastSeenAt?.toISOString() ?? null,
        healthOk: healthOk(r?.health),
        currentTask: r?.currentTask ?? null,
        resources: (resources.success ? resources.data : null) ?? null,
        share: (share.success ? share.data : null) ?? null,
        online: !!r?.lastSeenAt && Date.now() - r.lastSeenAt.getTime() < ONLINE_WINDOW_MS,
      };
    });
  return json({ machines } satisfies TeamResponse);
}
