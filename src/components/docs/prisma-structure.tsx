'use client'

import { Folder, File } from 'lucide-react'

interface DirectoryNode {
  name: string
  type: 'file' | 'directory'
  description?: string
  children?: DirectoryNode[]
}

interface PrismaStructureProps {
  className?: string
}

export function PrismaStructure({ className }: PrismaStructureProps) {
  const prismaStructure: DirectoryNode = {
    name: "prisma/",
    type: "directory",
    description: "Database schema and migrations",
    children: [
      {
        name: "schema.prisma",
        type: "file",
        description: "Main config with datasource and generator"
      },
      {
        name: "models/",
        type: "directory",
        description: "Schema files organized by domain",
        children: [
          { name: "auth.prisma", type: "file", description: "User, Account, tokens" },
          { name: "config.prisma", type: "file", description: "Application settings" }
        ]
      },
      {
        name: "migrations/",
        type: "directory",
        description: "Auto-generated migration files"
      },
      { name: "seed.ts", type: "file", description: "Database seeding script" }
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
        <FileTree item={prismaStructure} />
      </div>
    </div>
  )
}
