import { db } from "@/lib/db";
import { authenticate, isResponse, json, readBody } from "@/lib/machine/auth";
import { poolIdSchema } from "@/lib/machine/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The donor uploaded every output: running → done. Needs outputs recorded by /pool/done first.
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (isResponse(auth)) return auth;
  const body = await readBody(request, poolIdSchema);
  if (isResponse(body)) return body;
  const row = await db.computeJob.findUnique({ where: { id: body.id }, select: { donor: true, status: true, outputs: true } });
  if (!row || row.donor !== auth.login || row.status !== "running" || !Array.isArray(row.outputs))
    return json({ ok: false, error: "not-yours" }, 409);
  const r = await db.computeJob.updateMany({
    where: { id: body.id, donor: auth.login, status: "running" },
    data: { status: "done", progress: 1, finishedAt: new Date() },
  });
  return json({ ok: r.count === 1 }, r.count === 1 ? 200 : 409);
}
