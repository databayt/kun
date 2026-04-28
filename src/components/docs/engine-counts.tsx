// Reads .claude/memory/kun-inventory.json at build time and renders count tables.
// Story 29.1 in docs/EPICS-V4.md.
//
// Source: scripts/inventory.sh writes the inventory file. This component
// surfaces those numbers in MDX so docs counts can never drift again.
//
// Usage in any .mdx:
//   <EngineCounts />               // full table
//   <EngineCounts compact />       // single-line summary
//   <EngineCounts only="agents" /> // single number

import fs from "node:fs"
import path from "node:path"
import { cn } from "@/lib/utils"

type Inventory = {
  generated_at: string
  counts: {
    agents: number
    commands: number
    skills: number
    rules: number
    memory_json: number
    memory_md: number
    auto_memory: number
    patterns: number
    mcp_servers: number
    mcp_variants: number
    hooks: number
    allow_rules: number
    deny_rules: number
  }
  phantom: {
    rules: string[]
    memory: string[]
  }
}

function loadInventory(): Inventory | null {
  try {
    const filePath = path.join(process.cwd(), ".claude/memory/kun-inventory.json")
    const raw = fs.readFileSync(filePath, "utf-8")
    return JSON.parse(raw) as Inventory
  } catch {
    return null
  }
}

type Surface = keyof Inventory["counts"]

const SURFACE_LABELS: Record<Surface, string> = {
  agents: "Agents",
  commands: "Commands (legacy)",
  skills: "Skills v2",
  rules: "Path-scoped rules",
  memory_json: "Memory (JSON)",
  memory_md: "Memory (markdown)",
  auto_memory: "Auto-memory files",
  patterns: "Pattern cards",
  mcp_servers: "MCP servers",
  mcp_variants: "MCP role variants",
  hooks: "Hook entries",
  allow_rules: "Permission allow rules",
  deny_rules: "Permission deny rules",
}

interface EngineCountsProps {
  /** Render a single inline number for one surface */
  only?: Surface
  /** One-line text summary instead of a table */
  compact?: boolean
  /** Suppress the "generated at" footer */
  hideTimestamp?: boolean
  className?: string
}

export function EngineCounts({ only, compact, hideTimestamp, className }: EngineCountsProps) {
  const inventory = loadInventory()

  if (!inventory) {
    return (
      <div className={cn("rounded-md border border-dashed border-muted-foreground/30 px-4 py-3 text-sm text-muted-foreground", className)}>
        Inventory unavailable. Run <code>bash scripts/inventory.sh</code>.
      </div>
    )
  }

  const { counts, generated_at } = inventory

  if (only) {
    return <strong>{counts[only].toLocaleString()}</strong>
  }

  if (compact) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {counts.agents} agents · {counts.skills} skills · {counts.mcp_servers} MCPs ·{" "}
        {counts.rules} rules · {counts.memory_json} memory · {counts.hooks} hooks
      </p>
    )
  }

  return (
    <div className={cn("not-prose my-6 overflow-x-auto rounded-lg border", className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-4 py-2 text-start font-medium">Surface</th>
            <th className="px-4 py-2 text-end font-medium">Count</th>
          </tr>
        </thead>
        <tbody>
          {(Object.keys(SURFACE_LABELS) as Surface[]).map((surface) => (
            <tr key={surface} className="border-b last:border-b-0">
              <td className="px-4 py-2">{SURFACE_LABELS[surface]}</td>
              <td className="px-4 py-2 text-end font-mono">
                {counts[surface].toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!hideTimestamp && (
        <p className="border-t bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
          Generated {generated_at} by{" "}
          <a
            href="https://github.com/databayt/kun/blob/main/scripts/inventory.sh"
            className="font-medium underline underline-offset-2"
          >
            scripts/inventory.sh
          </a>
        </p>
      )}
    </div>
  )
}

export default EngineCounts
