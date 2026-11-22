import { db } from "@/lib/db";
import { authenticate, isResponse, json, readBody } from "@/lib/machine/auth";
import { POOL_GET_SECONDS, poolCreateSchema, shareSchema } from "@/lib/machine/contract";
import type { PoolCreateResponse, PoolFile, PoolListResponse } from "@/lib/machine/contract";
import { presignInputs, requeueStale, toJob } from "@/lib/machine/pool";
import type { JobRow } from "@/lib/machine/pool";
import { defaultGetSigner } from "@/lib/machine/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST: create a job. The row exists first (its id builds the keys), then the inputs get presigned PUTs.
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (isResponse(auth)) return auth;
  const body = await readBody(request, poolCreateSchema);
  if (isResponse(body)) return body;
  const row = await db.computeJob.create({
    data: {
      kind: body.kind,
      params: body.params as never,
      requester: auth.login,
      // Not claimable until the requester has PUT every input and calls /pool/ready.
      status: "uploading",
      target: body.target ?? null,
      inputs: [],
      needs: body.needs ?? undefined,
    },
  });
  try {
    const signed = await presignInputs(row.id, body.files);
    if (!signed) {
      await db.computeJob.delete({ where: { id: row.id } });
      return json({ error: "bad_file_name" }, 400);
    }
    const updated = await db.computeJob.update({ where: { id: row.id }, data: { inputs: signed.inputs as never } });
    return json({ job: toJob(updated as JobRow), uploads: signed.uploads } satisfies PoolCreateResponse);
  } catch {
    await db.computeJob.delete({ where: { id: row.id } }).catch(() => undefined);
    return json({ error: "upstream" }, 502);
  }
}

// GET: my jobs (done outputs carry 10-minute GET links) plus the queue a donor may claim.
export async function GET(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (isResponse(auth)) return auth;
  await requeueStale(db.computeJob as never);
  const me = await db.machine.findUnique({ where: { id: auth.machineId }, select: { share: true } });
  const share = shareSchema.safeParse(me?.share);
  const [mineRows, queueRows] = await Promise.all([
    db.computeJob.findMany({ where: { requester: auth.login }, orderBy: { createdAt: "desc" }, take: 50 }),
    share.success && share.data.enabled
      ? db.computeJob.findMany({
          where: {
            status: "queued",
            claims: { lt: 2 },
            kind: { in: share.data.kinds },
            AND: [{ OR: [{ target: null }, { target: auth.login }] }, { NOT: { requester: auth.login } }],
          },
          orderBy: { createdAt: "asc" },
          take: 20,
        })
      : Promise.resolve([]),
  ]);
  try {
    const mine = await Promise.all(
      (mineRows as JobRow[]).map(async (r) => {
        if (r.status !== "done" || !Array.isArray(r.outputs)) return toJob(r);
        const outputs = await Promise.all(
          (r.outputs as PoolFile[]).map(async (f) => ({ ...f, getUrl: await defaultGetSigner(f.key, POOL_GET_SECONDS) })),
        );
        return toJob(r, outputs);
      }),
    );
    return json({ mine, queue: (queueRows as JobRow[]).map((r) => toJob(r)) } satisfies PoolListResponse);
  } catch {
    return json({ error: "upstream" }, 502);
  }
}
