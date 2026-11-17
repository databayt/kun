/**
 * Mirrored in databayt/machine src/lib/contract.ts — change both together.
 *
 * The machine ↔ kun.databayt.org contract — one source for the server (`src/app/api/machine/*`), the
 * menu UI and the Rust `network`/`tasks` features (which mirror these shapes with serde; keep them in
 * step). Machines never talk to each other: every machine talks to kun.databayt.org and GitHub
 * (content/docs/interconnection.mdx). Every call carries `Authorization: Bearer <machine token>`; the
 * token belongs to one kun login (machines/<login>.json), and the server answers only for that login.
 *
 * A task is a GitHub issue in a databayt repo with a `dept:<department>` label, the sprint as its
 * milestone, a `P0`–`P3` priority label, and an optional kun block in its body:
 *   <!-- kun: repos=hogwarts,kun; items=skill:proposal,skill:pricing; after=hogwarts#40,#41 -->
 * Who holds a task is the `holder:<login>` label (works for people with no GitHub account); its state
 * is `status:in-progress` / `status:review`, and closed = done (only the CEO closes).
 */
import { z } from "zod";

/** The seven departments, in menu order. */
export const DEPARTMENTS = [
  "tech",
  "business",
  "sales",
  "marketing",
  "video",
  "support",
  "rnd",
] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const API_BASE_DEFAULT = "https://kun.databayt.org";

// ---- tasks ---------------------------------------------------------------------------------------

export type TaskStatus = "todo" | "in-progress" | "review" | "done";

/** The parsed kun block. Ids are `databayt/<repo>#<n>`; a bare `#41` means the task's own repo. */
export interface KunBlock {
  repos: string[];
  items: string[];
  after: string[];
}

export interface Task {
  /** `databayt/<repo>#<number>` */
  id: string;
  repo: string;
  number: number;
  title: string;
  url: string;
  department: Department;
  status: TaskStatus;
  /** kun login from the `holder:<login>` label, or null. */
  holder: string | null;
  priority: 0 | 1 | 2 | 3 | null;
  /** Milestone title, or null when the task is not in a sprint. */
  sprint: string | null;
  /** 0-based position in the queue: sprint → priority → `after` → age. */
  order: number;
  kun: KunBlock;
  /** The `after` ids that are still open (computed by the server). Non-empty = blocked. */
  afterOpen: string[];
  body: string;
  updatedAt: string;
}

export interface Sprint {
  title: string;
  goal: string | null;
  endsAt: string | null;
}

/** GET /api/machine/tasks?department=<d> */
export interface TasksResponse {
  sprint: Sprint | null;
  /** Tasks held by or queued for this login in the department, in queue order. */
  mine: Task[];
  /** Every open task of the department (anyone's), in queue order. */
  board: Task[];
  /** How many tasks this login holds in-progress across all departments (the WIP check). */
  inProgress: number;
  /** 1 unless the CEO set a `wip:<n>` label on the login's open task. */
  wipLimit: number;
}

export const taskIdSchema = z.string().regex(/^databayt\/[a-z0-9._-]+#\d+$/);

/** POST /api/machine/claim · /release */
export const claimSchema = z.object({ id: taskIdSchema });
/** POST /api/machine/done */
export const doneSchema = z.object({
  id: taskIdSchema,
  summary: z.string().trim().min(1).max(4000),
});

/** Claim refusals (HTTP 409 `{ error }`). */
export type ClaimError =
  "held" | "wip" | "blocked" | "not-found" | "department";

export type ClaimResponse =
  { ok: true; task: Task } | { ok: false; error: ClaimError; detail?: string };

// ---- health + heartbeat ---------------------------------------------------------------------------

export interface HealthItem {
  /** e.g. "driver", "catalog", "repo:hogwarts", "workspace", "disk", "kun" */
  key: string;
  ok: boolean;
  detail: string;
  /** True when the machine fixed it itself on this check. */
  healed: boolean;
}

export interface HealthReport {
  checkedAt: string;
  items: HealthItem[];
}

export interface LocalRepo {
  name: string;
  mode: "keep" | "sprint";
  branch: string;
  behind: number;
  ahead: number;
  dirty: boolean;
}

/** POST /api/machine/heartbeat */
export const heartbeatSchema = z.object({
  appVersion: z.string().max(40),
  os: z.string().max(40),
  health: z.object({
    checkedAt: z.string(),
    items: z
      .array(
        z.object({
          key: z.string().max(80),
          ok: z.boolean(),
          detail: z.string().max(500),
          healed: z.boolean(),
        }),
      )
      .max(100),
  }),
  repos: z
    .array(
      z.object({
        name: z.string().max(100),
        mode: z.enum(["keep", "sprint"]),
        branch: z.string().max(200),
        behind: z.number().int().min(0),
        ahead: z.number().int().min(0),
        dirty: z.boolean(),
      }),
    )
    .max(200),
  currentTask: taskIdSchema.nullable(),
});
export type Heartbeat = z.infer<typeof heartbeatSchema>;

export interface HeartbeatResponse {
  ok: true;
  serverTime: string;
  /** Unread messages waiting for this login. */
  unread: number;
}

// ---- repos ---------------------------------------------------------------------------------------

export interface OrgRepo {
  name: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
  url: string;
  /** Departments whose packs list this repo. */
  departments: Department[];
}

/** GET /api/machine/repos — the org repos this login's profile may see. */
export interface ReposResponse {
  repos: OrgRepo[];
}

// ---- messages ------------------------------------------------------------------------------------

export type MessageKind = "note" | "job" | "nudge";

export interface MachineMessage {
  id: string;
  from: string;
  to: string;
  kind: MessageKind;
  body: { text: string; taskId?: string };
  createdAt: string;
  readAt: string | null;
}

/** POST /api/machine/messages */
export const sendMessageSchema = z.object({
  to: z.string().regex(/^[a-z0-9-]{1,32}$/),
  kind: z.enum(["note", "job", "nudge"]),
  body: z.object({
    text: z.string().trim().min(1).max(4000),
    taskId: taskIdSchema.optional(),
  }),
});

/** GET /api/machine/messages → { messages } (unread first, newest first; marks them read). */
export interface MessagesResponse {
  messages: MachineMessage[];
}

// ---- team ----------------------------------------------------------------------------------------

export interface MachineStatus {
  login: string;
  name: string;
  os: string;
  departments: Department[];
  lastSeenAt: string | null;
  /** False when any health item failed and was not healed. */
  healthOk: boolean | null;
  currentTask: string | null;
}

/** GET /api/machine/team?department=<d> */
export interface TeamResponse {
  machines: MachineStatus[];
}
