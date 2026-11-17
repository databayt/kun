"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { ArrowUpIcon, PlusIcon, SquareIcon } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { Locale } from "@/components/local/config"
import type { QuickAction } from "../pack/types"
import { VoiceButton } from "../voice/content"
import { copy, tr } from "./config"

/** About six lines of text before the box scrolls. */
const MAX_HEIGHT_PX = 168

/**
 * The composer of ChatGPT on iOS (mkan's agent/composer.tsx): a grey round `+` beside a grey pill whose
 * textarea grows to six lines. Inside the pill's end sit the mic and one black round button: send, or a
 * stop square while a turn runs. `+` opens the quick actions. Enter sends, Shift+Enter breaks a line.
 */
export function Composer({
  lang,
  onSend,
  onStop,
  busy,
  actions,
  autoFocus,
  initialText,
}: {
  lang: Locale
  onSend: (text: string) => void
  onStop: () => void
  busy: boolean
  actions: QuickAction[]
  autoFocus?: boolean
  /** Fills the box without sending (a starter from the menu). */
  initialText?: string
}) {
  const isAr = lang === "ar"
  const t = tr(isAr)
  const [text, setText] = useState(initialText ?? "")
  const [plus, setPlus] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  // `field-sizing: content` is not in Safari yet.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`
  }, [text])

  // A starter fills the box; the caret goes to its end so the person carries on typing.
  useEffect(() => {
    const el = ref.current
    if (el && initialText) el.setSelectionRange(el.value.length, el.value.length)
  }, [initialText])

  const canSend = !busy && !!text.trim()
  const submit = () => {
    if (!canSend) return
    onSend(text)
    setText("")
  }
  const round = "flex size-10 shrink-0 items-center justify-center rounded-full transition-colors"

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="flex items-end gap-x-2"
    >
      {actions.length > 0 && (
        <Popover open={plus} onOpenChange={setPlus}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t(copy.quick)}
              title={t(copy.quick)}
              className={cn(
                "flex size-[52px] shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-muted/70",
                plus && "bg-foreground text-background hover:bg-foreground/90"
              )}
            >
              <PlusIcon className={cn("size-6 transition-transform", plus && "rotate-45")} strokeWidth={1.75} aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" dir={isAr ? "rtl" : "ltr"} className="w-72 max-w-[calc(100vw-2rem)] rounded-2xl p-1.5">
            <p className="px-3 pb-1 pt-2 text-sm font-semibold">{t(copy.quick)}</p>
            <ul>
              {actions.map((q) => (
                <li key={q.prompt}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setPlus(false)
                      onSend(q.prompt)
                    }}
                    className="w-full rounded-xl px-3 py-2.5 text-start text-[15px] transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    {isAr ? q.label_ar : q.label_en}
                  </button>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
      <div className="flex min-h-[52px] min-w-0 flex-1 items-end gap-1 rounded-[26px] bg-muted p-1.5 ps-5 transition-shadow focus-within:ring-1 focus-within:ring-border">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          rows={1}
          maxLength={4000}
          autoFocus={autoFocus}
          enterKeyHint="send"
          dir="auto"
          placeholder={t(copy.placeholder)}
          aria-label={t(copy.placeholder)}
          className="min-w-0 flex-1 resize-none self-center bg-transparent py-1.5 text-[17px] leading-6 outline-none placeholder:text-muted-foreground md:text-base"
        />
        {!busy && <VoiceButton lang={lang} onTranscript={(v) => setText((prev) => (prev.trim() ? `${prev.trim()} ${v}` : v))} />}
        {busy ? (
          <button type="button" onClick={onStop} aria-label={t(copy.stop)} title={t(copy.stop)} className={cn(round, "bg-foreground text-background")}>
            <SquareIcon className="size-3.5 fill-current" aria-hidden />
          </button>
        ) : (
          <button type="submit" aria-label={t(copy.send)} disabled={!canSend} className={cn(round, "bg-foreground text-background disabled:bg-foreground/20")}>
            <ArrowUpIcon className="size-5" strokeWidth={2.5} aria-hidden />
          </button>
        )}
      </div>
    </form>
  )
}
