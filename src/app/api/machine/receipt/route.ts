import { authenticate, isResponse, json, readBody } from "@/lib/machine/auth";
import { receiptSchema } from "@/lib/machine/contract";
import type { ClaimResponse } from "@/lib/machine/contract";
import { addLabels, comment, readTask, removeLabels } from "@/lib/machine/github";
import { formatReceipt, receiptRefusal, splitId } from "@/lib/machine/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// No pull requests: review = status:review + one run-receipt comment. Only the holder posts it;
// only the CEO closes the issue.
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (isResponse(auth)) return auth;
  const body = await readBody(request, receiptSchema);
  if (isResponse(body)) return body;
  const p = splitId(body.id)!;
  try {
    const read = await readTask(body.id);
    const refusal = receiptRefusal(read?.task ?? null, auth.login);
    if (refusal) return json({ ok: false, ...refusal } satisfies ClaimResponse, 409);
    // Comment first: if it fails nothing has changed.
    await comment(p.repo, p.number, formatReceipt(body, auth.login));
    await removeLabels(p.repo, p.number, ["status:in-progress"]);
    await addLabels(p.repo, p.number, ["status:review"]);
    return json({ ok: true, task: (await readTask(body.id))?.task ?? read!.task } satisfies ClaimResponse);
  } catch {
    return json({ error: "upstream" }, 502);
  }
}
