"use client"

import { useCallback, useEffect, useState } from "react"

import type { Locale } from "@/components/local/config"

import { OpenInMachine, PageShell, useInMachine } from "../shell/content"
import {
  cloneRepo,
  failureOf,
  listRepos,
  openRemote,
  pullRepo,
  removeRepo,
  setMode,
  setRemote,
  type RepoRow,
} from "./actions"
import { copy, lossesText } from "./config"

const link = "text-sm font-medium text-primary underline-offset-4 hover:underline disabled:opacity-50"

export default function ReposContent({ lang }: { lang: Locale }) {
  const isAr = lang === "ar"
  const inApp = useInMachine()
  const t = (k: { en: string; ar: string }) => (isAr ? k.ar : k.en)
  const [rows, setRows] = useState<RepoRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    listRepos()
      .then((r) => {
        setRows(r)
        setError(null)
      })
      .catch((e) => setError(failureOf(e).message))
  }, [])

  useEffect(() => {
    if (inApp) reload()
  }, [inApp, reload])

  if (inApp === false) return <OpenInMachine lang={lang} />

  return (
    <PageShell lang={lang} title={t(copy.title)}>
      <p className="text-muted-foreground">{t(copy.subtitle)}</p>
      {error && <p className="mt-6 text-sm text-destructive">{error}</p>}
      {!rows && !error && <p className="mt-6 text-muted-foreground">{t(copy.loading)}</p>}
      {rows && rows.length === 0 && <p className="mt-6 text-muted-foreground">{t(copy.empty)}</p>}
      {rows && rows.length > 0 && (
        <ul className="mt-6 flex flex-col gap-2 rounded-3xl bg-muted p-2">
          {rows.map((r) => (
            <Row key={r.name} row={r} isAr={isAr} onChanged={reload} />
          ))}
        </ul>
      )}
    </PageShell>
  )
}

function Row({ row, isAr, onChanged }: { row: RepoRow; isAr: boolean; onChanged: () => void }) {
  const t = (k: { en: string; ar: string }) => (isAr ? k.ar : k.en)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [losses, setLosses] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState("")

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    setLosses([])
    try {
      await fn()
      onChanged()
    } catch (e) {
      const f = failureOf(e)
      if (f.code === "refused") setLosses(lossesText(f.losses, isAr))
      else setError(f.message)
    } finally {
      setBusy(false)
      setProgress(null)
      setConfirming(false)
    }
  }

  const meta = row.local
    ? [
        row.branch,
        row.behind > 0 ? `↓${row.behind}` : null,
        row.ahead > 0 ? `↑${row.ahead}` : null,
        row.dirty ? t(copy.dirty) : t(copy.clean),
        row.mode === "sprint" ? t(copy.sprint) : t(copy.keep),
        row.private ? t(copy.private) : null,
      ]
    : [t(copy.notCloned), row.private ? t(copy.private) : null]

  return (
    <li className="rounded-2xl bg-background px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-xl font-bold tracking-tight">{row.name}</h2>
        <p className="text-sm text-muted-foreground">{meta.filter(Boolean).join(" · ")}</p>
      </div>
      {row.description && <p className="mt-1 text-sm text-muted-foreground">{row.description}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {!row.local ? (
          <>
            <button className={link} disabled={busy} onClick={() => run(() => cloneRepo(row.name, undefined, (e) => setProgress(e.message)))}>
              {busy ? t(copy.working) : t(copy.clone)}
            </button>
            <button className={link} disabled={busy} onClick={() => run(() => cloneRepo(row.name, 0, (e) => setProgress(e.message)))}>
              {t(copy.cloneFull)}
            </button>
          </>
        ) : (
          <>
            <button className={link} disabled={busy} onClick={() => run(() => pullRepo(row.name, (e) => setProgress(e.message)))}>
              {busy ? t(copy.working) : t(copy.pull)}
            </button>
            <button
              className={link}
              disabled={busy}
              onClick={() => run(() => (row.mode === "sprint" ? setMode(row.name, "keep") : setMode(row.name, "sprint", prompt(t(copy.sprintName)) ?? undefined)))}
            >
              {row.mode === "sprint" ? t(copy.keep) : t(copy.sprint)}
            </button>
            <button className={link} disabled={busy} onClick={() => setEditing((v) => !v)}>
              {t(copy.remote)}
            </button>
            {confirming ? (
              <span className="inline-flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">{t(copy.confirmRemove)}</span>
                <button className="font-medium text-destructive underline-offset-4 hover:underline" disabled={busy} onClick={() => run(() => removeRepo(row.name))}>
                  {t(copy.yes)}
                </button>
                <button className={link} onClick={() => setConfirming(false)}>
                  {t(copy.cancel)}
                </button>
              </span>
            ) : (
              <button className="text-sm font-medium text-destructive underline-offset-4 hover:underline disabled:opacity-50" disabled={busy} onClick={() => setConfirming(true)}>
                {t(copy.remove)}
              </button>
            )}
          </>
        )}
        <button className={link} onClick={() => openRemote(row.name)}>
          {t(copy.open)}
        </button>
      </div>

      {editing && (
        <form
          className="mt-3 flex items-center gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            run(() => setRemote(row.name, url.trim())).then(() => setEditing(false))
          }}
        >
          <input
            dir="ltr"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t(copy.remoteHint)}
            aria-label={t(copy.remote)}
            className="h-9 min-w-0 flex-1 rounded-full bg-muted px-4 text-sm outline-none"
          />
          <button type="submit" className={link} disabled={busy || !url.trim()}>
            {t(copy.save)}
          </button>
        </form>
      )}

      {progress && <p className="mt-2 text-xs text-muted-foreground" dir="ltr">{progress}</p>}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {losses.length > 0 && (
        <div className="mt-2 text-sm text-destructive">
          <p className="font-medium">{t(copy.refused)}</p>
          <ul className="list-disc ps-5">
            {losses.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}
