// Pure task logic for the machine API: the kun-block parser, label parsing, queue ordering and
// the claim gate. No I/O here — github.ts feeds it, the routes call it, tasks.test.ts pins it.
import { DEPARTMENTS } from "./contract";
import type { ClaimError, Department, KunBlock, Task, TaskStatus } from "./contract";

export const ORG = "databayt";

/** `#41`, `hogwarts#41`, `databayt/hogwarts#41` → `databayt/hogwarts#41`; null if malformed. */
export function normalizeRef(ref: string, ownRepo: string): string | null {
  const m = /^(?:(?:databayt\/)?([a-z0-9._-]+))?#(\d+)$/i.exec(ref.trim());
  if (!m) return null;
  return `${ORG}/${(m[1] ?? ownRepo).toLowerCase()}#${m[2]}`;
}

const list = (v: string | undefined): string[] =>
  (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/**
 * `<!-- kun: repos=hogwarts,kun; items=skill:proposal; after=hogwarts#40,#41 -->`. Unknown keys and
 * a missing block are ignored; `after` entries resolve against `ownRepo` and malformed ones drop.
 */
export function parseKunBlock(body: string | null | undefined, ownRepo: string): KunBlock {
  const out: KunBlock = { repos: [], items: [], after: [] };
  const m = /<!--\s*kun:([\s\S]*?)-->/i.exec(body ?? "");
  if (!m) return out;
  const fields: Record<string, string> = {};
  for (const part of m[1].split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    fields[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  out.repos = list(fields.repos);
  out.items = list(fields.items);
  const seen = new Set<string>();
  for (const r of list(fields.after)) {
    const id = normalizeRef(r, ownRepo);
    if (id && !seen.has(id)) {
      seen.add(id);
      out.after.push(id);
    }
  }
  return out;
}

export interface ParsedLabels {
  department: Department | null;
  status: TaskStatus;
  holder: string | null;
  priority: 0 | 1 | 2 | 3 | null;
  wip: number | null;
}

export function parseLabels(names: string[]): ParsedLabels {
  const r: ParsedLabels = { department: null, status: "todo", holder: null, priority: null, wip: null };
  for (const raw of names) {
    const n = raw.trim();
    const lower = n.toLowerCase();
    if (lower.startsWith("dept:")) {
      const d = lower.slice(5) as Department;
      if ((DEPARTMENTS as readonly string[]).includes(d)) r.department = d;
    } else if (lower.startsWith("holder:")) {
      r.holder = lower.slice(7) || null;
    } else if (lower === "status:in-progress") {
      r.status = "in-progress";
    } else if (lower === "status:review" && r.status !== "in-progress") {
      r.status = "review";
    } else if (/^p[0-3]$/.test(lower)) {
      r.priority = Number(lower[1]) as 0 | 1 | 2 | 3;
    } else if (/^wip:\d+$/.test(lower)) {
      r.wip = Number(lower.slice(4));
    }
  }
  return r;
}

/** A task plus the sort keys the contract does not expose. */
export type RawTask = Omit<Task, "order"> & { createdAt: string; sprintDue: string | null };

const cmpNullLast = <T>(a: T | null, b: T | null, cmp: (x: T, y: T) => number): number => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return cmp(a, b);
};

/** Queue order: sprint (in a sprint first, earliest due, then title) → priority (P0 first, none last)
 *  → unblocked before blocked (`after`) → oldest first → id as the stable tiebreak. */
export function orderTasks(tasks: RawTask[]): Task[] {
  const sorted = [...tasks].sort((a, b) => {
    const s =
      cmpNullLast(a.sprint, b.sprint, (x, y) => 0) ||
      cmpNullLast(a.sprintDue, b.sprintDue, (x, y) => x.localeCompare(y)) ||
      cmpNullLast(a.sprint, b.sprint, (x, y) => x.localeCompare(y));
    if (s) return s;
    const p = cmpNullLast(a.priority, b.priority, (x, y) => x - y);
    if (p) return p;
    const blocked = Number(a.afterOpen.length > 0) - Number(b.afterOpen.length > 0);
    if (blocked) return blocked;
    return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
  });
  return sorted.map(({ createdAt: _c, sprintDue: _d, ...t }, order) => ({ ...t, order }));
}

export interface ClaimInput {
  task: Pick<Task, "holder" | "status" | "afterOpen" | "department">;
  login: string;
  departments: readonly Department[];
  /** Tasks this login already holds in-progress (excluding this one). */
  inProgress: number;
  wipLimit: number;
}

/** The claim gate, in the order a person would explain it. null = allowed. */
export function claimRefusal(i: ClaimInput): { error: ClaimError; detail: string } | null {
  if (!i.departments.includes(i.task.department))
    return { error: "department", detail: `${i.task.department} is not in your profile` };
  if (i.task.holder && i.task.holder !== i.login)
    return { error: "held", detail: `held by ${i.task.holder}` };
  if (i.task.holder === i.login && i.task.status === "in-progress")
    return { error: "held", detail: "you already hold it" };
  if (i.task.status === "review")
    return { error: "held", detail: "already in review" };
  if (i.task.afterOpen.length > 0)
    return { error: "blocked", detail: `waiting on ${i.task.afterOpen.join(", ")}` };
  if (i.inProgress >= i.wipLimit)
    return { error: "wip", detail: `you hold ${i.inProgress} (limit ${i.wipLimit})` };
  return null;
}

/** The WIP limit: a `wip:<n>` label on any open task the login holds, else 1. */
export function wipLimitFor(heldLabelSets: string[][]): number {
  let limit = 1;
  for (const labels of heldLabelSets) {
    const w = parseLabels(labels).wip;
    if (w !== null && w > limit) limit = w;
  }
  return limit;
}

/** `databayt/<repo>#<n>` → parts, or null. */
export function splitId(id: string): { repo: string; number: number } | null {
  const m = /^databayt\/([a-z0-9._-]+)#(\d+)$/.exec(id);
  return m ? { repo: m[1], number: Number(m[2]) } : null;
}

export function healthOk(health: unknown): boolean | null {
  const items = (health as { items?: { ok: boolean; healed: boolean }[] } | null)?.items;
  if (!Array.isArray(items)) return null;
  return !items.some((i) => !i.ok && !i.healed);
}
