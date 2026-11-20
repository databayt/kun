import { db } from "@/lib/db";
import { authenticate, isResponse, json, readBody } from "@/lib/machine/auth";
import { heartbeatSchema } from "@/lib/machine/contract";
import type { HeartbeatResponse } from "@/lib/machine/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (isResponse(auth)) return auth;
  const body = await readBody(request, heartbeatSchema);
  if (isResponse(body)) return body;
  await db.machine.update({
    where: { id: auth.machineId },
    data: {
      lastSeenAt: new Date(),
      appVersion: body.appVersion,
      os: body.os,
      health: body.health,
      repos: body.repos,
      currentTask: body.currentTask,
      // Only overwrite when the machine sent a summary (older apps omit it).
      ...(body.readiness ? { readiness: body.readiness } : {}),
      name: auth.profile.name,
    },
  });
  const unread = await db.machineMessage.count({ where: { toLogin: auth.login, readAt: null } });
  const res: HeartbeatResponse = { ok: true, serverTime: new Date().toISOString(), unread };
  return json(res);
}
