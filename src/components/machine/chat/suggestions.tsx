"use client"

import { cn } from "@/lib/utils"
import type { QuickAction } from "../pack/types"

/**
 * The starter cards above the empty composer, as in ChatGPT on iOS: a row that swipes sideways,
 * each card a bold line and a muted one. They come from the department pack's quick actions.
 */
export function Suggestions({ actions, isAr, onPick, disabled }: { actions: QuickAction[]; isAr: boolean; onPick: (prompt: string) => void; disabled?: boolean }) {
  if (actions.length === 0) return null
  return (
    <ul className="-mx-3 flex snap-x snap-mandatory gap-2 overflow-x-auto px-3 no-scrollbar sm:-mx-4 sm:px-4">
      {actions.map((q) => (
        <li key={q.prompt} className="contents">
          <button
            type="button"
            onClick={() => onPick(q.prompt)}
            disabled={disabled}
            className={cn("flex w-52 shrink-0 snap-start flex-col items-start rounded-2xl bg-muted/70 px-4 py-3 text-start transition-colors hover:bg-muted active:scale-[0.98] disabled:opacity-50")}
          >
            <span className="text-[15px] font-semibold">{isAr ? q.label_ar : q.label_en}</span>
            {q.prompt !== (isAr ? q.label_ar : q.label_en) && <span dir="auto" className="line-clamp-2 text-sm text-muted-foreground">{q.prompt}</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}
