'use client'

import { Folder, File } from 'lucide-react'

interface DirectoryNode {
  name: string
  type: 'file' | 'directory'
  description?: string
  children?: DirectoryNode[]
}

interface StructureProps {
  className?: string
}

export function Structure({ className }: StructureProps) {
  // Phase architecture structure for kun
  const topLevelStructure: DirectoryNode = {
    name: "kun/",
    type: "directory",
    description: "Three-phase architecture",
    children: [
      {
        name: "Phase 1: Individual",
        type: "directory",
        description: "Personal remote setup",
        children: [
          { name: "tailscale up --ssh", type: "file", description: "VPN with SSH" },
          { name: "tmux new-session", type: "file", description: "Persistent sessions" },
          { name: "termius", type: "file", description: "Mobile access" },
          { name: "claude-code", type: "file", description: "AI CLI" }
        ]
      },
      {
        name: "Phase 2: Team Server",
        type: "directory",
        description: "10+ developers",
        children: [
          { name: "multi-user accounts", type: "file", description: "User management" },
          { name: "tailscale ACLs", type: "file", description: "Access control" },
          { name: "/etc/claude-code/", type: "file", description: "Shared config" },
          { name: "systemd services", type: "file", description: "Auto-start" },
          { name: "netdata", type: "file", description: "Monitoring" }
        ]
      },
      {
        name: "Phase 3: Commercial",
        type: "directory",
        description: "Rental platform",
        children: [
          { name: "docker isolation", type: "file", description: "Container per user" },
          { name: "usage metering", type: "file", description: "Track resources" },
          { name: "stripe billing", type: "file", description: "Payments" },
          { name: "pattern marketplace", type: "file", description: "Sell patterns" }
        ]
      }
    ]
  }

  const FileIcon = ({ type }: { type: string }) => {
    if (type === "directory") {
      return <Folder className="w-4 h-4" />
    }
    return <File className="w-4 h-4" />
  }

  const FileTree = ({
    item,
    level = 0,
    isLast = false,
    parentIsLast = []
  }: {
    item: DirectoryNode
    level?: number
    isLast?: boolean
    parentIsLast?: boolean[]
  }) => (
    <div className="relative">
      {level > 0 && (
        <>
          {parentIsLast.slice(0, -1).map((isLastParent, idx) => (
            !isLastParent && (
              <div
                key={idx}
                className="absolute border-l h-full"
                style={{ left: `${(idx + 1) * 24 - 20}px` }}
              />
            )
          ))}
          {!isLast && (
            <div
              className="absolute border-l h-full"
              style={{ left: `${level * 24 - 20}px` }}
            />
          )}
        </>
      )}
      <div
        className="flex items-center gap-2 py-1"
        style={{ paddingLeft: `${level * 24}px` }}
      >
        <FileIcon type={item.type} />
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <code className={`bg-transparent px-0 py-0 ${
            item.type === 'directory' ? 'font-semibold' : ''
          }`}>
            {item.name}
          </code>
          {item.description && (
            <span className="text-sm text-muted-foreground">
              — {item.description}
            </span>
          )}
        </div>
      </div>
      {item.children && (
        <div className="mt-1">
          {item.children.map((child: DirectoryNode, index: number) => (
            <FileTree
              key={index}
              item={child}
              level={level + 1}
              isLast={index === (item.children?.length ?? 0) - 1}
              parentIsLast={[...parentIsLast, isLast]}
            />
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="py-4">
        <FileTree item={topLevelStructure} />
      </div>
    </div>
  )
}
