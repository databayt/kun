import { authenticate, isResponse, json } from "@/lib/machine/auth";
import { taskIdSchema } from "@/lib/machine/contract";
import type { TaskDetailResponse } from "@/lib/machine/contract";
import { lastComments, readTask } from "@/lib/machine/github";
import { splitId } from "@/lib/machine/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The context pack for one task: its body plus the last 5 comments (receipts marked). The GitHub
// token stays on the server; the machine only ever sees this answer.
export async function GET(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (isResponse(auth)) return auth;
  const parsed = taskIdSchema.safeParse(new URL(request.url).searchParams.get("id"));
  if (!parsed.success) return json({ error: "bad_request" }, 400);
  const p = splitId(parsed.data)!;
  try {
    const read = await readTask(parsed.data);
    if (!read) return json({ error: "not-found" }, 404);
    if (!auth.profile.departments.includes(read.task.department)) return json({ error: "department" }, 403);
    const comments = await lastComments(p.repo, p.number, 5);
    return json({ task: read.task, comments } satisfies TaskDetailResponse);
  } catch {
    return json({ error: "upstream" }, 502);
  }
}
