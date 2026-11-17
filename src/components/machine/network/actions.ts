// network — the TS face of rust.rs (IPC to the local Rust plugin). Null outside the machine app.
import { invoke, isTauri } from "@tauri-apps/api/core"

import type { HealthReport, TeamResponse } from "./types"

/** The last health report, or null before the first check (and outside the app). */
export async function getHealth(): Promise<HealthReport | null> {
  if (!isTauri()) return null
  return invoke<HealthReport | null>("plugin:network|health")
}

/** Runs a check-and-heal pass now. */
export async function checkNow(): Promise<HealthReport | null> {
  if (!isTauri()) return null
  return invoke<HealthReport>("plugin:network|check_now")
}

/** Every machine of a department, from kun. */
export async function getTeam(department: string): Promise<TeamResponse | null> {
  if (!isTauri()) return null
  return invoke<TeamResponse>("plugin:network|team", { department })
}

/** Stores the machine token in the OS credential store. It is never read back. */
export async function setMachineToken(token: string): Promise<void> {
  if (!isTauri()) return
  await invoke("plugin:network|set_token", { token })
}

export async function hasMachineToken(): Promise<boolean> {
  if (!isTauri()) return false
  return invoke<boolean>("plugin:network|has_token")
}
