"use client"

import Link from "next/link"
import { ArrowRight, Settings, Key, FolderOpen } from "lucide-react"

type QuickLink = {
  href: string
  icon: React.ElementType
  label: string
  labelAr: string
}

const quickLinks: QuickLink[] = [
  { href: "/docs/phase1", icon: Settings, label: "Configuration", labelAr: "الإعدادات" },
  { href: "/docs/secrets", icon: Key, label: "Secrets", labelAr: "الأسرار" },
  { href: "/docs/projects", icon: FolderOpen, label: "Projects", labelAr: "المشاريع" },
]

export function StageBanner({
  lang,
  stage = 1,
  title,
  titleAr,
  description,
  descriptionAr,
}: {
  lang: string
  stage?: number
  title: string
  titleAr: string
  description: string
  descriptionAr: string
}) {
  const displayTitle = lang === "ar" ? titleAr : title
  const displayDescription = lang === "ar" ? descriptionAr : description

  return (
    <section className="rounded-lg border border-primary/30 bg-primary/5 p-6 md:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
              {lang === "ar" ? `المرحلة ${stage}` : `Stage ${stage}`}
            </span>
            <span className="text-xs font-medium text-primary">
              {lang === "ar" ? "التركيز الحالي" : "Current Focus"}
            </span>
          </div>
          <h2 className="mb-2 text-2xl font-bold">{displayTitle}</h2>
          <p className="text-muted-foreground">{displayDescription}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {quickLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={`/${lang}${link.href}`}
                className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Icon className="h-4 w-4" />
                {lang === "ar" ? link.labelAr : link.label}
                <ArrowRight className="h-3 w-3 rtl:rotate-180" />
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
