// GitHub REST for the machine API, through the server's GITHUB_PERSONAL_ACCESS_TOKEN.
// A task is an issue; this file maps issues to Tasks and performs the label/comment writes.
import type { Sprint, Task, TaskComment } from "./contract";
import { RECEIPT_MARKER } from "./contract";
import { ORG, orderTasks, parseKunBlock, parseLabels, splitId, wipLimitFor } from "./tasks";
import type { RawTask } from "./tasks";

const API = "https://api.github.com";

function token(): string {
  const t = (process.env.GITHUB_PERSONAL_ACCESS_TOKEN ?? "").trim();
  if (!t) throw new Error("GITHUB_PERSONAL_ACCESS_TOKEN is not set");
  return t;
}

export async function gh(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token()}`,
      "x-github-api-version": "2022-11-28",
      "user-agent": "kun-machine-api",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
}

interface Issue {
  number: number;
  title: string;
  html_url: string;
  body: string | null;
  state: string;
  created_at: string;
  updated_at: string;
  labels: ({ name?: string } | string)[];
  milestone: { title: string; description: string | null; due_on: string | null } | null;
  repository_url?: string;
  pull_request?: unknown;
}

const labelNames = (i: Issue): string[] =>
  i.labels.map((l) => (typeof l === "string" ? l : (l.name ?? ""))).filter(Boolean);

function repoOf(i: Issue, fallback?: string): string {
  return i.repository_url?.split("/").pop() ?? fallback ?? "";
}

// ---- afterOpen: is a referenced issue still open? (60 s cache per isolate) ----------------------
const stateCache = new Map<string, { open: boolean; at: number }>();
const TTL = 60_000;

async function isOpen(id: string): Promise<boolean> {
  const hit = stateCache.get(id);
  if (hit && Date.now() - hit.at < TTL) return hit.open;
  const p = splitId(id);
  if (!p) return false;
  const res = await gh(`/repos/${ORG}/${p.repo}/issues/${p.number}`);
  // A reference we cannot read counts as open: never unblock on a failed lookup.
  const open = res.ok ? ((await res.json()) as Issue).state === "open" : true;
  stateCache.set(id, { open, at: Date.now() });
  return open;
}

async function openAfter(ids: string[]): Promise<Map<string, boolean>> {
  const unique = [...new Set(ids)];
  const states = await Promise.all(unique.map(isOpen));
  return new Map(unique.map((id, i) => [id, states[i]]));
}

async function toRawTasks(issues: Issue[], fallbackRepo?: string): Promise<RawTask[]> {
  const prepared = issues
    .filter((i) => !i.pull_request)
    .map((i) => {
      const repo = repoOf(i, fallbackRepo);
      return { i, repo, labels: parseLabels(labelNames(i)), kun: parseKunBlock(i.body, repo) };
    })
    .filter((x) => x.labels.department !== null);
  const states = await openAfter(prepared.flatMap((x) => x.kun.after));
  return prepared.map(({ i, repo, labels, kun }) => ({
    id: `${ORG}/${repo}#${i.number}`,
    repo,
    number: i.number,
    title: i.title,
    url: i.html_url,
    department: labels.department!,
    status: i.state === "closed" ? "done" : labels.status,
    holder: labels.holder,
    assignee: labels.assignee,
    auto: labels.auto,
    priority: labels.priority,
    sprint: i.milestone?.title ?? null,
    kun,
    afterOpen: kun.after.filter((id) => states.get(id)),
    body: i.body ?? "",
    updatedAt: i.updated_at,
    createdAt: i.created_at,
    sprintDue: i.milestone?.due_on ?? null,
  }));
}

async function search(q: string): Promise<Issue[]> {
  const out: Issue[] = [];
  for (let page = 1; page <= 3; page++) {
    const res = await gh(`/search/issues?q=${encodeURIComponent(q)}&per_page=100&page=${page}`);
    if (!res.ok) throw new Error(`github search ${res.status}`);
    const items = ((await res.json()) as { items: Issue[] }).items;
    out.push(...items);
    if (items.length < 100) break;
  }
  return out;
}

export interface Board {
  board: Task[];
  sprint: Sprint | null;
}

/** Every open task of a department, in queue order, plus the sprint of the first sprinted task. */
export async function departmentBoard(department: string): Promise<Board> {
  const issues = await search(`org:${ORG} is:issue is:open label:dept:${department}`);
  const board = orderTasks(await toRawTasks(issues));
  const byTitle = new Map(issues.filter((i) => i.milestone).map((i) => [i.milestone!.title, i.milestone!]));
  const first = board.find((t) => t.sprint);
  const m = first?.sprint ? byTitle.get(first.sprint) : undefined;
  return {
    board,
    sprint: m ? { title: m.title, goal: m.description || null, endsAt: m.due_on } : null,
  };
}

/** Open work orders made for this login (`for:<login>`) across the org, in any department, in queue order. */
export async function ordersFor(login: string): Promise<Task[]> {
  const issues = await search(`org:${ORG} is:issue is:open label:for:${login}`);
  return orderTasks((await toRawTasks(issues)).filter((t) => t.assignee === login));
}

/** Open tasks this login holds in-progress across all departments, and the WIP limit. */
export async function holdings(login: string): Promise<{ inProgress: Task[]; wipLimit: number }> {
  const held = await search(`org:${ORG} is:issue is:open label:holder:${login}`);
  const raw = await toRawTasks(held);
  const inProgress = orderTasks(raw.filter((t) => t.status === "in-progress"));
  return { inProgress, wipLimit: wipLimitFor(held.map(labelNames)) };
}

export async function readTask(id: string): Promise<{ task: Task; labels: string[] } | null> {
  const p = splitId(id);
  if (!p) return null;
  const res = await gh(`/repos/${ORG}/${p.repo}/issues/${p.number}`);
  if (!res.ok) return null;
  const issue = (await res.json()) as Issue;
  const [raw] = await toRawTasks([issue], p.repo);
  if (!raw) return null; // not a task (no dept label) or a pull request
  const { createdAt: _c, sprintDue: _d, ...rest } = raw;
  return { task: { ...rest, order: 0 }, labels: labelNames(issue) };
}

/** The last `n` comments of an issue (oldest of those first), bodies capped, receipts marked. */
export async function lastComments(repo: string, number: number, n = 5): Promise<TaskComment[]> {
  const all: { user: { login: string } | null; body: string | null; created_at: string }[] = [];
  for (let page = 1; page <= 5; page++) {
    const res = await gh(`/repos/${ORG}/${repo}/issues/${number}/comments?per_page=100&page=${page}`);
    if (!res.ok) throw new Error(`comments ${res.status}`);
    const rows = (await res.json()) as typeof all;
    all.push(...rows);
    if (rows.length < 100) break;
  }
  return all.slice(-n).map((c) => {
    const body = c.body ?? "";
    return {
      author: c.user?.login ?? "unknown",
      body: body.slice(0, 2000),
      createdAt: c.created_at,
      receipt: body.trimStart().startsWith(RECEIPT_MARKER),
    };
  });
}

// ---- writes --------------------------------------------------------------------------------------

const COLORS: Record<string, string> = { "status:in-progress": "fbca04", "status:review": "0e8a16" };

async function ensureLabel(repo: string, name: string): Promise<void> {
  const res = await gh(`/repos/${ORG}/${repo}/labels`, {
    method: "POST",
    body: JSON.stringify({ name, color: COLORS[name] ?? (name.startsWith("holder:") ? "5319e7" : "ededed") }),
  });
  // 422 = already exists.
  if (!res.ok && res.status !== 422) throw new Error(`label ${name}: ${res.status}`);
}

export async function addLabels(repo: string, n: number, names: string[]): Promise<void> {
  for (const l of names) await ensureLabel(repo, l);
  const res = await gh(`/repos/${ORG}/${repo}/issues/${n}/labels`, {
    method: "POST",
    body: JSON.stringify({ labels: names }),
  });
  if (!res.ok) throw new Error(`add labels: ${res.status}`);
}

export async function removeLabels(repo: string, n: number, names: string[]): Promise<void> {
  for (const l of names) {
    const res = await gh(`/repos/${ORG}/${repo}/issues/${n}/labels/${encodeURIComponent(l)}`, {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 404) throw new Error(`remove label ${l}: ${res.status}`);
  }
}

export async function comment(repo: string, n: number, body: string): Promise<void> {
  const res = await gh(`/repos/${ORG}/${repo}/issues/${n}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(`comment: ${res.status}`);
}

export interface RepoRow {
  name: string;
  description: string | null;
  private: boolean;
  default_branch: string;
  html_url: string;
  archived: boolean;
}

export async function orgRepos(): Promise<RepoRow[]> {
  const out: RepoRow[] = [];
  for (let page = 1; page <= 5; page++) {
    const res = await gh(`/orgs/${ORG}/repos?per_page=100&type=all&page=${page}`);
    if (!res.ok) throw new Error(`github repos ${res.status}`);
    const rows = (await res.json()) as RepoRow[];
    out.push(...rows);
    if (rows.length < 100) break;
  }
  return out.filter((r) => !r.archived);
}
