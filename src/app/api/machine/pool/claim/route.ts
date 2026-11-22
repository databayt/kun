import { db } from "@/lib/db";
import { authenticate, isResponse, json, readBody } from "@/lib/machine/auth";
import { poolIdSchema, resourcesSchema, shareSchema } from "@/lib/machine/contract";
import { claimJob } from "@/lib/machine/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (isResponse(auth)) return auth;
  const body = await readBody(request, poolIdSchema);
  if (isResponse(body)) return body;
  const me = await db.machine.findUnique({ where: { id: auth.machineId }, select: { share: true, resources: true } });
  const share = shareSchema.safeParse(me?.share);
  const resources = resourcesSchema.safeParse(me?.resources);
  try {
    const r = await claimJob(db.computeJob as never, {
      id: body.id,
      login: auth.login,
      share: share.success ? share.data : null,
      resources: resources.success ? resources.data : null,
    });
    return json(r, r.ok ? 200 : 409);
  } catch {
    return json({ error: "upstream" }, 502);
  }
}
