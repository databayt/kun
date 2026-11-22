import { db } from "@/lib/db";
import { authenticate, isResponse, json, readBody } from "@/lib/machine/auth";
import { claimSchema } from "@/lib/machine/contract";
import type { ClaimResponse } from "@/lib/machine/contract";
import { addLabels, comment, holdings, readTask, removeLabels } from "@/lib/machine/github";
import { claimRefusal, parseLabels, splitId } from "@/lib/machine/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const refuse = (error: "held" | "wip" | "blocked" | "not-found" | "department" | "doctor", detail?: string) =>
  json({ ok: false, error, detail } satisfies ClaimResponse, 409);

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (isResponse(auth)) return auth;
  const body = await readBody(request, claimSchema);
  if (isResponse(body)) return body;
  const p = splitId(body.id)!;
  try {
    // Re-read: the client's copy may be stale.
    const read = await readTask(body.id);
    if (!read) return refuse("not-found");
    const held = await holdings(auth.login);
    const me = await db.machine.findUnique({ where: { id: auth.machineId }, select: { readiness: true } });
    const refusal = claimRefusal({
      task: read.task,
      login: auth.login,
      departments: auth.profile.departments,
      inProgress: held.inProgress.filter((t) => t.id !== body.id).length,
      wipLimit: held.wipLimit,
      readiness: me?.readiness,
    });
    if (refusal) return refuse(refusal.error, refusal.detail);

    await addLabels(p.repo, p.number, [`holder:${auth.login}`, "status:in-progress"]);
    // GitHub has no compare-and-swap: re-read and back out if someone else got there first.
    const after = await readTask(body.id);
    const others = (after?.labels ?? []).filter(
      (l) => l.startsWith("holder:") && l !== `holder:${auth.login}`,
    );
    if (others.length > 0) {
      await removeLabels(p.repo, p.number, [`holder:${auth.login}`]);
      return refuse("held", `held by ${parseLabels(others).holder}`);
    }
    await comment(p.repo, p.number, `started on ${auth.login}'s machine`);
    const final = (await readTask(body.id)) ?? read;
    return json({ ok: true, task: final.task } satisfies ClaimResponse);
  } catch {
    return json({ error: "upstream" }, 502);
  }
}
