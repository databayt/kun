"use client"

import Link from "next/link"
import { Check, Clock, Rocket } from "lucide-react"

type Stage = {
  number: number
  title: string
  titleAr: string
  description: string
  descriptionAr: string
  features: string[]
  featuresAr: string[]
  status: "current" | "upcoming" | "future"
}

const stages: Stage[] = [
  {
    number: 1,
    title: "Share Config",
    titleAr: "مشاركة الإعدادات",
    description: "Team configures machines with shared resources",
    descriptionAr: "يقوم الفريق بتكوين الأجهزة بموارد مشتركة",
    features: [
      "Same cloud configs",
      "Shared secrets",
      "Open projects",
      "Dev tools setup",
    ],
    featuresAr: [
      "إعدادات سحابية موحدة",
      "أسرار مشتركة",
      "مشاريع مفتوحة",
      "إعداد أدوات التطوير",
    ],
    status: "current",
  },
  {
    number: 2,
    title: "Central Server",
    titleAr: "خادم مركزي",
    description: "One server, all connect from anywhere",
    descriptionAr: "خادم واحد، الجميع يتصل من أي مكان",
    features: [
      "Laptop/mobile access",
      "Computing power",
      "Central config",
      "Persistent sessions",
    ],
    featuresAr: [
      "الوصول من اللابتوب/الجوال",
      "قوة حوسبة",
      "إعدادات مركزية",
      "جلسات دائمة",
    ],
    status: "upcoming",
  },
  {
    number: 3,
    title: "Commercial",
    titleAr: "تجاري",
    description: "Offer infrastructure as a service",
    descriptionAr: "تقديم البنية التحتية كخدمة",
    features: [
      "BMAD method",
      "Pattern ecosystem",
      "Pay-per-usage",
      "Client isolation",
    ],
    featuresAr: [
      "منهج BMAD",
      "نظام الأنماط",
      "الدفع حسب الاستخدام",
      "عزل العملاء",
    ],
    status: "future",
  },
]

function StatusBadge({ status, lang }: { status: Stage["status"]; lang: string }) {
  const config = {
    current: {
      icon: Check,
      label: lang === "ar" ? "الحالي" : "Current",
      className: "bg-primary text-primary-foreground",
    },
    upcoming: {
      icon: Clock,
      label: lang === "ar" ? "قريباً" : "Coming Soon",
      className: "bg-muted text-muted-foreground",
    },
    future: {
      icon: Rocket,
      label: lang === "ar" ? "المستقبل" : "Future",
      className: "bg-muted text-muted-foreground",
    },
  }

  const { icon: Icon, label, className } = config[status]

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${className}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

export function RoadmapCards({ lang, currentStage = 1 }: { lang: string; currentStage?: number }) {
  return (
    <section className="py-16">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight">
          {lang === "ar" ? "خارطة الطريق" : "Roadmap"}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {lang === "ar"
            ? "ثلاث مراحل نحو البنية التحتية الكاملة"
            : "Three stages toward complete infrastructure"}
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {stages.map((stage) => {
          const isCurrent = stage.number === currentStage
          const title = lang === "ar" ? stage.titleAr : stage.title
          const description = lang === "ar" ? stage.descriptionAr : stage.description
          const features = lang === "ar" ? stage.featuresAr : stage.features

          return (
            <div
              key={stage.number}
              className={`relative rounded-lg border p-6 transition-all ${
                isCurrent
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {stage.number}
                </span>
                <StatusBadge status={stage.status} lang={lang} />
              </div>
              <h3 className="mb-2 text-xl font-semibold">{title}</h3>
              <p className="mb-4 text-sm text-muted-foreground">{description}</p>
              <ul className="space-y-2">
                {features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
              {isCurrent && (
                <Link
                  href={`/${lang}/docs/phase1`}
                  className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
                >
                  {lang === "ar" ? "ابدأ الآن ←" : "Get Started →"}
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
