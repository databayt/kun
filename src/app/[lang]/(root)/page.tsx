import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RoadmapCards } from "@/components/home/roadmap-cards"
import { StageBanner } from "@/components/home/stage-banner"
import { QuickLinks } from "@/components/home/quick-links"

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params

  return (
    <div className="container-wrapper px-responsive">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center gap-6 py-20 md:py-28">
        <h1 className="text-center text-6xl font-bold tracking-tight sm:text-7xl md:text-8xl lg:text-9xl">
          {lang === "ar" ? "كن" : "Kun"}
        </h1>
        <p className="text-center text-xl font-medium text-primary">
          {lang === "ar" ? "آلة الكود" : "The Code Machine"}
        </p>
        <p className="max-w-[42rem] text-center leading-normal text-muted-foreground sm:text-xl sm:leading-8">
          {lang === "ar"
            ? "برمجة بالاستلهام على نطاق واسع. إعداد مرة واحدة، برمجة من أي مكان."
            : "Vibe coding at scale. Configure once, code everywhere."}
        </p>
        <div className="flex gap-4">
          <Button asChild size="lg">
            <Link href={`/${lang}/docs/phase1`}>
              {lang === "ar" ? "البدء السريع" : "Quick Start"}{" "}
              <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <a
              href="https://github.com/databayt/kun"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </Button>
        </div>
      </section>

      {/* Stage Banner - Current Focus */}
      <StageBanner
        lang={lang}
        stage={1}
        title="Team Configuration"
        titleAr="تكوين الفريق"
        description="Configure your machine with cloud configs, secrets, and access to open projects."
        descriptionAr="قم بإعداد جهازك مع الإعدادات السحابية والأسرار والوصول إلى المشاريع المفتوحة."
      />

      {/* Roadmap Section */}
      <RoadmapCards lang={lang} currentStage={1} />

      {/* Quick Links */}
      <QuickLinks lang={lang} />
    </div>
  )
}
