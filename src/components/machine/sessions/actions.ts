// sessions — the TS face of rust.rs (IPC to the local Rust plugin).
import { invoke, isTauri } from "@tauri-apps/api/core"

import type { Session } from "./types"

export async function listSessions(): Promise<Session[]> {
  if (!isTauri()) return []
  return invoke<Session[]>("plugin:sessions|list")
}

export async function getSession(id: string): Promise<Session | null> {
  if (!isTauri()) return null
  return invoke<Session>("plugin:sessions|get", { id })
}

export async function renameSession(id: string, title: string): Promise<Session> {
  return invoke<Session>("plugin:sessions|rename", { id, title })
}

export async function removeSession(id: string): Promise<void> {
  return invoke<void>("plugin:sessions|remove", { id })
}
