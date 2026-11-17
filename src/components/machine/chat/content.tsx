"use client"

import { useEffect, useRef, useState } from "react"
import { SendIcon, SquareIcon, Volume2Icon, VolumeXIcon, WrenchIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { Locale } from "@/components/local/config"
import type { DriverKind, Event } from "../driver/types"
import { packInfo } from "../pack/actions"
import type { PackInfo } from "../pack/types"
import { getSession } from "../sessions/actions"
import { loadSettings } from "../settings/actions"
import type { Settings } from "../settings/types"
import { OpenInMachine, useInMachine } from "../shell/content"
import { speak, stopSpeaking } from "../voice/actions"
import { VoiceButton } from "../voice/content"
import { ask, stop } from "./actions"

interface Message {
  role: "user" | "assistant"
  text: string
  tools: string[]
  streaming?: boolean
  error?: string
}

export default function ChatContent({ lang, session: resume }: { lang: Locale; session?: string }) {
  const isAr = lang === "ar"
  const inApp = useInMachine()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [pack, setPack] = useState<PackInfo | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [session, setSession] = useState<string | null>(resume ?? null)
  const [resumed, setResumed] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [speakReplies, setSpeakReplies] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!inApp) return
    void (async () => {
      const s = await loadSettings()
      setSettings(s)
      if (s) setPack(await packInfo(s.department).catch(() => null))
      if (resume) setResumed((await getSession(resume).catch(() => null))?.title ?? null)
    })()
  }, [inApp, resume])

  useEffect(() => bottom.current?.scrollIntoView({ block: "end" }), [messages])

  if (inApp === null) return null
  if (!inApp) return <OpenInMachine lang={lang} />

  const busy = jobId !== null
  const driver: DriverKind | undefined = settings?.driver

  function patchLast(f: (m: Message) => Message) {
    setMessages((all) => all.map((m, i) => (i === all.length - 1 ? f(m) : m)))
  }

  function onEvent(e: Event) {
    switch (e.kind) {
      case "started":
        setSession(e.session)
        break
      case "text":
        patchLast((m) => ({ ...m, text: m.text ? `${m.text}\n\n${e.text}` : e.text }))
        break
      case "tool":
        patchLast((m) => ({ ...m, tools: [...m.tools, e.name] }))
        break
      case "done":
        if (e.session) setSession(e.session)
        if (speakReplies && e.ok && e.result) void speak(e.result, isAr ? "ar" : "en").catch(() => {})
        patchLast((m) => ({
          ...m,
          streaming: false,
          text: m.text || e.result || "",
          error: e.ok || e.result === "stopped" ? undefined : isAr ? "انتهى التنفيذ بخطأ." : "The run ended with an error.",
        }))
        break
      case "error":
        patchLast((m) => ({ ...m, streaming: false, error: e.message }))
        break
    }
  }

  async function send(prompt: string) {
    const text = prompt.trim()
    if (!text || busy) return
    const id = crypto.randomUUID()
    setInput("")
    setJobId(id)
    setMessages((all) => [
      ...all,
      { role: "user", text, tools: [] },
      { role: "assistant", text: "", tools: [], streaming: true },
    ])
    try {
      await ask(text, { jobId: id, session }, onEvent)
    } catch (err) {
      patchLast((m) => ({ ...m, streaming: false, error: String(err) }))
    } finally {
      patchLast((m) => ({ ...m, streaming: false }))
      setJobId(null)
    }
  }

  const name = settings?.person.trim()
  const greeting = isAr ? `أهلاً${name ? ` ${name}` : ""}، كيف أساعدك اليوم؟` : `Hello${name ? ` ${name}` : ""}, how can I help today?`
  const quick = pack?.quick_actions ?? []

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-4">
      <div className="flex-1 overflow-y-auto py-6">
        {messages.length === 0 ? (
          <div className="py-12 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">{greeting}</h1>
            {pack && <p className="text-muted-foreground mt-2 text-sm">{isAr ? pack.title_ar : pack.title_en}</p>}
            {resumed && (
              <p className="text-muted-foreground mt-2 text-sm">
                {isAr ? `تتابع الجلسة: ${resumed}` : `Continuing session: ${resumed}`}
              </p>
            )}
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {quick.map((q) => (
                <Button key={q.prompt} variant="outline" size="sm" onClick={() => void send(q.prompt)}>
                  {isAr ? q.label_ar : q.label_en}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="space-y-4">
            {messages.map((m, i) => (
              <li key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                <div
                  className={
                    m.role === "user"
                      ? "bg-primary text-primary-foreground max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap"
                      : "max-w-full text-sm"
                  }
                >
                  {m.tools.length > 0 && (
                    <details className="text-muted-foreground mb-2 text-xs">
                      <summary className="flex cursor-pointer items-center gap-1">
                        <WrenchIcon className="size-3" />
                        {isAr ? `${m.tools.length} خطوات` : `${m.tools.length} steps`}
                      </summary>
                      <ul className="mt-1 ps-4">
                        {m.tools.map((t, j) => (
                          <li key={j}>{t}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {m.text && <div className="whitespace-pre-wrap">{m.text}</div>}
                  {m.streaming && !m.text && <span className="text-muted-foreground">{isAr ? "يفكّر…" : "Thinking…"}</span>}
                  {m.error && <p className="text-destructive mt-1">{m.error}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div ref={bottom} />
      </div>

      <form
        className="border-border bg-background mb-4 rounded-2xl border p-2"
        onSubmit={(e) => {
          e.preventDefault()
          void send(input)
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void send(input)
            }
          }}
          rows={2}
          placeholder={isAr ? "اكتب رسالتك…" : "Type your message…"}
          className="resize-none border-0 shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center justify-between gap-2 px-1">
          {driver ? <Badge variant="secondary">{driver}</Badge> : <span />}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-pressed={speakReplies}
              aria-label={isAr ? "قراءة الردود بصوت" : "Read replies aloud"}
              onClick={() => {
                if (speakReplies) void stopSpeaking().catch(() => {})
                setSpeakReplies((on) => !on)
              }}
            >
              {speakReplies ? <Volume2Icon /> : <VolumeXIcon />}
            </Button>
            <VoiceButton lang={lang} onTranscript={(t) => setInput((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t))} />
            {busy ? (
              <Button type="button" size="icon-sm" variant="outline" aria-label={isAr ? "إيقاف" : "Stop"} onClick={() => jobId && void stop(jobId)}>
                <SquareIcon />
              </Button>
            ) : (
              <Button type="submit" size="icon-sm" disabled={!input.trim()} aria-label={isAr ? "إرسال" : "Send"}>
                <SendIcon className="rtl:-scale-x-100" />
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
