// menu data — typed adapters over the features other lanes own (tasks, network, repos). Each one
// dynamic-imports its feature (kept off the first paint) and falls back to null / empty on any failure.
// The app side reads the Rust-generated types (the shapes the commands actually return).
import type { HealthReport, TeamResponse } from "../network/types";
import type { TasksView } from "../tasks/actions";

export type { HealthReport, TasksView, TeamResponse };
export type Readiness = TasksView["readiness"][string];
export type RepoRow = { name: string; local: boolean; mode: "keep" | "sprint" | null };

export async function loadTasks(department: string): Promise<TasksView | null> {
  try {
    const m = await import("../tasks/actions");
    return await m.getTasks(department);
  } catch {
    return null;
  }
}

export async function runStart(id: string): Promise<void> {
  const m = await import("../tasks/actions");
  await m.startTask(id);
}

export async function loadHealth(): Promise<HealthReport | null> {
  try {
    const m = await import("../network/actions");
    return await m.getHealth();
  } catch {
    return null;
  }
}

export async function loadTeam(department: string): Promise<TeamResponse | null> {
  try {
    const m = await import("../network/actions");
    return await m.getTeam(department);
  } catch {
    return null;
  }
}

export async function loadRepos(): Promise<RepoRow[]> {
  try {
    const m = await import("../repos/actions");
    return (await m.listRepos()) ?? [];
  } catch {
    return [];
  }
}

/** Department packs gain `repos` and `docs`; read them when present. */
export function deptExtras(d: object): { repos: string[]; docs: string[] } {
  const x = d as { repos?: string[]; docs?: string[] };
  return { repos: x.repos ?? [], docs: x.docs ?? [] };
}
