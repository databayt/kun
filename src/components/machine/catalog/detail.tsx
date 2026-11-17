"use client"

import Link from "next/link"

import type { Locale } from "@/components/local/config"
import { Badge } from "@/components/ui/badge"

import { copy, statusLabel } from "./config"
import { PageShell } from "../shell/content"
import { ItemActions } from "./item-actions"
import { useCanInstall, useCatalog } from "./use-catalog"

export default function CatalogDetail({ lang, type, name }: { lang: Locale; type: string; name: string }) {
  const isAr = lang === "ar"
  const t = (k: { en: string; ar: string }) => (isAr ? k.ar : k.en)
  const { items, error, reload } = useCatalog()
  const canInstallHere = useCanInstall()
  const item = items?.find((i) => i.id === `${type}:${name}`)

  return (
    <PageShell lang={lang} title={(item && ((isAr && item.title_ar) || item.title)) || t(copy.title)} backHref={`/${lang}/machine/catalog`} backLabel={t(copy.back)}>
      {error && <p className="text-destructive mt-6 text-sm">{error}</p>}
      {!items && !error && <p className="text-muted-foreground mt-6">{t(copy.loading)}</p>}
      {items && !item && <p className="mt-6">{t(copy.notFound)}</p>}
      {item && (
        <>
          <div className="mt-4 flex items-center gap-3">
            <h1 className="text-[26px] font-semibold leading-tight tracking-tight sm:text-3xl">{(isAr && item.title_ar) || item.title}</h1>
            <Badge variant="outline">{type}</Badge>
            {canInstallHere && <Badge>{t(statusLabel[item.status])}</Badge>}
          </div>
          <p className="text-muted-foreground mt-3">{(isAr && item.description_ar) || item.description}</p>
          <div className="mt-4">
            <ItemActions item={item} isAr={isAr} onChanged={reload} />
          </div>

          {item.dependencies.length > 0 && (
            <section className="mt-8">
              <h2 className="font-medium">{t(copy.dependencies)}</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {item.dependencies.map((d) => {
                  const [dt, dn] = d.split(":")
                  return (
                    <li key={d}>
                      <Link href={`/${lang}/machine/catalog/${dt}/${dn}`}>
                        <Badge variant="secondary">{d}</Badge>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {item.keywords.length > 0 && (
            <section className="mt-8">
              <h2 className="font-medium">{t(copy.keywords)}</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.keywords.map((k) => (
                  <Badge key={k} variant="outline">
                    {k}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          <section className="mt-8">
            <h2 className="font-medium">
              {t(copy.files)} ({item.files.length})
            </h2>
            <ul dir="ltr" className="text-muted-foreground mt-2 space-y-1 font-mono text-xs">
              {item.files.map((f) => (
                <li key={f.target}>~/.claude/{f.target}</li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-4 text-xs">
              {t(copy.version)}: <span dir="ltr">{item.version.slice(0, 12)}</span>
            </p>
          </section>
        </>
      )}
    </PageShell>
  )
}
