"use client"

import Link from "next/link"
import { ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import type { Locale } from "@/components/local/config"
import { tr } from "../chat/config"
import { LanguageToggle } from "../settings/language"
import { copy } from "./config"
import type { MachineProfile } from "../profile/types"
import { rowClass, Section } from "./section"
import { useReadAloud } from "./use-read-aloud"

/** Settings inline: language, read aloud, the profile's locked agent, and a link to the full page. */
export function InlineSettings({ lang, profile, inApp }: { lang: Locale; profile: MachineProfile | null; inApp: boolean }) {
  const t = tr(lang === "ar")
  const [aloud, setAloud] = useReadAloud()
  return (
    <Section title={t(copy.settings)}>
      <div className="space-y-3 px-2">
        <LanguageToggle lang={lang} />
        {inApp && (
          <button
            type="button"
            role="switch"
            aria-checked={aloud}
            onClick={() => setAloud(!aloud)}
            className="flex min-h-11 w-full items-center justify-between gap-3 text-start text-[15px]"
          >
            <span>{t(copy.readAloud)}</span>
            <span aria-hidden className={cn("flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors", aloud ? "bg-foreground" : "bg-muted-foreground/30")}>
              <span className={cn("size-6 rounded-full bg-background transition-transform", aloud && "translate-x-5 rtl:-translate-x-5")} />
            </span>
          </button>
        )}
        {profile && (
          <p className="flex items-center justify-between text-[15px]">
            <span>{t(copy.agent)}</span>
            <span dir="ltr" className="text-muted-foreground">{profile.driver}</span>
          </p>
        )}
      </div>
      <Link href={`/${lang}/machine/settings`} className={cn(rowClass, "mt-1 justify-between font-medium")}>
        {t(copy.allSettings)}
        <ChevronRightIcon className="size-4 rtl:rotate-180" aria-hidden />
      </Link>
    </Section>
  )
}
