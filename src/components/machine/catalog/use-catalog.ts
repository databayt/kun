"use client"

import { useCallback, useEffect, useState } from "react"

import { canInstall, list } from "./actions"
import type { CatalogItem } from "./types"

/** The registry with statuses; `reload` after an install or uninstall. */
export function useCatalog() {
  const [items, setItems] = useState<CatalogItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    list()
      .then((i) => {
        setItems(i)
        setError(null)
      })
      .catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { items, error, reload }
}

/** Whether this is the machine app. False on the server and on first paint, so hydration matches. */
export function useCanInstall(): boolean {
  const [can, setCan] = useState(false)
  useEffect(() => setCan(canInstall()), [])
  return can
}
