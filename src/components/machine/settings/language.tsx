"use client"

import { usePathname, useRouter } from "next/navigation"

import { i18n, localeConfig, type Locale } from "@/components/local/config"
import { cn } from "@/lib/utils"
import { storeLang, swapLocale } from "../shell/lang"

/**
 * Language / اللغة — a segmented toggle. Switching swaps the locale segment of the URL (same machine
 * path, same query) and remembers the choice (`kun.machine.lang`), so the app opens in it next time.
 */
export function LanguageToggle({ lang }: { lang: Locale }) {
  const router = useRouter()
  const pathname = usePathname()

  function choose(to: Locale) {
    storeLang(to)
    if (to !== lang) router.replace(swapLocale(pathname, window.location.search, to))
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Language / اللغة</legend>
      <div role="radiogroup" aria-label="Language / اللغة" className="flex gap-1 rounded-full bg-muted p-1">
        {i18n.locales.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={lang === l}
            lang={l}
            onClick={() => choose(l)}
            className={cn(
              "h-10 flex-1 rounded-full text-[15px] font-medium transition-colors",
              lang === l ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {localeConfig[l].nativeName}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
