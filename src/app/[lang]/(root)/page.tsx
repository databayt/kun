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
        <h1 className="text-center text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
          كن <span className="text-muted-foreground">Kun</span>
        </h1>
        <p className="max-w-[42rem] text-center leading-normal text-muted-foreground sm:text-xl sm:leading-8">
          Remote AI Development Infrastructure. Access Claude Code from anywhere - laptop, phone, or tablet.
        </p>
        <div className="flex gap-4">
          <Button asChild size="lg">
            <Link href={`/${lang}/docs`}>
              Get Started <ArrowRight className="ml-2 h-4 w-4" />
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
