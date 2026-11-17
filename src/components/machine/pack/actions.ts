// pack — the TS face of rust.rs (IPC to the local Rust plugin).
import { invoke, isTauri } from "@tauri-apps/api/core"

import type { PackInfo } from "./types"

/** A department's title and quick actions; null outside the machine app. */
export async function packInfo(department: string): Promise<PackInfo | null> {
  if (!isTauri()) return null
  return invoke<PackInfo>("plugin:pack|info", { department })
}

/** Departments that ship a pack in this kun checkout. */
export async function departments(): Promise<string[]> {
  if (!isTauri()) return []
  return invoke<string[]>("plugin:pack|departments")
}
