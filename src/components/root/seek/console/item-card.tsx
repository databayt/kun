"use client";

import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/components/local/config";
import type { SeekItem } from "@/lib/seek/item";
import type { TrackDef } from "@/lib/seek/tracks/types";
import { cn } from "@/lib/utils";

import type { ConsoleDict } from "./dictionary";
import { humanize } from "./format";
import { ItemSheet } from "./item-sheet";

// One card on any console view; opening it is the item sheet.
export function ItemCard({
  item,
  track,
  lang,
  t,
  pending,
  aside,
  className,
}: {
  item: SeekItem;
  track: TrackDef;
  lang: Locale;
  t: ConsoleDict;
  pending: boolean;
  // A view-specific line under the title (the needs queue's send clock).
  aside?: string;
  className?: string;
}) {
  return (
    <ItemSheet item={item} track={track} lang={lang} t={t} pending={pending}>
      <button
        type="button"
        className={cn(
          "bg-card hover:bg-muted/50 w-full space-y-1.5 rounded-lg border p-3 text-start transition-colors",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="line-clamp-2 text-sm font-medium" dir="auto">
            {item.title}
          </span>
          {item.score != null && item.track === "job" && (
            <span className="text-muted-foreground shrink-0 font-mono text-xs">{item.score}</span>
          )}
        </div>
        {item.org && (
          <div className="text-muted-foreground truncate text-xs" dir="auto">
            {item.org}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1">
          {item.lane && (
            <Badge variant="outline" className="text-[10px]">
              {humanize(item.lane)}
            </Badge>
          )}
          {pending && (
            <Badge variant="secondary" className="text-[10px]">
              {t.pending}
            </Badge>
          )}
        </div>
        {aside && <div className="text-muted-foreground text-xs">{aside}</div>}
        {item.holdReason && item.stage === "HOLD" && (
          <div className="text-muted-foreground line-clamp-2 text-xs" dir="auto">
            {item.holdReason}
          </div>
        )}
      </button>
    </ItemSheet>
  );
}
