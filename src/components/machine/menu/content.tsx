"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { BlocksIcon, CogIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import type { Locale } from "@/components/local/config"
import { tr } from "../chat/config"
import { loadSettings } from "../settings/actions"
import type { Settings } from "../settings/types"
import { useInMachine } from "../shell/content"
import { Chats } from "./chats"
import { copy } from "./config"
import { InlineSettings } from "./inline-settings"
import { Knowledge, Lanes } from "./lanes"
import { getProfile, type MachineProfile } from "../profile/actions"
import { rowClass, Section } from "./section"

/**
 * The only chrome of the machine app: a floating two-line button at the top start corner that opens a
 * full-page mega menu. Ported from space's MobileNav — the native <dialog> gives showModal(), Esc, a
 * focus trap and an inert page behind it; it closes on navigation and on any link click.
 */
export function MachineMenu({ lang }: { lang: Locale }) {
  const isAr = lang === "ar"
  const t = tr(isAr)
  const inApp = useInMachine()
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()
  const active = useSearchParams().get("s")
  const [shown, setShown] = useState(false)
  const [profile, setProfile] = useState<MachineProfile | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)

  // Navigating closes the menu.
  useEffect(() => {
    dialog.current?.close()
  }, [pathname])

  useEffect(() => {
    if (!inApp) return
    getProfile().then(setProfile).catch(() => setProfile(null))
    loadSettings().then(setSettings).catch(() => setSettings(null))
  }, [inApp])

  const open = () => {
    dialog.current?.showModal()
    document.documentElement.style.overflow = "hidden"
    setShown(true)
  }
  const close = () => dialog.current?.close()

  // null profile (outside the app, or none set) = full access.
  const showCatalog = !profile || profile.access.catalog === "all" || profile.access.catalog === "profile"
  const showEngine = inApp === true && (!profile || profile.access.engine)
  const who = profile?.name || settings?.person.trim() || ""
  const dept = profile
    ? profile.departments.map((d) => (isAr && d.title_ar) || d.title).join(" · ")
    : (settings?.department ?? "")

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={open}
        aria-label={t(copy.open)}
        aria-haspopup="dialog"
        className="fixed start-3 top-[max(0.75rem,env(safe-area-inset-top))] z-40 inline-flex size-11 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-muted"
      >
        {/* Two-line menu mark, as in space. */}
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="size-6">
          <path d="M4 8h16M4 16h16" />
        </svg>
      </button>

      <dialog
        ref={dialog}
        aria-label={t(copy.title)}
        dir={isAr ? "rtl" : "ltr"}
        onClose={() => {
          document.documentElement.style.overflow = ""
          trigger.current?.focus()
        }}
        onClick={(e) => {
          // Links inside close it; so does a click on the backdrop.
          if (e.target === e.currentTarget || (e.target as HTMLElement).closest("a")) close()
        }}
        className="m-0 h-dvh max-h-none w-full max-w-none bg-background p-0 text-foreground backdrop:bg-foreground/30 open:flex open:flex-col open:animate-in open:fade-in-0"
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)] sm:px-6">
          <div className="flex min-w-0 items-baseline gap-3">
            <p className="font-heading text-2xl font-bold tracking-tight">{t({ en: "Kun", ar: "كن" })}</p>
            {(who || dept) && (
              <p dir="auto" className="truncate text-sm text-muted-foreground">
                {[who, dept].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <button type="button" onClick={close} aria-label={t(copy.close)} className="inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-foreground/5">
            <XIcon aria-hidden className="size-6" />
          </button>
        </div>

        <nav aria-label={t(copy.title)} className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
          <div className="mx-auto grid max-w-6xl items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            {inApp ? (
              <>
                <Chats lang={lang} activeId={active} open={shown} />
                {profile && <Lanes lang={lang} profile={profile} />}
                <Knowledge lang={lang} repos={profile ? profile.repos : null} />
              </>
            ) : (
              <p className="rounded-3xl bg-muted/50 p-4 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">{t(copy.appOnly)}</p>
            )}
            <InlineSettings lang={lang} profile={profile} inApp={inApp === true} />
            {(showCatalog || showEngine) && (
              <Section title={t({ en: "More", ar: "المزيد" })}>
                {showCatalog && (
                  <Link href={`/${lang}/machine/catalog`} className={cn(rowClass, "gap-3")}>
                    <BlocksIcon className="size-5 shrink-0" aria-hidden />
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">{t(copy.catalog)}</span>
                      <span className="truncate text-xs text-muted-foreground">{t(copy.catalogHint)}</span>
                    </span>
                  </Link>
                )}
                {showEngine && (
                  <Link href={`/${lang}/machine/engine`} className={cn(rowClass, "gap-3")}>
                    <CogIcon className="size-5 shrink-0" aria-hidden />
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">{t(copy.engine)}</span>
                      <span className="truncate text-xs text-muted-foreground">{t(copy.engineHint)}</span>
                    </span>
                  </Link>
                )}
              </Section>
            )}
          </div>
        </nav>
      </dialog>
    </>
  )
}
