"use client"

import * as React from "react"
import Link, { LinkProps } from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { DocEntry, DocSection } from "@/components/docs/docs-config"
import type { SiteNavItem } from "./config"
import { GitHubLink } from "./github-link"
import { LangSwitcher } from "./lang-switcher"
import { ModeSwitcher } from "./mode-switcher"
import { UserButton } from "./user-button"

interface MobileNavProps {
  items?: SiteNavItem[]
  sections?: (DocEntry | DocSection)[]
  className?: string
  lang?: string
}

export function MobileNav({
  items = [],
  sections,
  className,
  lang = "en",
}: MobileNavProps) {
  const [open, setOpen] = React.useState(false)
  const pathname = usePathname()
  const isRTL = lang === "ar"

  const menuLabel = isRTL ? "القائمة" : "Menu"
  const homeLabel = isRTL ? "الرئيسية" : "Home"

  // Surface the docs tree only while reading docs — the desktop sidebar that
  // normally carries it is hidden below lg.
  const showDocs = !!sections && pathname?.includes("/docs")

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "extend-touch-target h-8 touch-manipulation items-center justify-start gap-2.5 !p-0 hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 active:bg-transparent dark:hover:bg-transparent",
            className
          )}
        >
          {/* Animated hamburger — two bars that rotate into an X */}
          <div className="relative flex h-8 w-4 items-center justify-center">
            <div className="relative size-4">
              <span
                className={cn(
                  "bg-foreground absolute start-0 block h-0.5 w-4 transition-all duration-100",
                  open ? "top-[0.4rem] -rotate-45" : "top-1"
                )}
              />
              <span
                className={cn(
                  "bg-foreground absolute start-0 block h-0.5 w-4 transition-all duration-100",
                  open ? "top-[0.4rem] rotate-45" : "top-2.5"
                )}
              />
            </div>
            <span className="sr-only">{menuLabel}</span>
          </div>
          <span className="flex h-8 items-center text-lg leading-none font-medium">
            {menuLabel}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        // Portaled outside the dir="rtl" wrapper, so set direction explicitly.
        dir={isRTL ? "rtl" : "ltr"}
        className="bg-background/90 no-scrollbar h-(--radix-popper-available-height) w-(--radix-popper-available-width) overflow-y-auto rounded-none border-none p-0 shadow-none backdrop-blur duration-100"
        align="start"
        side="bottom"
        alignOffset={-16}
        sideOffset={14}
      >
        <div className="flex flex-col gap-8 overflow-auto px-6 py-6">
          {/* Main menu */}
          <div className="flex flex-col gap-4">
            <div className="text-muted-foreground text-sm font-medium">
              {menuLabel}
            </div>
            <div className="flex flex-col gap-3">
              <MobileLink href="/" lang={lang} onOpenChange={setOpen}>
                {homeLabel}
              </MobileLink>
              {items.map((item) => (
                <MobileLink
                  key={item.href}
                  href={item.href}
                  lang={lang}
                  onOpenChange={setOpen}
                >
                  {item.label}
                </MobileLink>
              ))}
            </div>
          </div>

          {/* Full docs tree (only on /docs) */}
          {showDocs &&
            sections!.map((entry, i) =>
              "title" in entry ? (
                <div key={entry.title} className="flex flex-col gap-4">
                  <div className="text-muted-foreground text-sm font-medium">
                    {entry.title}
                  </div>
                  <div className="flex flex-col gap-3">
                    {entry.items.map((item) => (
                      <MobileLink
                        key={item.href}
                        href={item.href}
                        lang={lang}
                        onOpenChange={setOpen}
                      >
                        {item.label}
                      </MobileLink>
                    ))}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex flex-col gap-3">
                  <MobileLink href={entry.href} lang={lang} onOpenChange={setOpen}>
                    {entry.label}
                  </MobileLink>
                </div>
              )
            )}

          {/* Actions — same controls the desktop header carries on the right */}
          <div className="flex items-center gap-2 border-t pt-4 **:data-[slot=separator]:!h-4">
            <GitHubLink />
            <Separator orientation="vertical" />
            <LangSwitcher />
            <ModeSwitcher />
            <UserButton />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function MobileLink({
  href,
  onOpenChange,
  className,
  children,
  lang,
  ...props
}: LinkProps & {
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  className?: string
  lang?: string
}) {
  const router = useRouter()
  const base = lang ? `/${lang}` : ""
  const path = href.toString()
  const fullHref = path === "/" ? base || "/" : `${base}${path}`

  return (
    <Link
      href={fullHref}
      onClick={() => {
        router.push(fullHref)
        onOpenChange?.(false)
      }}
      className={cn("text-2xl font-medium", className)}
      {...props}
    >
      {children}
    </Link>
  )
}
