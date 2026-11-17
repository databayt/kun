"use client"

// The machine app shell: the page frame the secondary pages share (catalog, engine, settings),
// and the "open in machine" state every machine page shows when it is loaded in a plain browser.
import { useEffect, useState } from "react"
import Link from "next/link"
import { isTauri } from "@tauri-apps/api/core"
import { ChevronLeftIcon } from "lucide-react"

import type { Locale } from "@/components/local/config"
import { copy, tr } from "../chat/config"

/** null while unknown (first render), then whether the page runs inside the machine app. */
export function useInMachine(): boolean | null {
  const [inApp, setInApp] = useState<boolean | null>(null)
  useEffect(() => setInApp(isTauri()), [])
  return inApp
}

/**
 * A secondary page: no bar, only the floating menu button above it. A scrolling column as wide as the
 * chat's, the title as its first line, and an optional small link back (the catalog's item pages).
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
  /** A small link above the title (item page → catalog). None by default: the menu is the way around. */
  backHref?: string
  backLabel?: string
  children: React.ReactNode
}) {
  return (
    <div className="h-full overflow-y-auto overscroll-contain bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-[max(4.5rem,calc(env(safe-area-inset-top)+3.75rem))]">
        {backHref && (
          <Link href={backHref} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ChevronLeftIcon className="size-4 rtl:rotate-180" aria-hidden />
            {backLabel}
          </Link>
        )}
        <h1 className="mb-4 text-balance text-2xl font-semibold tracking-tight">{title}</h1>
        {children}
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
