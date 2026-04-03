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
  onSelect: (spell: Spell) => void
}

const weightStyles: Record<Weight, string> = {
  5: "text-2xl font-bold text-foreground",
  4: "text-xl font-semibold text-foreground/90",
  3: "text-base font-medium text-foreground/70",
  2: "text-sm font-normal text-muted-foreground/50",
  1: "text-xs font-light text-muted-foreground/30",
}

export function CloudTag({ selectedStory, contributor, onSelect }: CloudTagProps) {
  const spells = keywordGroups.flatMap((g) => getSpellsForGroup(g))

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
      {spells.map((spell) => {
        const weight = computeWeight(spell.name, selectedStory, contributor)

        return (
          <span
            key={spell.name}
            onClick={() => onSelect(spell)}
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
