"use client"

import { useEffect, useState } from "react"
import { ChevronRightIcon, ListIcon, WrenchIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { playfulWord, summarize } from "./activity-pure"
import { copy, tr, words } from "./config"

/** The agent's thinking mark: three dots that tumble (globals.css `.machine-dots`), in the line's colour. */
export function Dots({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("machine-dots", className)}>
      <i />
      <i />
      <i />
    </span>
  )
}

const row = "group flex max-w-full items-center gap-3 text-start text-[17px] leading-7 text-muted-foreground transition-colors hover:text-foreground md:text-base"
const icon = "size-[21px] shrink-0"

/**
 * The tools of a turn, the Claude iOS way: finished steps fold into one grey row ("Used Read, Bash +2")
 * that opens the list; the step running now is a live row, its name shimmering.
 */
export function ActivityRows({ done, live, isAr }: { done: string[]; live: string | null; isAr: boolean }) {
  const t = tr(isAr)
  const [open, setOpen] = useState(false)
  if (done.length === 0 && !live) return null

  const { head, rest } = summarize(done)
  const used = isAr ? "استخدم" : "Used"
  const headline = `${used} ${head.join(isAr ? "، " : ", ")}${rest ? ` +${rest}` : ""}`
  const toggle = open ? t(copy.hideSteps) : t(copy.showSteps)
  const chevron = <ChevronRightIcon className={cn("size-[18px] shrink-0 opacity-70 transition-transform", open ? "rotate-90" : "rtl:rotate-180")} aria-hidden />

  return (
    <div className="space-y-2">
      {done.length > 0 && (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={row}>
          <ListIcon className={icon} aria-hidden />
          <span dir="auto" className="min-w-0 truncate">{headline}</span>
          <span dir="ltr" className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[13px] font-medium tabular-nums">{done.length}</span>
          {chevron}
          <span className="sr-only">{toggle}</span>
        </button>
      )}
      {live && (
        <div className={cn(row, "hover:text-muted-foreground")}>
          <WrenchIcon className={icon} aria-hidden />
          <span dir="ltr" className="machine-shimmer min-w-0 truncate">{live}</span>
        </div>
      )}
      {open && done.length > 0 && (
        <ol className="ms-[10px] list-none space-y-2 border-s ps-4 text-[15px] leading-6 text-muted-foreground md:text-sm">
          {done.map((name, i) => (
            <li key={i} dir="ltr" className="flex items-start gap-2.5 text-start">
              <WrenchIcon className="mt-[0.2em] size-4 shrink-0" aria-hidden />
              <span className="min-w-0">{name}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** The orange line under a running turn: tumbling dots, a word that changes every 2.5 s, and the seconds from 3 s. */
export function StatusLine({ isAr, seed }: { isAr: boolean; seed: string }) {
  const t = tr(isAr)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 500)
    return () => window.clearInterval(id)
  }, [])
  const word = playfulWord(isAr ? words.ar : words.en, seed, Math.floor(tick / 5))
  const seconds = Math.floor(tick / 2)

  return (
    <div role="status" className="flex min-w-0 items-center gap-2.5 text-[17px] leading-7 text-working md:text-base">
      <Dots className="text-[1.05em]" />
      <span className="sr-only">{t(copy.working)}</span>
      <span className="min-w-0 truncate">
        <span aria-hidden key={word} className="inline-block animate-in fade-in duration-500 motion-reduce:animate-none">
          {word}
        </span>
        {seconds >= 3 && (
          <span aria-hidden className="tabular-nums text-muted-foreground">
            {" · "}
            {isAr ? `${seconds} ث` : `${seconds}s`}
          </span>
        )}
      </span>
    </div>
  )
}
