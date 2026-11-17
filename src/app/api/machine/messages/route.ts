import { db } from "@/lib/db";
import { authenticate, isResponse, json, readBody } from "@/lib/machine/auth";
import { sendMessageSchema } from "@/lib/machine/contract";
import type { MachineMessage, MessageKind, MessagesResponse } from "@/lib/machine/contract";
import { getProfile } from "@/lib/machine/profiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row {
  id: string;
  toLogin: string;
  fromLogin: string;
  kind: string;
  body: unknown;
  createdAt: Date;
  readAt: Date | null;
}

const toMessage = (m: Row): MachineMessage => ({
  id: m.id,
  from: m.fromLogin,
  to: m.toLogin,
  kind: m.kind as MessageKind,
  body: m.body as MachineMessage["body"],
  createdAt: m.createdAt.toISOString(),
  readAt: m.readAt?.toISOString() ?? null,
});

// Unread first, newest first; reading marks them read (the response still shows them unread-state as sent).
export async function GET(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (isResponse(auth)) return auth;
  const rows = await db.machineMessage.findMany({
    where: { toLogin: auth.login },
    orderBy: [{ readAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    take: 50,
  });
  const unreadIds = rows.filter((r) => r.readAt === null).map((r) => r.id);
  if (unreadIds.length)
    await db.machineMessage.updateMany({
      where: { id: { in: unreadIds }, readAt: null },
      data: { readAt: new Date() },
    });
  return json({ messages: rows.map(toMessage) } satisfies MessagesResponse);
}

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (isResponse(auth)) return auth;
  const body = await readBody(request, sendMessageSchema);
  if (isResponse(body)) return body;
  if (!getProfile(body.to)) return json({ error: "unknown_recipient" }, 404);
  const row = await db.machineMessage.create({
    data: { toLogin: body.to, fromLogin: auth.login, kind: body.kind, body: body.body },
  });
  return json({ ok: true, message: toMessage(row) });
}
