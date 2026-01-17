import Link from "next/link"

import { Announcement } from "@/components/atom/announcement"
import { PageHeader } from "@/components/atom/page-header"
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
    <PageHeader
      announcement={
        <Announcement
          text={lang === "ar" ? "البنية التحتية للتطوير بالذكاء الاصطناعي" : "Remote AI Development Infrastructure"}
          href={`/${lang}/docs/phase1`}
        />
      }
      heading={lang === "ar" ? titleAr : title}
      description={lang === "ar" ? descriptionAr : description}
      actions={
        <>
          <Button asChild>
            <Link href={`/${lang}/docs/phase1`}>
              {lang === "ar" ? "ابدأ الآن" : "Get Started"}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <a
              href="https://github.com/databayt/kun"
              target="_blank"
              rel="noreferrer"
            >
              {lang === "ar" ? "التوثيق" : "Documentation"}
            </a>
          </Button>
        </>
      }
    />
  )
}
