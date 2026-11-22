// Pure task logic for the machine API: the kun-block parser, label parsing, queue ordering and
// the claim gate. No I/O here — github.ts feeds it, the routes call it, tasks.test.ts pins it.
import { DEPARTMENTS, DRIVERS, GATE_STALE_MS, RECEIPT_MARKER, readinessSchema } from "./contract";
import type { ClaimError, Department, Driver, KunBlock, Receipt, Task, TaskStatus } from "./contract";

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
 * `<!-- kun: repos=hogwarts,kun; items=skill:proposal; after=hogwarts#40,#41; driver=codex -->`. Unknown keys and
 * a missing block are ignored; an unknown `driver` is ignored; `after` entries resolve against `ownRepo` and malformed ones drop.
 */
export function parseKunBlock(body: string | null | undefined, ownRepo: string): KunBlock {
  const out: KunBlock = { repos: [], items: [], after: [], driver: null, film: null, formula: null, weight: null };
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
  const driver = (fields.driver ?? "").toLowerCase();
  out.driver = (DRIVERS as readonly string[]).includes(driver) ? (driver as Driver) : null;
  out.film = fields.film || null;
  out.formula = fields.formula || null;
  const w = Number(fields.weight);
  out.weight = fields.weight && Number.isFinite(w) ? w : null;
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
  /** `for:<login>` */
  assignee: string | null;
  priority: 0 | 1 | 2 | 3 | null;
  wip: number | null;
  /** `run:auto` */
  auto: boolean;
}

export function parseLabels(names: string[]): ParsedLabels {
  const r: ParsedLabels = { department: null, status: "todo", holder: null, assignee: null, priority: null, wip: null, auto: false };
  for (const raw of names) {
    const n = raw.trim();
    const lower = n.toLowerCase();
    if (lower.startsWith("dept:")) {
      const d = lower.slice(5) as Department;
      if ((DEPARTMENTS as readonly string[]).includes(d)) r.department = d;
    } else if (lower.startsWith("holder:")) {
      r.holder = lower.slice(7) || null;
    } else if (lower.startsWith("for:")) {
      r.assignee = lower.slice(4) || null;
    } else if (lower === "status:in-progress") {
      r.status = "in-progress";
    } else if (lower === "status:review" && r.status !== "in-progress") {
      r.status = "review";
    } else if (/^p[0-3]$/.test(lower)) {
      r.priority = Number(lower[1]) as 0 | 1 | 2 | 3;
    } else if (lower === "run:auto") {
      r.auto = true;
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

/** Queue order: priority (P0 first, none last) → milestone (in a sprint first; the earliest due,
 *  i.e. the current sprint, before later ones) → issue age (oldest first) → id as the stable tiebreak.
 *  `after` does not reorder: a blocked task keeps its place and is refused at claim time. */
export function orderTasks(tasks: RawTask[]): Task[] {
  const sorted = [...tasks].sort((a, b) => {
    const p = cmpNullLast(a.priority, b.priority, (x, y) => x - y);
    if (p) return p;
    const s =
      Number(a.sprint === null) - Number(b.sprint === null) ||
      cmpNullLast(a.sprintDue, b.sprintDue, (x, y) => x.localeCompare(y)) ||
      cmpNullLast(a.sprint, b.sprint, (x, y) => x.localeCompare(y));
    if (s) return s;
    return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
  });
  return sorted.map(({ createdAt: _c, sprintDue: _d, ...t }, order) => ({ ...t, order }));
}

export interface ClaimInput {
  task: Pick<Task, "holder" | "status" | "afterOpen" | "department"> & { assignee?: string | null };
  login: string;
  departments: readonly Department[];
  /** Tasks this login already holds in-progress (excluding this one). */
  inProgress: number;
  wipLimit: number;
  /** The machine's stored readiness (the heartbeat's `readiness`), for the doctor check. Omit to skip it. */
  readiness?: unknown;
  now?: Date;
}

/**
 * The doctor check shared by task claims and pool claims: a detail string when the machine's last doctor
 * verdict fails or is older than 48 h, null when it may contribute.
 *
 * A machine that never sent a gate (an app from before the doctor, or no readiness yet) is allowed for now,
 * so old app versions are not locked out; tighten this to a refusal once every app reports a gate.
 */
export function doctorRefusal(readiness: unknown, now = new Date()): string | null {
  const parsed = readinessSchema.safeParse(readiness);
  const gate = parsed.success ? parsed.data.gate : undefined;
  if (!gate) return null;
  const at = Date.parse(gate.at);
  if (!Number.isFinite(at) || now.getTime() - at > GATE_STALE_MS)
    return "the doctor has not run in 48 h — open Kun and run the doctor";
  if (!gate.pass) return `doctor failing: ${gate.failing.join(", ") || "unknown"} — run the doctor`;
  return null;
}

/** The claim gate, in the order a person would explain it. null = allowed. */
export function claimRefusal(i: ClaimInput): { error: ClaimError; detail: string } | null {
  // A work order made for one person (`for:<login>`) is theirs in any department, and nobody else's.
  if (i.task.assignee && i.task.assignee !== i.login)
    return { error: "held", detail: `this order is for ${i.task.assignee}` };
  if (!i.task.assignee && !i.departments.includes(i.task.department))
    return { error: "department", detail: `${i.task.department} is not in your profile` };
  if (i.task.holder && i.task.holder !== i.login)
    return { error: "held", detail: `held by ${i.task.holder}` };
  if (i.task.holder === i.login && i.task.status === "in-progress")
    return { error: "held", detail: "you already hold it" };
  if (i.task.status === "review")
    return { error: "held", detail: "already in review" };
  const doctor = doctorRefusal(i.readiness, i.now);
  if (doctor) return { error: "doctor", detail: doctor };
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

/** Why a receipt is refused, or null. Only the holder of a task may post its receipt. */
export function receiptRefusal(
  task: Pick<Task, "holder" | "status"> | null,
  login: string,
): { error: ClaimError; detail: string } | null {
  if (!task) return { error: "not-found", detail: "no such task" };
  if (task.holder !== login) return { error: "held", detail: "you do not hold it" };
  if (task.status === "done") return { error: "held", detail: "already closed" };
  return null;
}

const fmtDuration = (ms: number): string => {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : m ? `${m}m ${s % 60}s` : `${s}s`;
};

/** The issue comment a receipt becomes. Starts with the marker; one line per fact. */
export function formatReceipt(r: Receipt, login: string): string {
  const bullets = (v: string[]): string => (v.length ? v.map((x) => `- ${x}`).join("\n") : "- none");
  return [
    RECEIPT_MARKER,
    `### Run receipt — ${login}`,
    "",
    `Driver: ${r.driver} · Model: ${r.model} · Duration: ${fmtDuration(r.durationMs)}`,
    ...(r.formula || r.stage ? [[r.formula ? `Formula: ${r.formula}` : "", r.stage ? `Stage: ${r.stage}` : ""].filter(Boolean).join(" · ")] : []),
    "",
    "**Summary**",
    r.summary,
    "",
    "**Commits**",
    bullets(r.commits),
    "",
    "**Artifacts**",
    bullets(r.artifacts),
    ...(r.hashes ? ["", "**Hashes (sha256)**", bullets(r.artifacts.map((a, i) => `${r.hashes![i]}  ${a}`))] : []),
    ...(r.next ? ["", "**Next**", r.next] : []),
    "",
    "Ready for review (`status:review`). Only the CEO closes.",
  ].join("\n");
}

/** The CDN key for an uploaded file: `work/<film or repo>/<issue number>/<safe name>`; null when the name is empty. */
export function sanitizeFileName(name: string): string | null {
  const base = name.split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, "").replace(/^\.+/, "").replace(/\s+/g, " ").trim();
  return clean && clean !== "." && clean !== ".." ? clean : null;
}

export function uploadKey(task: Pick<Task, "repo" | "number" | "kun">, name: string): string | null {
  const file = sanitizeFileName(name);
  if (!file) return null;
  const film = (task.kun.film || task.repo).replace(/[^a-zA-Z0-9._-]/g, "-");
  return `work/${film}/${task.number}/${file}`;
}
