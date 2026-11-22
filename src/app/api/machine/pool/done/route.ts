import { db } from "@/lib/db";
import { authenticate, isResponse, json, readBody } from "@/lib/machine/auth";
import { poolDoneSchema } from "@/lib/machine/contract";
import type { PoolDoneResponse } from "@/lib/machine/contract";
import { presignOutputs, tailLog } from "@/lib/machine/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The donor's run ended. ok=false: the job fails now. ok=true: the outputs are recorded and presigned
// PUT links come back; the donor uploads, then calls /pool/finish, which marks the job done.
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (isResponse(auth)) return auth;
  const body = await readBody(request, poolDoneSchema);
  if (isResponse(body)) return body;
  const mine = { id: body.id, donor: auth.login, status: "running" };
  if (!body.ok) {
    const r = await db.computeJob.updateMany({
      where: mine,
      data: { status: "failed", finishedAt: new Date(), log: tailLog(body.error ?? "failed") },
    });
    return json(r.count === 1 ? ({ ok: true, uploads: [] } satisfies PoolDoneResponse) : { ok: false, error: "not-yours" }, r.count === 1 ? 200 : 409);
  }
  if (body.outputs.length === 0) return json({ ok: false, error: "no-outputs" } satisfies PoolDoneResponse, 400);
  try {
    const signed = await presignOutputs(body.id, body.outputs);
    if (!signed) return json({ ok: false, error: "bad_file_name" } satisfies PoolDoneResponse, 400);
    const r = await db.computeJob.updateMany({
      where: mine,
      data: { outputs: signed.outputs as never, lastProgressAt: new Date(), progress: 1 },
    });
    if (r.count !== 1) return json({ ok: false, error: "not-yours" } satisfies PoolDoneResponse, 409);
    return json({ ok: true, uploads: signed.uploads } satisfies PoolDoneResponse);
  } catch {
    return json({ error: "upstream" }, 502);
  }
}
