// engine — the TS face of rust.rs. Not server actions: Tauri IPC, guarded by isTauri().
import { invoke, isTauri } from "@tauri-apps/api/core"

import type { EngineStatus, HealthReport, LiveState, UpdateReport } from "./types"

export async function engineStatus(): Promise<EngineStatus | null> {
  if (!isTauri()) return null
  return invoke<EngineStatus>("plugin:engine|status")
}

export async function engineUpdate(): Promise<UpdateReport | null> {
  if (!isTauri()) return null
  return invoke<UpdateReport>("plugin:engine|update")
}

export async function engineHealth(): Promise<HealthReport | null> {
  if (!isTauri()) return null
  return invoke<HealthReport>("plugin:engine|health")
}

export async function engineState(): Promise<LiveState | null> {
  if (!isTauri()) return null
  return invoke<LiveState>("plugin:engine|state")
}
