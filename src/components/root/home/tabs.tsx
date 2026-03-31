"use client"

import { TabsNav } from "@/components/atom/tabs"
import type { getDictionary } from "@/components/local/dictionaries"

interface HomeTabsProps {
  dictionary?: Awaited<ReturnType<typeof getDictionary>>
}

export default function HomeTabs({ dictionary }: HomeTabsProps) {
  const tabs = [
    {
      name: "Agents",
      href: "/docs/configuration#agents",
      hidden: false,
    },
    {
      name: "Team",
      href: "/docs/workflows#team",
      hidden: false,
    },
    {
      name: "Skills",
      href: "/docs/configuration#skills",
      hidden: false,
    },
    {
      name: "MCP",
      href: "/docs/configuration#mcp",
      hidden: false,
    },
    {
      name: "Dispatch",
      href: "/docs/workflows#dispatch",
      hidden: false,
    },
    {
      name: "Keywords",
      href: "/docs/keywords",
      hidden: false,
    },
    {
      name: "Hooks",
      href: "/docs/configuration#hooks",
      hidden: false,
    },
    {
      name: "Rules",
      href: "/docs/configuration#rules",
      hidden: false,
    },
  ]

  const defaultTab = {
    name: "Engine Components",
    href: "/",
    hidden: false,
  }

  return (
    <div className="py-3 border-b-[0.5px]">
      <div className="rtl:text-right">
        <TabsNav tabs={tabs} defaultTab={defaultTab} />
      </div>
    </div>
  )
}
