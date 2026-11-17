// catalog — the TS face of rust.rs. Not server actions: in machine these call the local Rust
// plugin over Tauri IPC. In a plain browser the catalog is read-only, served from the static
// registry that `pnpm kun:registry` builds; install and uninstall need the machine app.
import { invoke, isTauri } from "@tauri-apps/api/core"

import type { CatalogItem } from "./types"

/** True inside the machine app, where install and uninstall work. */
export function canInstall(): boolean {
  return isTauri()
}

/** Every registry item. In machine each carries its status here; in a browser all are "available". */
export async function list(): Promise<CatalogItem[]> {
  if (isTauri()) return invoke<CatalogItem[]>("plugin:catalog|list")
  const res = await fetch("/r/kun/index.json")
  if (!res.ok) throw new Error(`registry ${res.status}`)
  const reg = (await res.json()) as { items: CatalogItem[] }
  return reg.items.map((i) => ({ ...i, status: "available", installed_version: null }))
}

/** Install an item and its dependencies. Resolves to the ids written. */
export async function install(name: string): Promise<string[]> {
  if (!isTauri()) throw new Error("install needs the machine app")
  return invoke<string[]>("plugin:catalog|install", { name })
}

/** Remove only the files this catalog installed for the item. */
export async function uninstall(name: string): Promise<void> {
  if (!isTauri()) throw new Error("uninstall needs the machine app")
  return invoke<void>("plugin:catalog|uninstall", { name })
}
