import { db } from "@/lib/db";
import { authenticate, isResponse, json, readBody } from "@/lib/machine/auth";
import { poolProgressSchema } from "@/lib/machine/contract";
import type { PoolProgressResponse } from "@/lib/machine/contract";
import { recordProgress } from "@/lib/machine/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Only the donor of a running job. `cancelled: true` means the job is no longer yours: stop and clean up.
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (isResponse(auth)) return auth;
  const body = await readBody(request, poolProgressSchema);
  if (isResponse(body)) return body;
  const owned = await recordProgress(db.computeJob as never, body.id, auth.login, body.progress, body.log);
  return json({ ok: owned, cancelled: !owned } satisfies PoolProgressResponse);
}
