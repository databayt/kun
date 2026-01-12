import Link from "next/link"

import { ModeSwitcher } from "./mode-switcher"
import { LangSwitcher } from "./lang-switcher"
import { GitHubLink } from "./github-link"
import { Separator } from "@/components/ui/separator"

interface SiteHeaderProps {
  lang: string
}

export function SiteHeader({ lang }: SiteHeaderProps) {
  return (
    <header className="bg-background sticky top-0 z-50 w-full">
      <div className="container-wrapper px-3 lg:px-0">
        <div className="flex h-(--header-height) items-center **:data-[slot=separator]:!h-4">
          <Link href={`/${lang}`} className="flex items-center gap-1.5 me-6">
            <span className="font-bold">Kun</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href={`/${lang}/docs`}
              className="transition-colors hover:text-foreground/80 text-foreground/60"
            >
              Docs
            </Link>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <GitHubLink />
            <Separator orientation="vertical" />
            <LangSwitcher />
            <ModeSwitcher />
          </div>
        </div>
      </div>
    </header>
  )
}
