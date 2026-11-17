// driver — the TS face of rust.rs. Not server actions: in machine these call the
// local Rust plugin over Tauri IPC. In a plain browser they degrade to "not available".
import { invoke, isTauri } from "@tauri-apps/api/core"

import type { DriverStatus } from "./types"

/** Agent CLIs installed on this computer. Empty outside the machine app. */
export async function drivers(): Promise<DriverStatus[]> {
  if (!isTauri()) return []
  return invoke<DriverStatus[]>("plugin:driver|drivers")
}
