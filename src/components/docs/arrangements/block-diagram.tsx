"use client"

import { Badge } from "@/components/ui/badge"

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

interface Section {
  title: string
  items: string[]
}

export function BuildingBlocks({ sections, title = "Building Blocks" }: { sections: Section[]; title?: string }) {
  return (
    <div className="">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sections.map((section) => (
          <div key={section.title} className="space-y-2">
            <div className="text-xs text-muted-foreground">{section.title}</div>
            {chunk(section.items, 3).map((row, rowIdx) => (
              <div key={`${section.title}-row-${rowIdx}`} className="flex gap-2">
                {row.map((item) => (
                  <Badge key={item} variant="secondary" className="w-auto text-xs font-normal px-2 py-1">
                    {item}
                  </Badge>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// Kun-specific building blocks
export function KunBuildingBlocks() {
  const sections: Section[] = [
    {
      title: "Network",
      items: ["Tailscale", "WireGuard", "SSH"],
    },
    {
      title: "Sessions",
      items: ["tmux", "Persistent", "Attach"],
    },
    {
      title: "AI",
      items: ["Claude Code", "Patterns", "Codebase"],
    },
    {
      title: "Mobile",
      items: ["Termius", "iOS", "Android"],
    },
    {
      title: "Users",
      items: ["Multi-user", "ACLs", "Groups"],
    },
    {
      title: "Config",
      items: ["CLAUDE.md", "Secrets", "Env"],
    },
    {
      title: "Monitoring",
      items: ["Netdata", "Health", "Logs"],
    },
    {
      title: "Commercial",
      items: ["Docker", "Stripe", "Metering"],
    },
  ]

  return <BuildingBlocks sections={sections} title="Kun Building Blocks" />
}

// Backward-compatible export
export function BlockDiagram() {
  return <KunBuildingBlocks />
}
