import { authenticate, isResponse, json, readBody } from "@/lib/machine/auth";
import { claimSchema } from "@/lib/machine/contract";
import type { ClaimResponse } from "@/lib/machine/contract";
import { comment, readTask, removeLabels } from "@/lib/machine/github";
import { splitId } from "@/lib/machine/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (isResponse(auth)) return auth;
  const body = await readBody(request, claimSchema);
  if (isResponse(body)) return body;
  const p = splitId(body.id)!;
  try {
    const read = await readTask(body.id);
    if (!read) return json({ ok: false, error: "not-found" } satisfies ClaimResponse, 409);
    if (read.task.holder !== auth.login)
      return json({ ok: false, error: "held", detail: "you do not hold it" } satisfies ClaimResponse, 409);
    await removeLabels(p.repo, p.number, [`holder:${auth.login}`, "status:in-progress"]);
    await comment(p.repo, p.number, `released by ${auth.login}`);
    return json({ ok: true, task: (await readTask(body.id))?.task ?? read.task } satisfies ClaimResponse);
  } catch {
    return json({ error: "upstream" }, 502);
  }
}
