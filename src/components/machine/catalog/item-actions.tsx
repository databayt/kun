"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"

import { install, uninstall } from "./actions"
import { copy } from "./config"
import { useCanInstall } from "./use-catalog"
import type { CatalogItem } from "./types"

/** Install / update / uninstall for one item. Renders nothing outside the machine app. */
export function ItemActions({
  item,
  isAr,
  onChanged,
}: {
  item: CatalogItem
  isAr: boolean
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canInstallHere = useCanInstall()
  if (!canInstallHere) return null
  const t = (k: { en: string; ar: string }) => (isAr ? k.ar : k.en)

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onChanged()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        {item.status !== "installed" && (
          <Button size="sm" disabled={busy} onClick={() => run(() => install(item.id))}>
            {busy ? t(copy.working) : item.status === "outdated" ? t(copy.update) : t(copy.install)}
          </Button>
        )}
        {item.status !== "available" && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => uninstall(item.id))}>
            {t(copy.uninstall)}
          </Button>
        )}
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  )
}
