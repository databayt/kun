"use client";

import * as React from "react";
import Link, { LinkProps } from "next/link";
import { useRouter, usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { siteConfig, docsConfig } from "./constants";

interface MobileNavProps {
  lang: string;
  className?: string;
}

export function MobileNav({ lang, className }: MobileNavProps) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const prefix = `/${lang}`;
  const isRtl = lang === "ar";

  const isDocsRoute = pathname?.includes("/docs");
  const sectionTitle = isDocsRoute ? "Documentation" : null;
  const sectionNav = isDocsRoute ? docsConfig.sidebarNav : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "extend-touch-target h-8 touch-manipulation items-center justify-start gap-2.5 !p-0 hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 active:bg-transparent dark:hover:bg-transparent",
            className,
          )}
        >
          <div className="relative flex h-8 w-4 items-center justify-center">
            <div className="relative size-4">
              <span
                className={cn(
                  "bg-foreground absolute start-0 block h-0.5 w-4 transition-all duration-100",
                  open ? "top-[0.4rem] -rotate-45" : "top-1",
                )}
              />
              <span
                className={cn(
                  "bg-foreground absolute start-0 block h-0.5 w-4 transition-all duration-100",
                  open ? "top-[0.4rem] rotate-45" : "top-2.5",
                )}
              />
            </div>
            <span className="sr-only">Toggle Menu</span>
          </div>
          <span className="flex h-8 items-center text-lg leading-none font-medium">
            Menu
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="bg-background/90 no-scrollbar h-(--radix-popper-available-height) w-(--radix-popper-available-width) overflow-y-auto rounded-none border-none p-0 shadow-none backdrop-blur duration-100"
        align={isRtl ? "end" : "start"}
        side="bottom"
        alignOffset={isRtl ? 16 : -16}
        sideOffset={14}
      >
        <div className="flex flex-col gap-12 overflow-auto px-6 py-6">
          <div className="flex flex-col gap-4">
            <div className="text-muted-foreground text-sm font-medium">
              Menu
            </div>
            <div className="flex flex-col gap-3">
              <MobileLink href={`${prefix}`} onOpenChange={setOpen}>
                Home
              </MobileLink>
              {siteConfig.mainNav.map((item) =>
                item.href ? (
                  <MobileLink
                    key={item.href}
                    href={`${prefix}${item.href}`}
                    onOpenChange={setOpen}
                  >
                    {item.title}
                  </MobileLink>
                ) : null,
              )}
            </div>
          </div>
          {sectionNav && sectionTitle && (
            <div className="flex flex-col gap-4">
              <div className="text-muted-foreground text-sm font-medium">
                {sectionTitle}
              </div>
              <div className="flex flex-col gap-3">
                {sectionNav.map((group) =>
                  group.items.map((item) =>
                    item.href ? (
                      <MobileLink
                        key={item.href}
                        href={`${prefix}${item.href}`}
                        onOpenChange={setOpen}
                      >
                        {item.title}
                      </MobileLink>
                    ) : null,
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MobileLink({
  href,
  onOpenChange,
  className,
  children,
  ...props
}: LinkProps & {
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <Link
      href={href}
      onClick={() => {
        router.push(href.toString());
        onOpenChange?.(false);
      }}
      className={cn("text-2xl font-medium", className)}
      {...props}
    >
      {children}
    </Link>
  );
}
