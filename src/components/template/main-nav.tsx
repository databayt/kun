"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { siteConfig } from "./constants";

interface MainNavProps {
  lang: string;
  className?: string;
}

export function MainNav({ lang, className }: MainNavProps) {
  const pathname = usePathname();
  const prefix = `/${lang}`;

  return (
    <nav className={cn("items-center gap-4 text-sm xl:gap-6", className)}>
      {siteConfig.mainNav.map((item) => {
        if (!item.href) return null;
        const fullHref = `${prefix}${item.href}`;
        const isActive = pathname?.startsWith(fullHref);

        return (
          <Link
            key={item.href}
            href={fullHref}
            className={cn(
              "transition-colors hover:text-foreground/80",
              isActive ? "text-foreground" : "text-foreground/60",
            )}
          >
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
