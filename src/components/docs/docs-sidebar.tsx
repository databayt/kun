"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import type { docsSource } from "@/lib/source"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

// Configuration for kun docs navigation
const DOCS_LINKS = [
  { key: "introduction", href: "/docs", fallback: "Introduction" },
  { key: "architecture", href: "/docs/architecture", fallback: "Architecture" },
  { key: "prd", href: "/docs/prd", fallback: "PRD" },
  { key: "epics", href: "/docs/epics", fallback: "Epics" },
  { key: "infrastructure", href: "/docs/infrastructure", fallback: "Infrastructure" },
  { key: "phase1", href: "/docs/phase1", fallback: "Phase 1: Individual" },
  { key: "phase2", href: "/docs/phase2", fallback: "Phase 2: Team" },
  { key: "phase3", href: "/docs/phase3", fallback: "Phase 3: Commercial" },
] as const

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

  return (
    <Sidebar
      className="sticky top-[calc(var(--header-height)+2rem)] z-30 hidden h-[calc(100svh-var(--footer-height)-4rem)] overscroll-none bg-transparent lg:flex"
      collapsible="none"
      {...props}
    >
      <SidebarContent className="no-scrollbar overflow-x-hidden">
        <div className="pb-4 pt-2 pl-0">
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu>
                {DOCS_LINKS.map(({ key, href, fallback }) => {
                  const fullHref = `${prefix}${href}`
                  const isActive = pathname === fullHref || pathname === href

                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className="relative h-[30px] w-full border border-transparent text-[0.8rem] font-medium p-0"
                      >
                        <Link href={fullHref} className="block w-full">{fallback}</Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>
      </SidebarContent>
    </Sidebar>
  )
}
