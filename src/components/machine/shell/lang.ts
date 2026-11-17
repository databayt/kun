// The chosen language: kept on this computer and swapped into the URL's locale segment.
import { i18n, type Locale } from "@/components/local/config"

export const LANG_KEY = "kun.machine.lang"

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (i18n.locales as readonly string[]).includes(v)
}

export function storedLang(): Locale | null {
  try {
    const v = window.localStorage.getItem(LANG_KEY)
    return isLocale(v) ? v : null
  } catch {
    return null
  }
}

export function storeLang(lang: Locale) {
  try {
    window.localStorage.setItem(LANG_KEY, lang)
  } catch {
    // private window or blocked storage: the URL still carries the choice
  }
}

/** `/ar/machine/catalog` + `?x=1` → `/en/machine/catalog?x=1`: only the locale segment changes. */
export function swapLocale(pathname: string, search: string, to: Locale): string {
  const parts = pathname.split("/")
  if (isLocale(parts[1])) parts[1] = to
  else parts.splice(1, 0, to)
  return parts.join("/") + search
}
