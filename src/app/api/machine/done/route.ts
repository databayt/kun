import { authenticate, isResponse, json, readBody } from "@/lib/machine/auth";
import { doneSchema } from "@/lib/machine/contract";
import type { ClaimResponse } from "@/lib/machine/contract";
import { addLabels, comment, readTask, removeLabels } from "@/lib/machine/github";
import { splitId } from "@/lib/machine/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Done = status:review + the summary. Only the CEO closes the issue.
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (isResponse(auth)) return auth;
  const body = await readBody(request, doneSchema);
  if (isResponse(body)) return body;
  const p = splitId(body.id)!;
  try {
    const read = await readTask(body.id);
    if (!read) return json({ ok: false, error: "not-found" } satisfies ClaimResponse, 409);
    if (read.task.holder !== auth.login)
      return json({ ok: false, error: "held", detail: "you do not hold it" } satisfies ClaimResponse, 409);
    await removeLabels(p.repo, p.number, ["status:in-progress"]);
    await addLabels(p.repo, p.number, ["status:review"]);
    await comment(p.repo, p.number, `Done on ${auth.login}'s machine — ready for review.\n\n${body.summary}`);
    return json({ ok: true, task: (await readTask(body.id))?.task ?? read.task } satisfies ClaimResponse);
  } catch {
    return json({ error: "upstream" }, 502);
  }
}
