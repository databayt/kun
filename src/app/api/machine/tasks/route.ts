import { authenticate, isResponse, json } from "@/lib/machine/auth";
import { DEPARTMENTS } from "@/lib/machine/contract";
import type { Department, TasksResponse } from "@/lib/machine/contract";
import { departmentBoard, holdings } from "@/lib/machine/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (isResponse(auth)) return auth;
  const asked = new URL(request.url).searchParams.get("department") ?? auth.profile.department ?? auth.profile.departments[0];
  if (!asked || !(DEPARTMENTS as readonly string[]).includes(asked))
    return json({ error: "bad_department" }, 400);
  const department = asked as Department;
  if (!auth.profile.departments.includes(department))
    return json({ error: "department" }, 403);
  try {
    const [{ board, sprint }, held] = await Promise.all([
      departmentBoard(department),
      holdings(auth.login),
    ]);
    // mine = held by this login + the department's unheld tasks, in queue order.
    const mine = board.filter((t) => t.holder === auth.login || t.holder === null);
    const res: TasksResponse = {
      sprint,
      mine,
      board,
      inProgress: held.inProgress.length,
      wipLimit: held.wipLimit,
    };
    return json(res);
  } catch {
    return json({ error: "upstream" }, 502);
  }
}
