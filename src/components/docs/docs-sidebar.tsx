"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import type { docsSource } from "@/lib/source"
import { docsNav, type DocEntry } from "./docs-config"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function DocsSidebar({
  tree,
  lang,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  tree: typeof docsSource.pageTree
  lang?: string
}) {
  const pathname = usePathname()
  const prefix = lang ? `/${lang}` : ""

  function renderLink(item: DocEntry) {
    const fullHref = `${prefix}${item.href}`
    const isActive = pathname === fullHref || pathname === item.href

    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          className="relative h-[30px] w-full border border-transparent text-[0.8rem] font-medium p-0"
        >
          <Link href={fullHref} className="block w-full">{item.label}</Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Sidebar
      className="sticky top-[calc(var(--header-height)+2rem)] z-30 hidden h-[calc(100svh-var(--footer-height)-4rem)] overscroll-none bg-transparent lg:flex"
      collapsible="none"
      {...props}
    >
      <SidebarContent className="no-scrollbar overflow-x-hidden">
        <div className="pb-4 pt-2 pl-0">
          {docsNav.map((entry, i) => {
            if ("title" in entry) {
              return (
                <SidebarGroup key={entry.title} className="p-0 pt-4">
                  <SidebarGroupLabel className="px-0 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    {entry.title}
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {entry.items.map(renderLink)}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )
            }

            return (
              <SidebarGroup key={i} className="p-0">
                <SidebarGroupContent>
                  <SidebarMenu>
                    {renderLink(entry)}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )
          })}
        </div>
      </SidebarContent>
    </Sidebar>
  )
}
