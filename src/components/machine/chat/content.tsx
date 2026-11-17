"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowDownIcon, RotateCcwIcon } from "lucide-react"

import type { Locale } from "@/components/local/config"
import type { Event } from "../driver/types"
import { packInfo } from "../pack/actions"
import type { PackInfo } from "../pack/types"
import { CHAT_DELETED_EVENT, NEW_CHAT_EVENT } from "../menu/config"
import { useReadAloud } from "../menu/use-read-aloud"
import { getSession } from "../sessions/actions"
import { loadSettings } from "../settings/actions"
import type { Settings } from "../settings/types"
import { OpenInMachine, useInMachine } from "../shell/content"
import { storedLang, swapLocale } from "../shell/lang"
import { speak } from "../voice/actions"
import { ask, stop } from "./actions"
import { ActivityRows, StatusLine } from "./activity"
import { Composer } from "./composer"
import { copy, greeting, tr } from "./config"
import { Suggestions } from "./suggestions"
import { AgentTurn, Prose, TurnActions, UserTurn } from "./turn"
import { useStickToBottom } from "./use-stick-to-bottom"

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

/**
 * The machine's home — the chat in mkan's /find shell, with no bar: the greeting mid-screen with
 * starter cards above a pill composer pinned to the bottom, user bubbles, plain agent text, folded tool
 * steps and an orange working line. The mega menu (layout) holds chats, lanes and settings.
 */
export default function ChatContent({ lang, session: resume, prompt }: { lang: Locale; session?: string; prompt?: string }) {
  const isAr = lang === "ar"
  const t = tr(isAr)
  const router = useRouter()
  const inApp = useInMachine()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [pack, setPack] = useState<PackInfo | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [session, setSession] = useState<string | null>(resume ?? null)
  const [resumed, setResumed] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [speakReplies] = useReadAloud()
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
      if (resume) setResumed((await getSession(resume).catch(() => null))?.title ?? null)
    })()
  }, [inApp, resume])

  const busy = jobId !== null
  const last = messages.at(-1)
  const { ref: scrollRef, onScroll, away, scrollToBottom } = useStickToBottom(`${messages.length}.${last?.text.length ?? 0}.${last?.tools.length ?? 0}.${last?.live}`)

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
    if (resume) router.replace(`/${lang}/machine`)
  }

  // The menu's "New chat" and its delete both reach the open chat through window events.
  const newChatRef = useRef(newChat)
  newChatRef.current = newChat
  const sessionRef = useRef(session)
  sessionRef.current = session
  useEffect(() => {
    const onNew = () => newChatRef.current()
    const onDeleted = (e: globalThis.Event) => {
      if ((e as CustomEvent<string>).detail === sessionRef.current) newChatRef.current()
    }
    window.addEventListener(NEW_CHAT_EVENT, onNew)
    window.addEventListener(CHAT_DELETED_EVENT, onDeleted)
    return () => {
      window.removeEventListener(NEW_CHAT_EVENT, onNew)
      window.removeEventListener(CHAT_DELETED_EVENT, onDeleted)
    }
  }, [])

  if (inApp === null) return null
  if (!inApp) return <OpenInMachine lang={lang} />

  const empty = messages.length === 0
  const name = settings?.person.trim()
  const quick = pack?.quick_actions ?? []

  return (
    <div className="flex h-full flex-col overflow-x-clip bg-background">
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
            <ol className="mx-auto w-full max-w-3xl list-none space-y-7 px-4 pb-6 pt-16">
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
        <Composer lang={lang} onSend={(text) => void send(text)} onStop={() => jobId && void stop(jobId)} busy={busy} actions={quick} initialText={prompt} autoFocus />
        <div className="h-2" aria-hidden />
      </div>
    </div>
  )
}

