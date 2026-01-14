import { RoadmapCards } from "@/components/home/roadmap-cards"
import { StageBanner } from "@/components/home/stage-banner"
import { QuickLinks } from "@/components/home/quick-links"
import { StackCards } from "@/components/home/stack-cards"
import { Hero } from "@/components/home/hero"

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params

  return (
    <div className="container-wrapper px-responsive">
      {/* Hero Section */}
      <Hero lang={lang} />

      {/* Stack Cards */}
      <StackCards />

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
