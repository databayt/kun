"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { ArrowDownIcon, CheckIcon, MoreHorizontalIcon, RotateCcwIcon, SquarePenIcon, Trash2Icon, Volume2Icon } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { Locale } from "@/components/local/config"
import type { DriverKind, DriverStatus, Event } from "../driver/types"
import { packInfo } from "../pack/actions"
import type { PackInfo } from "../pack/types"
import { getSession, removeSession } from "../sessions/actions"
import { detectDrivers, loadSettings, saveSettings } from "../settings/actions"
import type { Settings } from "../settings/types"
import { OpenInMachine, useInMachine } from "../shell/content"
import { ChatHeader, headerButton, MenuGlyph } from "../shell/header"
import { storedLang, swapLocale } from "../shell/lang"
import { speak, stopSpeaking } from "../voice/actions"
import { ask, stop } from "./actions"
import { ActivityRows, StatusLine } from "./activity"
import { Composer } from "./composer"
import { copy, greeting, tr } from "./config"
import { Suggestions } from "./suggestions"
import { AgentTurn, Prose, TurnActions, UserTurn } from "./turn"
import { useStickToBottom } from "./use-stick-to-bottom"

// The ☰ drawer loads on its first open; a person who never opens it never pays for it.
const ChatsDrawer = dynamic(() => import("./drawer").then((m) => m.ChatsDrawer), { ssr: false })

interface Message {
  role: "user" | "assistant"
  text: string
  /** Finished tool steps, in order. */
  tools: string[]
  /** The tool running now. */
  live: string | null
  streaming?: boolean
  error?: string
}

const menuItem = "gap-2.5 rounded-xl px-3 py-2.5 text-[15px]"

/**
 * The machine's home — the chat in mkan's /find shell: a slim bar (☰ · name · ✎ · ⋯), the greeting
 * mid-screen with starter cards above a pill composer pinned to the bottom, user bubbles, plain agent
 * text, folded tool steps and an orange working line.
 */
export default function ChatContent({ lang, session: resume }: { lang: Locale; session?: string }) {
  const isAr = lang === "ar"
  const t = tr(isAr)
  const router = useRouter()
  const inApp = useInMachine()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [drivers, setDrivers] = useState<DriverStatus[]>([])
  const [pack, setPack] = useState<PackInfo | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [session, setSession] = useState<string | null>(resume ?? null)
  const [resumed, setResumed] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [speakReplies, setSpeakReplies] = useState(false)
  const [drawer, setDrawer] = useState<"never" | "open" | "closed">("never")
  const speakRef = useRef(false)
  speakRef.current = speakReplies

  // The language chosen in Settings opens the app next time: a stored one that differs from the URL wins.
  useEffect(() => {
    const stored = storedLang()
    if (stored && stored !== lang) router.replace(swapLocale(window.location.pathname, window.location.search, stored))
  }, [lang, router])

  useEffect(() => {
    if (!inApp) return
    void (async () => {
      const s = await loadSettings()
      setSettings(s)
      if (s) setPack(await packInfo(s.department).catch(() => null))
      setDrivers(await detectDrivers().catch(() => []))
      if (resume) setResumed((await getSession(resume).catch(() => null))?.title ?? null)
    })()
  }, [inApp, resume])

  const busy = jobId !== null
  const last = messages.at(-1)
  const { ref: scrollRef, onScroll, away, scrolled, scrollToBottom } = useStickToBottom(`${messages.length}.${last?.text.length ?? 0}.${last?.tools.length ?? 0}.${last?.live}`)

  const patchLast = useCallback((f: (m: Message) => Message) => {
    setMessages((all) => all.map((m, i) => (i === all.length - 1 ? f(m) : m)))
  }, [])

  const onEvent = useCallback(
    (e: Event) => {
      // A tool still running when the next thing arrives has finished.
      const settle = (m: Message): Message => (m.live ? { ...m, tools: [...m.tools, m.live], live: null } : m)
      switch (e.kind) {
        case "started":
          setSession(e.session)
          break
        case "text":
          patchLast((m) => ({ ...settle(m), text: m.text ? `${m.text}\n\n${e.text}` : e.text }))
          break
        case "tool":
          patchLast((m) => ({ ...settle(m), live: e.name }))
          break
        case "done":
          if (e.session) setSession(e.session)
          if (speakRef.current && e.ok && e.result) void speak(e.result, isAr ? "ar" : "en").catch(() => {})
          patchLast((m) => ({
            ...settle(m),
            streaming: false,
            text: m.text || e.result || "",
            error: e.ok || e.result === "stopped" ? undefined : t(copy.runError),
          }))
          break
        case "error":
          patchLast((m) => ({ ...settle(m), streaming: false, error: e.message }))
          break
      }
    },
    [patchLast, isAr, t]
  )

  const send = useCallback(
    async (prompt: string, base: Message[] = messages) => {
      const text = prompt.trim()
      if (!text || busy) return
      const id = crypto.randomUUID()
      setJobId(id)
      setMessages([...base, { role: "user", text, tools: [], live: null }, { role: "assistant", text: "", tools: [], live: null, streaming: true }])
      requestAnimationFrame(() => scrollToBottom())
      try {
        await ask(text, { jobId: id, session }, onEvent)
      } catch (err) {
        patchLast((m) => ({ ...m, streaming: false, error: String(err) }))
      } finally {
        patchLast((m) => ({ ...m, streaming: false, tools: m.live ? [...m.tools, m.live] : m.tools, live: null }))
        setJobId(null)
      }
    },
    [messages, busy, session, onEvent, patchLast, scrollToBottom]
  )

  /** Runs the last prompt again, in place of the failed answer. */
  const retry = () => {
    const i = messages.findLastIndex((m) => m.role === "user")
    if (i >= 0) void send(messages[i]!.text, messages.slice(0, i))
  }

  const newChat = () => {
    if (busy) return
    setMessages([])
    setSession(null)
    setResumed(null)
    setDrawer((v) => (v === "never" ? v : "closed"))
    if (resume) router.replace(`/${lang}/machine`)
  }

  const deleteChat = async () => {
    if (!session || !window.confirm(t(copy.deleteConfirm))) return
    await removeSession(session).catch(() => {})
    newChat()
  }

  const pickDriver = async (driver: DriverKind) => {
    if (!settings || settings.driver === driver) return
    setSettings(await saveSettings({ ...settings, driver }).catch(() => settings))
  }

  if (inApp === null) return null
  if (!inApp) return <OpenInMachine lang={lang} />

  const empty = messages.length === 0
  const name = settings?.person.trim()
  const label = pack ? (isAr ? pack.title_ar : pack.title_en) : undefined
  const quick = pack?.quick_actions ?? []

  return (
    <div className="flex h-full flex-col overflow-x-clip bg-background">
      <ChatHeader
        title={t(copy.name)}
        label={label}
        scrolled={scrolled}
        start={
          <button type="button" onClick={() => setDrawer("open")} aria-label={t(copy.menu)} title={t(copy.menu)} className={headerButton}>
            <MenuGlyph />
          </button>
        }
        end={
          <>
            <button type="button" onClick={newChat} disabled={empty || busy} aria-label={t(copy.newChat)} title={t(copy.newChat)} className={headerButton}>
              <SquarePenIcon aria-hidden />
            </button>
            <DropdownMenu dir={isAr ? "rtl" : "ltr"}>
              <DropdownMenuTrigger className={headerButton} aria-label={t(copy.more)} title={t(copy.more)}>
                <MoreHorizontalIcon aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56 rounded-2xl p-1.5">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    if (speakReplies) void stopSpeaking().catch(() => {})
                    setSpeakReplies((on) => !on)
                  }}
                  className={menuItem}
                >
                  <Volume2Icon className="size-4" aria-hidden />
                  <span className="flex-1">{t(copy.readAloud)}</span>
                  {speakReplies && <CheckIcon className="size-4" aria-hidden />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="px-3 pb-1 pt-2 text-xs font-normal text-muted-foreground">{t(copy.driver)}</DropdownMenuLabel>
                {drivers.map((d) => (
                  <DropdownMenuItem key={d.kind} disabled={!d.installed} onSelect={() => void pickDriver(d.kind)} className={menuItem}>
                    <span dir="ltr" className="flex-1 text-start">{d.kind}</span>
                    <span className="text-xs text-muted-foreground">{d.installed ? t(copy.installed) : t(copy.notInstalled)}</span>
                    {settings?.driver === d.kind && <CheckIcon className="size-4" aria-hidden />}
                  </DropdownMenuItem>
                ))}
                {session && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled={busy} onSelect={() => void deleteChat()} className={cn(menuItem, "text-destructive focus:text-destructive")}>
                      <Trash2Icon className="size-4 text-current" aria-hidden />
                      {t(copy.deleteChat)}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={scrollRef} onScroll={onScroll} className="relative flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          {empty ? (
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center px-4 py-6">
              <h1 className="text-balance text-center text-[26px] font-semibold leading-tight tracking-tight sm:text-3xl">{greeting(isAr, name)}</h1>
              {resumed && (
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  {t(copy.continuing)}: {resumed}
                </p>
              )}
            </div>
          ) : (
            <ol className="mx-auto w-full max-w-3xl list-none space-y-7 px-4 pb-6 pt-4">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <UserTurn key={i} text={m.text} />
                ) : (
                  <AgentTurn key={i} steps={<ActivityRows done={m.tools} live={m.live} isAr={isAr} />}>
                    {m.text && <Prose text={m.text} />}
                    {m.error && (
                      <p role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-destructive">
                        <span dir="auto">{m.error}</span>
                        {i === messages.length - 1 && !busy && (
                          <button type="button" onClick={retry} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 font-medium text-foreground transition-colors hover:bg-muted/70">
                            <RotateCcwIcon className="size-3.5" aria-hidden />
                            {t(copy.retry)}
                          </button>
                        )}
                      </p>
                    )}
                    {m.streaming && <StatusLine isAr={isAr} seed={String(i)} />}
                    {!m.streaming && m.text && !m.error && <TurnActions text={m.text} isAr={isAr} />}
                  </AgentTurn>
                )
              )}
            </ol>
          )}
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-3xl px-3 pb-[max(env(safe-area-inset-bottom),10px)] sm:px-4">
        {away && (
          <button
            type="button"
            onClick={() => scrollToBottom()}
            aria-label={t(copy.scrollDown)}
            className="absolute -top-14 start-1/2 flex size-10 -translate-x-1/2 items-center justify-center rounded-full border border-border/60 bg-background shadow-[0_2px_10px_rgba(0,0,0,0.12)] rtl:translate-x-1/2"
          >
            <ArrowDownIcon className="size-5" aria-hidden />
          </button>
        )}
        {empty && (
          <div className="pb-5">
            <Suggestions actions={quick} isAr={isAr} onPick={(p) => void send(p)} disabled={busy} />
          </div>
        )}
        <Composer lang={lang} onSend={(text) => void send(text)} onStop={() => jobId && void stop(jobId)} busy={busy} actions={quick} autoFocus />
        <div className="h-2" aria-hidden />
      </div>

      {drawer !== "never" && (
        <ChatsDrawer
          lang={lang}
          open={drawer === "open"}
          onOpenChange={(o) => setDrawer(o ? "open" : "closed")}
          activeId={session}
          onOpenChat={(id) => {
            setDrawer("closed")
            router.push(`/${lang}/machine?s=${encodeURIComponent(id)}`)
          }}
          onNewChat={() => {
            setDrawer("closed")
            newChat()
            router.push(`/${lang}/machine`)
          }}
          onDeleted={(id) => id === session && newChat()}
        />
      )}
    </div>
  )
}

