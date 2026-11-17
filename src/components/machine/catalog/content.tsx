"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import type { Locale } from "@/components/local/config"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { copy, statusLabel, TYPES, typeLabel, type ItemType } from "./config"
import { PageShell } from "../shell/content"
import { ItemActions } from "./item-actions"
import { useCanInstall, useCatalog } from "./use-catalog"

export default function CatalogContent({ lang }: { lang: Locale }) {
  const isAr = lang === "ar"
  const t = (k: { en: string; ar: string }) => (isAr ? k.ar : k.en)
  const { items, error, reload } = useCatalog()
  const canInstallHere = useCanInstall()
  const [type, setType] = useState<ItemType | "all">("pack")
  const [query, setQuery] = useState("")

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (items ?? []).filter(
      (i) =>
        (type === "all" || i.id.startsWith(`${type}:`)) &&
        (!q || `${i.name} ${i.title} ${i.description} ${i.keywords.join(" ")}`.toLowerCase().includes(q))
    )
  }, [items, type, query])

  return (
    <PageShell lang={lang} title={t(copy.title)}>
      <p className="text-muted-foreground">{t(copy.subtitle)}</p>

      {!canInstallHere && (
        <div className="bg-muted mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 text-sm">
          <span>{t(copy.getMachine)}</span>
          <Link href={`/${lang}/machine`} className="text-primary font-medium underline-offset-4 hover:underline">
            {t(copy.getMachineButton)}
          </Link>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-4">
        <Input
          value={query}
          className="h-12 rounded-full bg-muted px-5 text-base shadow-none"
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(copy.search)}
          aria-label={t(copy.search)}
        />
        <Tabs value={type} onValueChange={(v) => setType(v as ItemType | "all")}>
          <TabsList className="flex-wrap">
            {TYPES.map((k) => (
              <TabsTrigger key={k} value={k}>
                {t(typeLabel[k])}
              </TabsTrigger>
            ))}
            <TabsTrigger value="all">{t(copy.all)}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {error && <p className="text-destructive mt-6 text-sm">{error}</p>}
      {!items && !error && <p className="text-muted-foreground mt-6">{t(copy.loading)}</p>}
      {items && shown.length === 0 && <p className="text-muted-foreground mt-6">{t(copy.empty)}</p>}

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {shown.map((item) => (
          <li key={item.id} className="bg-muted/70 flex flex-col justify-between gap-3 rounded-2xl p-4">
            <div>
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/${lang}/machine/catalog/${item.id.split(":")[0]}/${item.name}`}
                  className="font-medium hover:underline"
                >
                  {(isAr && item.title_ar) || item.title}
                </Link>
                {canInstallHere && (
                  <Badge variant={item.status === "installed" ? "default" : "secondary"}>
                    {t(statusLabel[item.status])}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-1 line-clamp-3 text-sm">{(isAr && item.description_ar) || item.description}</p>
            </div>
            <ItemActions item={item} isAr={isAr} onChanged={reload} />
          </li>
        ))}
      </ul>
    </PageShell>
  )
}
