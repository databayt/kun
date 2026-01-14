import Link from "next/link"
import { Plus } from "lucide-react"

import { Announcement } from "@/components/atom/announcement"
import {
  PageHeader,
  PageHeaderHeading,
  PageHeaderDescription,
  PageActions,
} from "@/components/atom/page-header"
import { Button } from "@/components/ui/button"

interface HeroProps {
  lang: string
}

export function Hero({ lang }: HeroProps) {
  const title = "Specific Pattern Code Machine"
  const titleAr = "آلة كود الأنماط المحددة"

  const description =
    "Remote computing power with Claude Code configuration and reference design patterns. Build from anywhere with centralized infrastructure."
  const descriptionAr =
    "قوة حوسبة عن بعد مع إعدادات Claude Code وأنماط تصميم مرجعية. ابنِ من أي مكان مع بنية تحتية مركزية."

  return (
    <PageHeader>
      <Announcement
        text={lang === "ar" ? "البنية التحتية للتطوير بالذكاء الاصطناعي" : "Remote AI Development Infrastructure"}
        href={`/${lang}/docs/phase1`}
      />
      <h1 className="text-center text-6xl font-bold tracking-tight sm:text-7xl md:text-8xl lg:text-9xl">
        كن
      </h1>
      <PageHeaderHeading className="max-w-4xl">
        {lang === "ar" ? titleAr : title}
      </PageHeaderHeading>
      <PageHeaderDescription>
        {lang === "ar" ? descriptionAr : description}
      </PageHeaderDescription>
      <PageActions>
        <Button asChild size="sm" className="h-[31px] rounded-lg">
          <Link href={`/${lang}/docs/phase1`}>
            <Plus className="size-4" />
            {lang === "ar" ? "ابدأ الآن" : "Get Started"}
          </Link>
        </Button>
        <Button asChild size="sm" variant="ghost" className="rounded-lg">
          <a
            href="https://github.com/databayt/kun"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </Button>
      </PageActions>
    </PageHeader>
  )
}
