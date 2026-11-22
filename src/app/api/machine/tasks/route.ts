import { authenticate, isResponse, json } from "@/lib/machine/auth";
import { DEPARTMENTS } from "@/lib/machine/contract";
import type { Department, TasksResponse } from "@/lib/machine/contract";
import { departmentBoard, holdings, ordersFor } from "@/lib/machine/github";

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
    const [{ board, sprint }, held, orders] = await Promise.all([
      departmentBoard(department),
      holdings(auth.login),
      ordersFor(auth.login),
    ]);
    // mine = held by this login + the department's unheld tasks, in queue order, then the work orders
    // made for him in other departments (de-duplicated by id; an order for someone else is never listed).
    const inDept = board.filter((t) => t.holder === auth.login || (t.holder === null && (!t.assignee || t.assignee === auth.login)));
    const seen = new Set(inDept.map((t) => t.id));
    const mine = [...inDept, ...orders.filter((t) => !seen.has(t.id))];
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
