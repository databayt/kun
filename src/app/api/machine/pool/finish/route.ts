import { db } from "@/lib/db";
import { authenticate, isResponse, json, readBody } from "@/lib/machine/auth";
import { poolIdSchema } from "@/lib/machine/contract";
import { finishJob } from "@/lib/machine/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The donor uploaded every output: running → done. Needs outputs recorded by /pool/done first.
// The requester is told through a MachineMessage (the existing network:unread flow).
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (isResponse(auth)) return auth;
  const body = await readBody(request, poolIdSchema);
  if (isResponse(body)) return body;
  const ok = await finishJob(db.computeJob as never, db.machineMessage as never, body.id, auth.login);
  return json(ok ? { ok: true } : { ok: false, error: "not-yours" }, ok ? 200 : 409);
}
