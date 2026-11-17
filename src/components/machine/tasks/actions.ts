// tasks — the TS face of rust.rs (IPC to the local Rust plugin). Null outside the machine app.
import { invoke, isTauri } from "@tauri-apps/api/core"

import type { Readiness, TasksResponse } from "./types"

/** The server's queue and board, plus the local gate verdict for every task id. */
export type TasksView = TasksResponse & {
  readiness: Record<string, { state: Readiness["state"]; missing: string[] }>
}

export async function getTasks(department: string): Promise<TasksView | null> {
  if (!isTauri()) return null
  return invoke<TasksView>("plugin:tasks|tasks", { department })
}

/** Re-checks the gate, claims the task and writes TASK.md. Open the chat with `?task=<id>` after. */
export async function startTask(id: string): Promise<void> {
  if (!isTauri()) return
  await invoke("plugin:tasks|start", { id })
}

export async function releaseTask(id: string): Promise<void> {
  if (!isTauri()) return
  await invoke("plugin:tasks|release", { id })
}

/** Sends the task to review with a summary; the CEO closes the issue. */
export async function finishTask(id: string, summary: string): Promise<void> {
  if (!isTauri()) return
  await invoke("plugin:tasks|done", { id, summary })
}
