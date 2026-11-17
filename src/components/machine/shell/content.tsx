"use client"

// The machine app shell: a compact nav (no site header) and the "open in machine"
// state every machine page shows when it is loaded in a plain browser.
import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { isTauri } from "@tauri-apps/api/core"
import {
  BlocksIcon,
  CogIcon,
  HistoryIcon,
  MessageSquareIcon,
  SettingsIcon,
} from "lucide-react"

import type { Locale } from "@/components/local/config"
import { cn } from "@/lib/utils"

const items = [
  { href: "", ar: "المحادثة", en: "Chat", Icon: MessageSquareIcon },
  { href: "/catalog", ar: "الكتالوج", en: "Catalog", Icon: BlocksIcon },
  { href: "/engine", ar: "المحرك", en: "Engine", Icon: CogIcon },
  { href: "/sessions", ar: "الجلسات", en: "Sessions", Icon: HistoryIcon },
  { href: "/settings", ar: "الإعدادات", en: "Settings", Icon: SettingsIcon },
]

export function MachineNav({ lang }: { lang: Locale }) {
  const isAr = lang === "ar"
  const pathname = usePathname()
  const base = `/${lang}/machine`
  return (
    <nav className="border-border flex items-center gap-1 overflow-x-auto border-b px-3 py-2">
      <span className="px-2 text-sm font-semibold">{isAr ? "كن" : "Kun"}</span>
      {items.map(({ href, ar, en, Icon }) => {
        const to = base + href
        const active = href === "" ? pathname === base : pathname.startsWith(to)
        return (
          <Link
            key={href}
            href={to}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors",
              active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {isAr ? ar : en}
          </Link>
        )
      })}
    </nav>
  )
}

/** null while unknown (first render), then whether the page runs inside the machine app. */
export function useInMachine(): boolean | null {
  const [inApp, setInApp] = useState<boolean | null>(null)
  useEffect(() => setInApp(isTauri()), [])
  return inApp
}

export function OpenInMachine({ lang }: { lang: Locale }) {
  const isAr = lang === "ar"
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-xl font-semibold">
        {isAr ? "افتح هذه الصفحة في تطبيق كن" : "Open this page in the Kun app"}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        {isAr
          ? "المحادثة والجلسات والإعدادات تعمل على جهازك داخل التطبيق فقط."
          : "Chat, sessions and settings run on your computer, inside the app only."}
      </p>
    </div>
  )
}
