"use client"

import Link from "next/link"
import { ArrowRight, Settings, Key, FolderOpen, BookOpen } from "lucide-react"

type LinkCard = {
  href: string
  icon: React.ElementType
  title: string
  titleAr: string
  description: string
  descriptionAr: string
}

const links: LinkCard[] = [
  {
    href: "/docs/phase1",
    icon: Settings,
    title: "Configuration",
    titleAr: "الإعدادات",
    description: "Set up your development environment with cloud configs",
    descriptionAr: "إعداد بيئة التطوير الخاصة بك مع الإعدادات السحابية",
  },
  {
    href: "/docs/secrets",
    icon: Key,
    title: "Secrets",
    titleAr: "الأسرار",
    description: "Access API keys, tokens, and environment variables",
    descriptionAr: "الوصول إلى مفاتيح API والرموز ومتغيرات البيئة",
  },
  {
    href: "/docs/projects",
    icon: FolderOpen,
    title: "Projects",
    titleAr: "المشاريع",
    description: "Browse and clone open projects from databayt",
    descriptionAr: "تصفح واستنساخ المشاريع المفتوحة من databayt",
  },
  {
    href: "/docs",
    icon: BookOpen,
    title: "Full Documentation",
    titleAr: "التوثيق الكامل",
    description: "Complete guides for all phases and features",
    descriptionAr: "أدلة كاملة لجميع المراحل والميزات",
  },
]

export function QuickLinks({ lang }: { lang: string }) {
  return (
    <section className="py-16">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight">
          {lang === "ar" ? "روابط سريعة" : "Quick Links"}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {lang === "ar"
            ? "كل ما تحتاجه للبدء"
            : "Everything you need to get started"}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((link) => {
          const Icon = link.icon
          const title = lang === "ar" ? link.titleAr : link.title
          const description = lang === "ar" ? link.descriptionAr : link.description

          return (
            <Link
              key={link.href}
              href={`/${lang}${link.href}`}
              className="group flex flex-col rounded-lg border p-6 transition-all hover:border-primary hover:shadow-md"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mb-2 font-semibold group-hover:text-primary">
                {title}
              </h3>
              <p className="flex-1 text-sm text-muted-foreground">{description}</p>
              <div className="mt-4 flex items-center text-sm font-medium text-primary">
                {lang === "ar" ? "اكتشف المزيد" : "Learn more"}
                <ArrowRight className="ms-2 h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
