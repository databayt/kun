// repos — the TS face of rust.rs (IPC to the local Rust plugin). Not server actions. Outside the
// machine app there are no clones, so reads return nothing and writes throw.
import { Channel, invoke, isTauri } from "@tauri-apps/api/core"

import type { OrgRepo } from "@/lib/machine/contract"

import type { RepoFailure, RepoMode, RepoRow, SweepReport, SyncEvent } from "./types"

export type { RepoFailure, RepoMode, RepoRow, SweepReport, SyncEvent }

/**
 * The repos: the org list when given (kun's API, from the network feature), else this profile's repos,
 * each merged with what is on disk. `fetch` refreshes ahead/behind from GitHub first (slow).
 * The menu calls it with no arguments. Outside the machine app: an empty list.
 */
export async function listRepos(org: OrgRepo[] = [], fetch = false): Promise<RepoRow[]> {
  if (!isTauri()) return []
  const slim = org.map((o) => ({ name: o.name, description: o.description, private: o.private }))
  return invoke<RepoRow[]>("plugin:repos|list", { org: slim, fetch })
}

function need() {
  if (!isTauri()) throw new Error("repos needs the machine app")
}

function stream(onEvent?: (e: SyncEvent) => void) {
  const channel = new Channel<SyncEvent>()
  channel.onmessage = (e) => onEvent?.(e)
  return channel
}

/** Shallow clone (50 commits); `depth: 0` for the full history. Git's progress streams to `onEvent`. */
export async function cloneRepo(name: string, depth?: number, onEvent?: (e: SyncEvent) => void): Promise<void> {
  need()
  return invoke<void>("plugin:repos|clone", { name, depth: depth ?? null, channel: stream(onEvent) })
}

/** `git pull --ff-only`, nothing else. */
export async function pullRepo(name: string, onEvent?: (e: SyncEvent) => void): Promise<void> {
  need()
  return invoke<void>("plugin:repos|pull", { name, channel: stream(onEvent) })
}

/** `keep`, or `sprint` with the sprint's name (swept when that sprint ends and the clone is clean). */
export async function setMode(name: string, mode: RepoMode, sprint?: string): Promise<void> {
  need()
  return invoke<void>("plugin:repos|set_mode", { name, mode, sprint: sprint ?? null })
}

/** Deletes the clone. Rejects with a RepoFailure whose `losses` lists what it would have lost. */
export async function removeRepo(name: string): Promise<void> {
  need()
  return invoke<void>("plugin:repos|remove", { name })
}

/** Only `https://github.com/databayt/<name>[.git]`. */
export async function setRemote(name: string, url: string): Promise<void> {
  need()
  return invoke<void>("plugin:repos|set_remote", { name, url })
}

/** The repo's GitHub URL. */
export async function remoteUrl(name: string): Promise<string> {
  if (!isTauri()) return `https://github.com/databayt/${name}`
  return invoke<string>("plugin:repos|open_remote", { name })
}

/** Opens the repo on GitHub. */
export async function openRemote(name: string): Promise<void> {
  window.open(await remoteUrl(name), "_blank", "noopener,noreferrer")
}

/** Removes the clean, pushed sprint clones whose sprint is over (the network heal calls this). */
export async function sweepSprint(currentSprint: string): Promise<SweepReport> {
  need()
  return invoke<SweepReport>("plugin:repos|sweep_sprint", { currentSprint })
}

/** What a rejected command carried: a RepoFailure from Rust, or any other error. */
export function failureOf(e: unknown): RepoFailure {
  if (e && typeof e === "object" && "code" in e && "message" in e) return e as RepoFailure
  return { code: "unknown", message: e instanceof Error ? e.message : String(e), losses: [] }
}
