import Link from "next/link"

import { ModeSwitcher } from "./mode-switcher"
import { LangSwitcher } from "./lang-switcher"
import { GitHubLink } from "./github-link"
import { UserButton } from "./user-button"
import { MobileNav } from "./mobile-nav"
import { siteNav } from "./config"
import { Separator } from "@/components/ui/separator"
import { docsNav } from "@/components/docs/docs-config"

interface SiteHeaderProps {
  lang: string
}

export function SiteHeader({ lang }: SiteHeaderProps) {
  return (
    <header className="bg-background sticky top-0 z-50 w-full">
      <div className="container-wrapper">
        <div className="flex h-(--header-height) items-center gap-2 md:gap-4 **:data-[slot=separator]:!h-4">
          <Link href={`/${lang}`} className="flex items-center gap-1.5 me-6">
            <span className="font-bold">Kun</span>
          </Link>

          {/* Desktop nav — collapses into the hamburger below md */}
          <nav className="hidden items-center gap-4 text-sm md:flex">
            {siteNav.map((item) => (
              <Link
                key={item.href}
                href={`/${lang}${item.href}`}
                className="transition-colors hover:text-foreground/80 text-foreground/60"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Desktop controls — move into the hamburger below lg */}
          <div className="ms-auto hidden items-center gap-2 lg:flex">
            <GitHubLink />
            <Separator orientation="vertical" />
            <LangSwitcher />
            <ModeSwitcher />
            <UserButton />
          </div>

          {/* Mobile hamburger — visible below lg */}
          <MobileNav
            className="ms-auto flex lg:hidden"
            lang={lang}
            items={siteNav}
            sections={docsNav}
          />
        </div>
      </div>
    </header>
  )
}
