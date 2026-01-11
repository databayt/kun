"use client"

type Block = {
  title: string
  items: string[]
}

export function StackedBlocks({
  blocks,
  title = "System Blocks",
}: {
  blocks: Block[]
  title?: string
}) {
  return (
    <div className="pb-10">
      <div className="grid gap-4 md:grid-cols-3">
        {blocks.map((b) => (
          <div key={b.title} className="rounded-md border p-4">
            <div className="text-sm font-medium mb-2">{b.title}</div>
            <ul className="list-disc pl-4 text-sm text-muted-foreground space-y-1">
              {b.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

// Kun-specific stacked blocks
export function KunStackedBlocks() {
  const blocks: Block[] = [
    {
      title: "Phase 1: Individual",
      items: ["Tailscale VPN", "tmux sessions", "Mobile access via Termius"],
    },
    {
      title: "Phase 2: Team",
      items: ["Multi-user accounts", "Shared configuration", "Netdata monitoring"],
    },
    {
      title: "Phase 3: Commercial",
      items: ["Docker isolation", "Usage metering", "Stripe billing"],
    },
  ]
  return <StackedBlocks blocks={blocks} title="Kun Phases" />
}
