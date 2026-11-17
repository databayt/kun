// profile — the TS face of rust.rs (IPC to the local Rust plugin). Not server actions.
import { invoke, isTauri } from "@tauri-apps/api/core"

import type { MachineProfile } from "./types"

export type { MachineProfile }

/** This machine's profile; null outside the machine app. The full-access default when none is set. */
export async function getProfile(): Promise<MachineProfile | null> {
  if (!isTauri()) return null
  return invoke<MachineProfile>("plugin:profile|profile")
}

/** Stores a secret the profile lists (Keychain / Credential Manager). The value is never read back. */
export async function setSecret(name: string, value: string): Promise<void> {
  if (!isTauri()) throw new Error("secrets need the machine app")
  return invoke<void>("plugin:profile|set_secret", { name, value })
}

/** Whether a secret the profile lists is stored. */
export async function hasSecret(name: string): Promise<boolean> {
  if (!isTauri()) return false
  return invoke<boolean>("plugin:profile|has_secret", { name })
}
