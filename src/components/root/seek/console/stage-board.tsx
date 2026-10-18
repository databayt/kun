import type { Locale } from "@/components/local/config";
import type { SeekItem } from "@/lib/seek/item";
import { funnel } from "@/lib/seek/metrics";
import type { TrackDef } from "@/lib/seek/tracks/types";

import type { ConsoleDict } from "./dictionary";
import { ItemCard } from "./item-card";

const PER_COLUMN = 40;

// Kanban by stage, columns straight from the track's StageDef list — the same
// component draws the jobs board, the funding board, or any track to come.
export function StageBoard({
  items,
  track,
  lang,
  t,
  pendingIds,
}: {
  items: SeekItem[];
  track: TrackDef;
  lang: Locale;
  t: ConsoleDict;
  pendingIds: Set<string>;
}) {
  const columns = funnel(items, track).filter((c) => c.count > 0 || c.group !== "lost");
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4">
      <div className="flex gap-3">
        {columns.map((col) => {
          const cards = items.filter((i) => i.stage === col.id);
          const def = track.stages?.find((s) => s.id === col.id);
          return (
            <section key={col.id} className="bg-muted/30 flex w-64 shrink-0 flex-col rounded-xl border p-2">
              <header className="flex items-center justify-between px-1 pb-2">
                <h3 className="text-sm font-medium">{def?.label[lang] ?? col.id}</h3>
                <span className="text-muted-foreground font-mono text-xs">{col.count}</span>
              </header>
              <div className="flex max-h-[70svh] flex-col gap-2 overflow-y-auto">
                {cards.slice(0, PER_COLUMN).map((item) => (
                  <ItemCard
                    key={item.externalId}
                    item={item}
                    track={track}
                    lang={lang}
                    t={t}
                    pending={pendingIds.has(item.externalId)}
                  />
                ))}
                {cards.length > PER_COLUMN && (
                  <p className="text-muted-foreground px-1 text-xs">+{cards.length - PER_COLUMN}</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
