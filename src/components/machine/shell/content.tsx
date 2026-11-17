"use client"

// The machine app shell: the page bar the secondary pages share (catalog, engine, settings),
// and the "open in machine" state every machine page shows when it is loaded in a plain browser.
import { useEffect, useState } from "react"
import Link from "next/link"
import { isTauri } from "@tauri-apps/api/core"
import { ChevronLeftIcon } from "lucide-react"

import type { Locale } from "@/components/local/config"
import { copy, tr } from "../chat/config"
import { ChatHeader, headerButton } from "./header"

/** null while unknown (first render), then whether the page runs inside the machine app. */
export function useInMachine(): boolean | null {
  const [inApp, setInApp] = useState<boolean | null>(null)
  useEffect(() => setInApp(isTauri()), [])
  return inApp
}

/**
 * A secondary page in the chat's frame: the same bar (‹ back to the chat · title start-aligned),
 * then a scrolling column as wide as the chat's.
 */
export function PageShell({
  lang,
  title,
  backHref,
  backLabel,
  children,
}: {
  lang: Locale
  title: string
  /** Where ‹ goes; the chat by default. */
  backHref?: string
  backLabel?: string
  children: React.ReactNode
}) {
  const t = tr(lang === "ar")
  const [scrolled, setScrolled] = useState(false)
  const label = backLabel ?? t(copy.back)
  return (
    <div className="flex h-full flex-col bg-background">
      <ChatHeader
        title={title}
        scrolled={scrolled}
        start={
          <Link href={backHref ?? `/${lang}/machine`} aria-label={label} title={label} className={headerButton}>
            <ChevronLeftIcon className="rtl:rotate-180" aria-hidden />
          </Link>
        }
      />
      <div onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-4">{children}</div>
      </div>
    </div>
  )
}

/** Outside the app: the greeting's place, one sentence, one black pill. */
export function OpenInMachine({ lang }: { lang: Locale }) {
  const t = tr(lang === "ar")
  return (
    <div className="mx-auto flex h-full min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center gap-3 px-4 py-6 text-center">
      <h1 className="text-balance text-[26px] font-semibold leading-tight tracking-tight sm:text-3xl">{t(copy.openTitle)}</h1>
      <p className="max-w-md text-balance text-muted-foreground">{t(copy.openText)}</p>
      <Link
        href={`/${lang}/machine/catalog`}
        className="mt-3 flex h-12 items-center rounded-full bg-foreground px-6 text-[17px] font-medium text-background transition-colors hover:bg-foreground/90"
      >
        {t(copy.openButton)}
      </Link>
    </div>
  )
}
