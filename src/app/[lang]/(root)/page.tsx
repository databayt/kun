import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params

  return (
    <div className="container-wrapper px-responsive">
      <section className="flex flex-col items-center justify-center gap-6 py-24 md:py-32">
        <h1 className="text-center text-6xl font-bold tracking-tight sm:text-7xl md:text-8xl lg:text-9xl">
          {lang === "ar" ? "كن" : "Kun"}
        </h1>
        <p className="max-w-[42rem] text-center leading-normal text-muted-foreground sm:text-xl sm:leading-8">
          {lang === "ar"
            ? "بنية تحتية للتطوير بالذكاء الاصطناعي عن بُعد. استخدم Claude Code من أي مكان."
            : "Remote AI Development Infrastructure. Access Claude Code from anywhere."}
        </p>
        <div className="flex gap-4">
          <Button asChild size="lg">
            <Link href={`/${lang}/docs`}>
              {lang === "ar" ? "ابدأ الآن" : "Get Started"}{" "}
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
    </div>
  )
}
