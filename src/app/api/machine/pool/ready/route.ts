import { db } from "@/lib/db";
import { authenticate, isResponse, json, readBody } from "@/lib/machine/auth";
import { poolReadySchema } from "@/lib/machine/contract";
import type { PoolReadyResponse } from "@/lib/machine/contract";
import { markReady } from "@/lib/machine/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The requester PUT every input: uploading → queued, which is what lets a donor claim it.
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (isResponse(auth)) return auth;
  const body = await readBody(request, poolReadySchema);
  if (isResponse(body)) return body;
  const ok = await markReady(db.computeJob as never, body.id, auth.login);
  return json(ok ? ({ ok: true } satisfies PoolReadyResponse) : ({ ok: false, error: "not-found" } satisfies PoolReadyResponse), ok ? 200 : 409);
}
