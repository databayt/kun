import { authenticate, isResponse, json, readBody } from "@/lib/machine/auth";
import { uploadSchema } from "@/lib/machine/contract";
import type { ClaimResponse, UploadResponse } from "@/lib/machine/contract";
import { readTask } from "@/lib/machine/github";
import { receiptRefusal, splitId } from "@/lib/machine/tasks";
import { presignUploads } from "@/lib/machine/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// No bytes pass through the server: the machine PUTs each file straight to the CDN bucket with a
// presigned link (no cloud keys on a teammate's Mac). Only the holder of the task may ask.
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (isResponse(auth)) return auth;
  const body = await readBody(request, uploadSchema);
  if (isResponse(body)) return body;
  if (!splitId(body.id)) return json({ error: "bad_request" }, 400);
  try {
    const read = await readTask(body.id);
    const refusal = receiptRefusal(read?.task ?? null, auth.login);
    if (refusal) return json({ ok: false, ...refusal } satisfies ClaimResponse, 409);
    const uploads = await presignUploads(read!.task, body.files);
    if (!uploads) return json({ error: "bad_file_name" }, 400);
    return json({ uploads } satisfies UploadResponse);
  } catch {
    return json({ error: "upstream" }, 502);
  }
}
