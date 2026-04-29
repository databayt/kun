import Link from "next/link";

import { ModeSwitcher } from "./mode-switcher";
import { LangSwitcher } from "./lang-switcher";
import { GitHubLink } from "./github-link";
import { UserButton } from "./user-button";
import { MainNav } from "./main-nav";
import { MobileNav } from "./mobile-nav";
import { Separator } from "@/components/ui/separator";

interface SiteHeaderProps {
  lang: string;
}

export function SiteHeader({ lang }: SiteHeaderProps) {
  return (
    <header className="bg-background sticky top-0 z-50 w-full">
      <div className="container-wrapper">
        <div className="flex h-(--header-height) items-center gap-2 **:data-[slot=separator]:!h-4">
          <MobileNav lang={lang} className="flex lg:hidden" />
          <Link
            href={`/${lang}`}
            className="hidden items-center gap-1.5 me-6 lg:flex"
          >
            <span className="font-bold">Kun</span>
          </Link>
          <MainNav lang={lang} className="hidden lg:flex" />
          <div className="ms-auto flex items-center gap-2">
            <GitHubLink />
            <Separator orientation="vertical" />
            <LangSwitcher />
            <ModeSwitcher />
            <UserButton />
          </div>
        </div>
      </div>
    </header>
  );
}
