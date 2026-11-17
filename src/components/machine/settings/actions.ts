// settings — the TS face of rust.rs (IPC to the local Rust plugin).
import { invoke, isTauri } from "@tauri-apps/api/core"

import type { DriverStatus } from "../driver/types"
import type { Settings } from "./types"

export async function loadSettings(): Promise<Settings | null> {
  if (!isTauri()) return null
  return invoke<Settings>("plugin:settings|load_settings")
}

/** Rust validates again; resolves with the stored (trimmed) settings. */
export async function saveSettings(settings: Settings): Promise<Settings> {
  return invoke<Settings>("plugin:settings|save", { settings })
}

export async function detectDrivers(): Promise<DriverStatus[]> {
  if (!isTauri()) return []
  return invoke<DriverStatus[]>("plugin:settings|detect")
}
