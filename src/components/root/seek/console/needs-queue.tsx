import type { Locale } from "@/components/local/config";
import type { SeekEvent, SeekItem } from "@/lib/seek/item";
import { needsMe } from "@/lib/seek/metrics";
import type { TrackDef } from "@/lib/seek/tracks/types";

import type { ConsoleDict } from "./dictionary";
import { time } from "./format";
import { ItemCard } from "./item-card";

// Everything waiting on the person, the cards with a send clock first. A
// QUEUED card's clock is its latest "queued" event plus the veto window.
export function NeedsQueue({
  items,
  events,
  track,
  vetoHours,
  lang,
  t,
  pendingIds,
}: {
  items: SeekItem[];
  events: SeekEvent[];
  track: TrackDef;
  vetoHours: number;
  lang: Locale;
  t: ConsoleDict;
  pendingIds: Set<string>;
}) {
  const queue = needsMe(items, track);
  if (queue.length === 0) return <p className="text-muted-foreground py-10 text-sm">{t.needsEmpty}</p>;

  const queuedAt = new Map<string, string>();
  for (const e of events) if (e.kind === "queued" && e.externalId && !queuedAt.has(e.externalId)) queuedAt.set(e.externalId, e.ts);

  const groups = (track.stages ?? []).filter((s) => s.group === "needs");
  return (
    <div className="space-y-8">
      {groups.map((stage) => {
        const cards = queue.filter((i) => i.stage === stage.id);
        if (cards.length === 0) return null;
        return (
          <section key={stage.id} className="space-y-3">
            <h3 className="text-sm font-medium">
              {stage.label[lang]} <span className="text-muted-foreground font-mono text-xs">{cards.length}</span>
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((item) => {
                const at = queuedAt.get(item.externalId);
                const aside =
                  item.stage === "QUEUED" && at
                    ? `${t.sendsAfter} ${time(new Date(Date.parse(at) + vetoHours * 3_600_000).toISOString(), lang)}`
                    : undefined;
                return (
                  <ItemCard
                    key={item.externalId}
                    item={item}
                    track={track}
                    lang={lang}
                    t={t}
                    pending={pendingIds.has(item.externalId)}
                    aside={aside}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
