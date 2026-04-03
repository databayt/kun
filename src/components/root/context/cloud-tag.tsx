"use client"

import { cn } from "@/lib/utils"
import { type Spell } from "@/components/docs/spellbook-data"
import {
  type Story,
  type Contributor,
  type Weight,
  keywordGroups,
  getSpellsForGroup,
  computeWeight,
} from "./config"

interface CloudTagProps {
  selectedStory: Story | null
  contributor: Contributor | null
  onSelect?: (spell: Spell) => void
  skeleton?: boolean
}

const weightStyles: Record<Weight, string> = {
  5: "text-2xl font-bold text-foreground",
  4: "text-xl font-semibold text-foreground/90",
  3: "text-base font-medium text-foreground/70",
  2: "text-sm font-normal text-muted-foreground/50",
  1: "text-xs font-light text-muted-foreground/30",
}

const skeletonStyles: Record<Weight, string> = {
  5: "text-2xl font-bold",
  4: "text-xl font-semibold",
  3: "text-base font-medium",
  2: "text-sm font-normal",
  1: "text-xs font-light",
}

export function CloudTag({ selectedStory, contributor, onSelect, skeleton }: CloudTagProps) {
  const spells = keywordGroups.flatMap((g) => getSpellsForGroup(g))

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
      {spells.map((spell) => {
        const weight = computeWeight(spell.name, selectedStory, contributor)

        if (skeleton) {
          return (
            <span
              key={spell.name}
              className={cn(
                "font-mono text-muted-foreground/10 select-none",
                skeletonStyles[weight],
              )}
            >
              {spell.name}
            </span>
          )
        }

        return (
          <span
            key={spell.name}
            onClick={() => onSelect?.(spell)}
            className={cn(
              "cursor-pointer font-mono transition-all duration-200 hover:text-foreground",
              weightStyles[weight],
            )}
          >
            {spell.name}
          </span>
        )
      })}
    </div>
  )
}
