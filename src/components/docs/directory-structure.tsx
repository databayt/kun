'use client'

import { Folder, File } from 'lucide-react'

interface DirectoryNode {
  name: string
  type: 'file' | 'directory'
  description?: string
  children?: DirectoryNode[]
}

interface DirectoryStructureProps {
  className?: string
}

export function DirectoryStructure({ className }: DirectoryStructureProps) {
  // Kun project structure
  const topLevelStructure: DirectoryNode = {
    name: "kun/",
    type: "directory",
    description: "Remote AI Development Infrastructure",
    children: [
      {
        name: "scripts/",
        type: "directory",
        description: "Setup and maintenance scripts",
        children: [
          {
            name: "phase1/",
            type: "directory",
            description: "Individual developer setup"
          },
          {
            name: "phase2/",
            type: "directory",
            description: "Team server setup"
          },
          {
            name: "phase3/",
            type: "directory",
            description: "Commercial platform setup"
          },
          {
            name: "monitoring/",
            type: "directory",
            description: "Health check scripts"
          }
        ]
      },
      {
        name: "config/",
        type: "directory",
        description: "Configuration templates",
        children: [
          {
            name: "tailscale/",
            type: "directory",
            description: "Tailscale ACL configs"
          },
          {
            name: "tmux/",
            type: "directory",
            description: "tmux session configs"
          }
        ]
      },
      {
        name: "docker/",
        type: "directory",
        description: "Container configurations",
        children: [
          {
            name: "Dockerfile",
            type: "file",
            description: "Development container"
          },
          {
            name: "docker-compose.yml",
            type: "file",
            description: "Multi-container setup"
          }
        ]
      },
      {
        name: "docs/",
        type: "directory",
        description: "Project documentation",
        children: [
          {
            name: "PROJECT-BRIEF.md",
            type: "file",
            description: "Vision and goals"
          },
          {
            name: "ARCHITECTURE.md",
            type: "file",
            description: "System design"
          },
          {
            name: "PRD.md",
            type: "file",
            description: "Requirements"
          },
          {
            name: "EPICS.md",
            type: "file",
            description: "User stories"
          }
        ]
      },
      {
        name: "src/",
        type: "directory",
        description: "Next.js documentation site",
        children: [
          {
            name: "app/",
            type: "directory",
            description: "App Router pages"
          },
          {
            name: "components/",
            type: "directory",
            description: "React components"
          }
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
