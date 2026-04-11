"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import type { docsSource } from "@/lib/source"
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

// Configuration for kun docs navigation — must match content/docs/meta.json
type DocEntry = { href: string; label: string }
type DocSection = { title: string; items: DocEntry[] }

const DOCS_NAV: (DocEntry | DocSection)[] = [
  { href: "/docs", label: "Introduction" },
  {
    title: "Engine",
    items: [
      { href: "/docs/claude-md", label: "CLAUDE.md" },
      { href: "/docs/agents", label: "Agents" },
      { href: "/docs/skills", label: "Skills" },
      { href: "/docs/commands", label: "Commands" },
      { href: "/docs/mcp", label: "MCP" },
      { href: "/docs/hooks", label: "Hooks" },
      { href: "/docs/rules", label: "Rules" },
      { href: "/docs/memory", label: "Memory" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/docs/captain", label: "Captain" },
      { href: "/docs/team", label: "Team" },
      { href: "/docs/dispatch", label: "Dispatch" },
      { href: "/docs/context", label: "Context" },
      { href: "/docs/cowork", label: "Cowork" },
      { href: "/docs/voice", label: "Voice" },
      { href: "/docs/credentials", label: "Credentials" },
      { href: "/docs/connectors", label: "Connectors" },
      { href: "/docs/apps", label: "Apps" },
      { href: "/docs/issue", label: "Issue" },
    ],
  },
  {
    title: "Reference",
    items: [
      { href: "/docs/keywords", label: "Keywords" },
      { href: "/docs/tips", label: "Tips" },
      { href: "/docs/tweets", label: "Tweets" },
      { href: "/docs/configuration", label: "Configuration" },
      { href: "/docs/architecture", label: "Architecture" },
      { href: "/docs/workflows", label: "Workflows" },
      { href: "/docs/products", label: "Products" },
      { href: "/docs/prd", label: "PRD" },
      { href: "/docs/epics", label: "Epics" },
      { href: "/docs/claude-code", label: "Claude Code" },
      { href: "/docs/secrets", label: "Secrets" },
      { href: "/docs/slack", label: "Slack" },
      { href: "/docs/stack", label: "Stack" },
      { href: "/docs/repositories", label: "Repositories" },
      { href: "/docs/projects", label: "Projects" },
      { href: "/docs/self-hosting", label: "Self-Hosting" },
    ],
  },
]

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
          {DOCS_NAV.map((entry, i) => {
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
