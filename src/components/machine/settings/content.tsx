"use client"

import { useEffect, useState } from "react"

import type { Locale } from "@/components/local/config"
import type { DriverStatus } from "../driver/types"
import { departments as listDepartments } from "../pack/actions"
import { OpenInMachine, PageShell, useInMachine } from "../shell/content"
import { detectDrivers, loadSettings } from "./actions"
import { SettingsForm } from "./form"
import { LanguageToggle } from "./language"
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

  const title = isAr ? "الإعدادات" : "Settings"
  return (
    <PageShell lang={lang} title={title}>
      <div className="space-y-6">
        <LanguageToggle lang={lang} />
        {!inApp ? (
          <OpenInMachine lang={lang} />
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              {isAr ? "من أنت، وفي أي قسم تعمل، وأي وكيل يجيب." : "Who you are, which department you work in, and which agent answers."}
            </p>
            {error && <p className="text-destructive text-sm">{error}</p>}
            {state && <SettingsForm isAr={isAr} initial={state.settings} drivers={state.drivers} departments={state.departments} />}
          </>
        )}
      </div>
    </PageShell>
  )
}
