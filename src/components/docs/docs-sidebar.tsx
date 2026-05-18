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
    title: "Getting Started",
    items: [
      { href: "/docs/installation", label: "Installation" },
      { href: "/docs/installation/claude-code", label: "Claude Code" },
      { href: "/docs/installation/self-hosting", label: "Self-Hosting" },
    ],
  },
  {
    title: "Engine",
    items: [
      { href: "/docs/engine/claude-md", label: "CLAUDE.md" },
      { href: "/docs/engine/agents", label: "Agents" },
      { href: "/docs/engine/skills", label: "Skills" },
      { href: "/docs/engine/commands", label: "Commands" },
      { href: "/docs/engine/mcp", label: "MCP" },
      { href: "/docs/engine/hooks", label: "Hooks" },
      { href: "/docs/engine/rules", label: "Rules" },
      { href: "/docs/engine/memory", label: "Memory" },
      { href: "/docs/engine/keywords", label: "Keywords" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/docs/operations/captain", label: "Captain" },
      { href: "/docs/operations/team", label: "Team" },
      { href: "/docs/operations/dispatch", label: "Dispatch" },
      { href: "/docs/operations/context", label: "Context" },
      { href: "/docs/operations/cowork", label: "Cowork" },
      { href: "/docs/operations/voice", label: "Voice" },
      { href: "/docs/operations/credentials", label: "Credentials" },
      { href: "/docs/operations/connectors", label: "Connectors" },
      { href: "/docs/operations/apps", label: "Apps" },
      { href: "/docs/operations/issue", label: "Issue" },
    ],
  },
  {
    title: "Reference",
    items: [
      { href: "/docs/reference/configuration", label: "Configuration" },
      { href: "/docs/reference/architecture", label: "Architecture" },
      { href: "/docs/reference/workflows", label: "Workflows" },
      { href: "/docs/reference/products", label: "Products" },
      { href: "/docs/reference/prd", label: "PRD" },
      { href: "/docs/reference/epics", label: "Epics" },
      { href: "/docs/reference/repositories", label: "Repositories" },
      { href: "/docs/reference/projects", label: "Projects" },
      { href: "/docs/reference/stack", label: "Stack" },
      { href: "/docs/reference/slack", label: "Slack" },
      { href: "/docs/reference/secrets", label: "Secrets" },
    ],
  },
  {
    title: "Resources",
    items: [
      { href: "/docs/resources/tips", label: "Tips" },
      { href: "/docs/resources/tweets", label: "Tweets" },
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
