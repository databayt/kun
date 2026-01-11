import Link from "next/link"
import { DocsThemeSwitcher } from "@/components/docs/docs-theme-switcher"

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container-wrapper flex h-14 items-center px-responsive">
          <div className="mr-4 flex">
            <Link href={`/${lang}/docs`} className="mr-6 flex items-center space-x-2">
              <span className="font-bold">كن Kun</span>
            </Link>
          </div>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link
              href={`/${lang}/docs`}
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              Docs
            </Link>
          </nav>
          <div className="flex flex-1 items-center justify-end space-x-2">
            <DocsThemeSwitcher />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-6 md:py-0">
        <div className="container-wrapper flex flex-col items-center justify-between gap-4 md:h-12 md:flex-row px-responsive">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built with{" "}
            <a
              href="https://claude.ai/code"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
            >
              Claude Code
            </a>
            . The source code is available on{" "}
            <a
              href="https://github.com/databayt/kun"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
            >
              GitHub
            </a>
            .
          </p>
        </div>
      </footer>
    </>
  )
}
