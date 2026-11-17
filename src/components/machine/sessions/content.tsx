"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { PencilIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Locale } from "@/components/local/config"
import { OpenInMachine, useInMachine } from "../shell/content"
import { listSessions, removeSession, renameSession } from "./actions"
import type { Session } from "./types"

export default function SessionsContent({ lang }: { lang: Locale }) {
  const isAr = lang === "ar"
  const inApp = useInMachine()
  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setSessions(await listSessions())
    } catch (e) {
      setError(String(e))
    }
  }, [])

  useEffect(() => {
    if (inApp) void refresh()
  }, [inApp, refresh])

  if (inApp === null) return null
  if (!inApp) return <OpenInMachine lang={lang} />

  async function save(id: string) {
    try {
      await renameSession(id, draft)
      setEditing(null)
      await refresh()
    } catch (e) {
      setError(String(e))
    }
  }

  async function remove(id: string) {
    if (!window.confirm(isAr ? "حذف هذه الجلسة من القائمة؟" : "Remove this session from the list?")) return
    try {
      await removeSession(id)
      await refresh()
    } catch (e) {
      setError(String(e))
    }
  }

  const fmt = new Intl.DateTimeFormat(isAr ? "ar" : "en", { dateStyle: "medium", timeStyle: "short" })

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{isAr ? "الجلسات" : "Sessions"}</h1>
      {error && <p className="text-destructive mt-3 text-sm">{error}</p>}
      {sessions?.length === 0 && (
        <p className="text-muted-foreground mt-6 text-sm">
          {isAr ? "لا جلسات بعد. ابدأ محادثة من الصفحة الرئيسية." : "No sessions yet. Start a chat from the home page."}
        </p>
      )}
      <ul className="mt-6 space-y-2">
        {sessions?.map((s) => (
          <li key={s.id} className="border-border flex items-center gap-2 rounded-lg border p-3">
            {editing === s.id ? (
              <form
                className="flex flex-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  void save(s.id)
                }}
              >
                <Input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={120} autoFocus />
                <Button type="submit" size="sm">{isAr ? "حفظ" : "Save"}</Button>
              </form>
            ) : (
              <>
                <Link href={`/${lang}/machine?session=${encodeURIComponent(s.id)}`} className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.title}</div>
                  <div className="text-muted-foreground mt-0.5 text-xs">
                    {s.department} · {s.driver} · {fmt.format(new Date(s.updated_at * 1000))}
                  </div>
                </Link>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={isAr ? "إعادة تسمية" : "Rename"}
                  onClick={() => {
                    setEditing(s.id)
                    setDraft(s.title)
                  }}
                >
                  <PencilIcon />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={isAr ? "حذف" : "Remove"} onClick={() => void remove(s.id)}>
                  <Trash2Icon />
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
