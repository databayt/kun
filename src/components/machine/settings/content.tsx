"use client"

import { useEffect, useState } from "react"

import type { Locale } from "@/components/local/config"
import type { DriverStatus } from "../driver/types"
import { departments as listDepartments } from "../pack/actions"
import { OpenInMachine, useInMachine } from "../shell/content"
import { detectDrivers, loadSettings } from "./actions"
import { SettingsForm } from "./form"
import type { Settings } from "./types"

export default function SettingsContent({ lang }: { lang: Locale }) {
  const isAr = lang === "ar"
  const inApp = useInMachine()
  const [state, setState] = useState<{ settings: Settings; drivers: DriverStatus[]; departments: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!inApp) return
    Promise.all([loadSettings(), detectDrivers(), listDepartments()])
      .then(([settings, drivers, departments]) => {
        if (settings) setState({ settings, drivers, departments })
      })
      .catch((e) => setError(String(e)))
  }, [inApp])

  if (inApp === null) return null
  if (!inApp) return <OpenInMachine lang={lang} />

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{isAr ? "الإعدادات" : "Settings"}</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        {isAr ? "من أنت، وفي أي قسم تعمل، وأي وكيل يجيب." : "Who you are, which department you work in, and which agent answers."}
      </p>
      {error && <p className="text-destructive mt-4 text-sm">{error}</p>}
      {state && <SettingsForm isAr={isAr} initial={state.settings} drivers={state.drivers} departments={state.departments} />}
    </div>
  )
}
