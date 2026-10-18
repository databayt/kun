import type { Locale } from "@/components/local/config";
import type { SeekEvent } from "@/lib/seek/item";

import type { ConsoleDict } from "./dictionary";
import { day, humanize, time } from "./format";

const TONE: Record<string, string> = {
  sent: "bg-chart-3",
  followup: "bg-chart-2",
  reply: "bg-chart-1",
  hold: "bg-chart-4",
  queued: "bg-chart-5",
  archive: "bg-muted-foreground/40",
  error: "bg-destructive",
  console: "bg-primary",
};

// The ledger, newest first, one block per day.
export function EventTimeline({ events, lang, t }: { events: SeekEvent[]; lang: Locale; t: ConsoleDict }) {
  if (events.length === 0) return <p className="text-muted-foreground py-10 text-sm">{t.activityEmpty}</p>;
  const days = new Map<string, SeekEvent[]>();
  for (const e of events) {
    const k = e.ts.slice(0, 10);
    days.set(k, [...(days.get(k) ?? []), e]);
  }
  return (
    <div className="space-y-8">
      {[...days.entries()].map(([k, list]) => (
        <section key={k} className="space-y-2">
          <h3 className="text-muted-foreground text-xs font-medium">
            {day(list[0].ts, lang)} · {list.length}
          </h3>
          <ol className="space-y-1.5">
            {list.map((e, n) => (
              <li key={`${e.ts}-${n}`} className="flex items-start gap-3 text-sm">
                <span className="text-muted-foreground w-12 shrink-0 font-mono text-xs leading-5">{time(e.ts, lang)}</span>
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${TONE[e.kind] ?? "bg-muted-foreground"}`} />
                <div className="min-w-0">
                  <span className="font-medium">{t.kinds[e.kind] ?? e.kind}</span>
                  {e.title && (
                    <span className="text-muted-foreground" dir="auto">
                      {" "}
                      · {e.title}
                    </span>
                  )}
                  {e.lane && <span className="text-muted-foreground text-xs"> · {humanize(e.lane)}</span>}
                  {e.detail && (
                    <p className="text-muted-foreground line-clamp-2 text-xs" dir="auto">
                      {e.detail}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
