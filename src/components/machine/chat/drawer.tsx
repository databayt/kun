"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BlocksIcon, CogIcon, MoreHorizontalIcon, SettingsIcon, SquarePenIcon } from "lucide-react"

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { Locale } from "@/components/local/config"
import { listSessions, removeSession } from "../sessions/actions"
import { groupSessions } from "../sessions/group"
import type { Session } from "../sessions/types"
import { copy, tr } from "./config"

/**
 * The ☰ drawer — ChatGPT's on iOS (mkan's agent/chats-sheet.tsx). The name in large bold type, round tiles
 * to the app's other pages, then the sessions under bold day heads, and a floating black "✎ Chat" pill
 * for a new chat. A row opens its session; ⋯ deletes it after an inline "Delete this chat?".
 */
export function ChatsDrawer({
  lang,
  open,
  onOpenChange,
  activeId,
  onOpenChat,
  onNewChat,
  onDeleted,
}: {
  lang: Locale
  open: boolean
  onOpenChange: (open: boolean) => void
  activeId: string | null
  onOpenChat: (id: string) => void
  onNewChat: () => void
  onDeleted: (id: string) => void
}) {
  const isAr = lang === "ar"
  const t = tr(isAr)
  const [sessions, setSessions] = useState<Session[] | null>(null)

  // Fresh on every open; the last list shows meanwhile.
  useEffect(() => {
    if (!open) return
    let live = true
    listSessions()
      .then((rows) => live && setSessions(rows))
      .catch(() => live && setSessions((prev) => prev ?? []))
    return () => {
      live = false
    }
  }, [open])

  const groups = useMemo(() => groupSessions(sessions ?? []), [sessions])

  const remove = async (id: string) => {
    setSessions((rows) => rows?.filter((s) => s.id !== id) ?? rows)
    await removeSession(id).catch(() => {})
    onDeleted(id)
  }

  const base = `/${lang}/machine`
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isAr ? "right" : "left"}
        dir={isAr ? "rtl" : "ltr"}
        className="w-[88%] max-w-[360px] gap-0 p-0 sm:max-w-[360px] [&>button:last-child]:hidden"
      >
        <SheetTitle className="sr-only">{t(copy.name)}</SheetTitle>
        <SheetDescription className="sr-only">{t(copy.menu)}</SheetDescription>

        <div className="flex h-16 shrink-0 items-center px-5 pt-2">
          <span className="text-[28px] font-bold tracking-tight text-foreground">{t(copy.name)}</span>
        </div>

        <nav aria-label={t(copy.menu)} className="flex-1 overflow-y-auto overscroll-contain px-2 pb-28">
          <ul className="grid list-none grid-cols-3 gap-2 border-b px-1 pb-5 pt-3">
            <Tile label={t(copy.tiles.catalog)} href={`${base}/catalog`}>
              <BlocksIcon aria-hidden />
            </Tile>
            <Tile label={t(copy.tiles.engine)} href={`${base}/engine`}>
              <CogIcon aria-hidden />
            </Tile>
            <Tile label={t(copy.tiles.settings)} href={`${base}/settings`}>
              <SettingsIcon aria-hidden />
            </Tile>
          </ul>

          {!sessions && (
            <ul aria-hidden className="space-y-2 px-3 pt-5">
              {[70, 55, 80, 45].map((w) => (
                <li key={w} className="h-4 animate-pulse rounded bg-muted" style={{ width: `${w}%` }} />
              ))}
            </ul>
          )}
          {sessions?.length === 0 && <p className="px-3 pt-5 text-sm text-muted-foreground">{t(copy.empty)}</p>}

          {groups.map(({ group, rows }) => (
            <section key={group} className="pt-6">
              <h3 className="px-3 pb-2 text-[17px] font-semibold text-foreground">{t(copy.groups[group])}</h3>
              <ul className="list-none">
                {rows.map((s) => (
                  <SessionRow key={s.id} session={s} isAr={isAr} active={s.id === activeId} onOpen={() => onOpenChat(s.id)} onDelete={() => void remove(s.id)} />
                ))}
              </ul>
            </section>
          ))}
        </nav>

        <div className="pointer-events-none relative h-0 shrink-0">
          <button
            type="button"
            onClick={onNewChat}
            className="pointer-events-auto absolute bottom-5 end-5 flex h-14 items-center gap-2.5 rounded-full bg-foreground px-6 text-[17px] font-medium text-background shadow-[0_6px_20px_rgba(0,0,0,0.25)] transition-transform active:scale-95"
          >
            <SquarePenIcon className="size-[22px]" aria-hidden />
            {t(copy.chat)}
            <span className="sr-only"> — {t(copy.newChat)}</span>
          </button>
        </div>
        <div className="h-[max(env(safe-area-inset-bottom),0px)] shrink-0" aria-hidden />
      </SheetContent>
    </Sheet>
  )
}

function Tile({ label, href, children }: { label: string; href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="group flex w-full flex-col items-center gap-2">
        <span className="flex size-16 items-center justify-center rounded-full bg-muted text-foreground transition-colors group-hover:bg-muted/70 [&_svg]:size-6">{children}</span>
        <span className="text-[13px] font-medium text-foreground">{label}</span>
      </Link>
    </li>
  )
}

function SessionRow({ session, isAr, active, onOpen, onDelete }: { session: Session; isAr: boolean; active: boolean; onOpen: () => void; onDelete: () => void }) {
  const t = tr(isAr)
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <li className="flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm">{t(copy.deleteConfirm)}</span>
        <button type="button" onClick={onDelete} className="rounded-full bg-destructive px-3 py-1 text-xs font-medium text-white">
          {t(copy.delete)}
        </button>
        <button type="button" autoFocus onClick={() => setConfirming(false)} className="rounded-full px-3 py-1 text-xs font-medium hover:bg-background">
          {t(copy.cancel)}
        </button>
      </li>
    )
  }

  return (
    <li className={cn("group flex items-center rounded-xl transition-colors", active ? "bg-muted" : "hover:bg-muted/60")}>
      <button type="button" onClick={onOpen} aria-current={active ? "page" : undefined} className="flex min-w-0 flex-1 items-center gap-2 py-3 ps-3 text-start text-[17px] text-foreground">
        <span dir="auto" className="truncate">
          {session.title}
        </span>
      </button>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={t(copy.options)}
        title={t(copy.options)}
        className="me-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-opacity hover:bg-background hover:text-foreground md:opacity-0 md:focus-visible:opacity-100 md:group-hover:opacity-100"
      >
        <MoreHorizontalIcon className="size-4" aria-hidden />
      </button>
    </li>
  )
}
