"use client"

import { cn } from "@/lib/utils"
import { type Story, getRepo } from "./config"

interface StoryBarProps {
  stories: Story[]
  selected: Story | null
  onSelect: (s: Story | null) => void
  lang: string
}

export function StoryBar({ stories, selected, onSelect, lang }: StoryBarProps) {
  const isAr = lang === "ar"

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {stories.map((s) => {
        const isActive = selected?.id === s.id
        const repo = getRepo(s.repo)

        return (
          <span
            key={s.id}
            onClick={() => onSelect(isActive ? null : s)}
            className={cn(
              "cursor-pointer text-sm font-mono transition-colors",
              isActive
                ? "text-foreground"
                : s.status === "active"
                  ? "text-muted-foreground/70 hover:text-foreground"
                  : "text-muted-foreground/30 hover:text-muted-foreground/50"
            )}
          >
            {isAr ? s.nameAr : s.name}
            {s.issue && (
              <a
                href={`https://github.com/${repo?.github}/issues/${s.issue}`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="ml-1 text-xs text-muted-foreground/30 hover:text-muted-foreground"
              >
                #{s.issue}
              </a>
            )}
          </span>
        )
      })}
    </div>
  )
}
