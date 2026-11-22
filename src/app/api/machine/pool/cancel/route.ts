import { db } from "@/lib/db";
import { authenticate, isResponse, json, readBody } from "@/lib/machine/auth";
import { poolCancelSchema } from "@/lib/machine/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Requester: cancels an uploading, queued or running job. Donor: releases its running job back to the queue
// (the person came back); the claim stays counted, so the 2-claim cap still ends a bad job.
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (isResponse(auth)) return auth;
  const body = await readBody(request, poolCancelSchema);
  if (isResponse(body)) return body;
  const asRequester = await db.computeJob.updateMany({
    where: { id: body.id, requester: auth.login, status: { in: ["uploading", "queued", "running"] } },
    data: { status: "cancelled", finishedAt: new Date() },
  });
  if (asRequester.count === 1) return json({ ok: true, released: false });
  const released = await db.computeJob.updateMany({
    where: { id: body.id, donor: auth.login, status: "running" },
    data: { status: "queued", donor: null, progress: 0 },
  });
  if (released.count === 1) return json({ ok: true, released: true });
  return json({ ok: false, error: "not-found" }, 409);
}
