"use client"

import { useCallback, useEffect, useState } from "react"
import { ChevronDownIcon, DownloadIcon, HeartPulseIcon, RefreshCwIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { Locale } from "@/components/local/config"
import { OpenInMachine, PageShell, useInMachine } from "../shell/content"
import { engineHealth, engineState, engineStatus, engineUpdate } from "./actions"
import type { EngineStatus, HealthReport, LiveState, UpdateReport } from "./types"

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-muted/70 rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Mono({ text }: { text: string }) {
  return (
    <pre className="bg-background max-h-96 overflow-auto rounded-md p-3 text-xs leading-relaxed whitespace-pre-wrap" dir="ltr">
      {text}
    </pre>
  )
}

export default function EngineContent({ lang }: { lang: Locale }) {
  const isAr = lang === "ar"
  const inApp = useInMachine()
  const [status, setStatus] = useState<EngineStatus | null>(null)
  const [health, setHealth] = useState<HealthReport | null>(null)
  const [live, setLive] = useState<LiveState | null>(null)
  const [update, setUpdate] = useState<UpdateReport | null>(null)
  const [busy, setBusy] = useState<"status" | "update" | "health" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (key: "status" | "update" | "health", job: () => Promise<void>) => {
    setBusy(key)
    setError(null)
    try {
      await job()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(null)
    }
  }, [])

  const refresh = useCallback(
    () =>
      run("status", async () => {
        const [s, l] = await Promise.all([engineStatus(), engineState()])
        setStatus(s)
        setLive(l)
        if (s?.health) setHealth(s.health)
      }),
    [run]
  )

  useEffect(() => {
    if (inApp) void refresh()
  }, [inApp, refresh])

  if (inApp === null) return null
  if (!inApp)
    return (
      <PageShell lang={lang} title={isAr ? "المحرك" : "Engine"}>
        <OpenInMachine lang={lang} />
      </PageShell>
    )

  const behind = status?.behind
  return (
    <PageShell lang={lang} title={isAr ? "المحرك" : "Engine"}>
      <div className="space-y-4">
      <Card
        title={isAr ? "الإصدار والتحديث" : "Version & update"}
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void refresh()}>
              <RefreshCwIcon className="size-4" />
              {isAr ? "تحقق" : "Check"}
            </Button>
            <Button
              size="sm"
              disabled={busy !== null || !status?.exists || !behind}
              onClick={() =>
                void run("update", async () => {
                  setUpdate(await engineUpdate())
                  setStatus(await engineStatus())
                })
              }
            >
              <DownloadIcon className="size-4" />
              {busy === "update" ? (isAr ? "جارٍ التحديث…" : "Updating…") : isAr ? "حدّث" : "Update"}
            </Button>
          </div>
        }
      >
        {status ? (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <code dir="ltr" className="bg-muted rounded px-1.5 py-0.5 text-xs">
                {status.sha ?? "—"}
              </code>
              {status.branch && <Badge variant="outline">{status.branch}</Badge>}
              {behind === 0 && <Badge>{isAr ? "محدّث" : "Up to date"}</Badge>}
              {behind != null && behind > 0 && (
                <Badge variant="destructive">
                  {isAr ? `متأخر بـ ${behind}` : `${behind} behind`}
                </Badge>
              )}
              {status.dirty && <Badge variant="outline">{isAr ? "تعديلات محلية" : "Local changes"}</Badge>}
            </div>
            {status.subject && <p className="text-muted-foreground">{status.subject}</p>}
            <p className="text-muted-foreground text-xs" dir="ltr">
              {status.dir}
            </p>
            {status.note && <p className="text-xs">{status.note}</p>}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{busy ? (isAr ? "جارٍ الفحص…" : "Checking…") : "—"}</p>
        )}
        {update && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-medium">
              {update.ok
                ? update.up_to_date
                  ? isAr ? "لا جديد." : "Nothing new."
                  : isAr ? "تم التحديث." : "Updated."
                : isAr ? "تعذّر التحديث (لم يُغيَّر شيء بالقوة)." : "Update failed (nothing was forced)."}
            </p>
            <Mono text={update.output} />
          </div>
        )}
      </Card>

      <Card
        title={isAr ? "فحص الصحة" : "Health"}
        action={
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null || !status?.exists}
            onClick={() => void run("health", async () => setHealth(await engineHealth()))}
          >
            <HeartPulseIcon className="size-4" />
            {busy === "health" ? (isAr ? "جارٍ الفحص…" : "Running…") : isAr ? "شغّل الفحص" : "Run check"}
          </Button>
        }
      >
        {health ? (
          <Collapsible defaultOpen={!health.ok}>
            <CollapsibleTrigger className="mb-2 flex items-center gap-2 text-sm">
              <ChevronDownIcon className="size-4" />
              <Badge variant={health.ok ? "default" : "destructive"}>{health.ok ? (isAr ? "سليم" : "Healthy") : isAr ? "به مشاكل" : "Issues"}</Badge>
              <span className="text-muted-foreground text-xs" dir="ltr">
                {new Date(health.at * 1000).toLocaleTimeString()}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Mono text={health.output || "(no output)"} />
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <p className="text-muted-foreground text-sm">{isAr ? "لم يُشغَّل بعد." : "Not run yet."}</p>
        )}
      </Card>

      <Card title={isAr ? "الحالة الحيّة" : "Live state"}>
        {live?.exists ? <Mono text={live.text} /> : <p className="text-muted-foreground text-sm">{isAr ? "لا يوجد ملف حالة بعد." : "No state file yet."}</p>}
      </Card>

      {error && <p className="text-destructive text-sm">{error}</p>}
      </div>
    </PageShell>
  )
}
