"use client";

import type { Locale } from "@/components/local/config";
import type { SeekItem } from "@/lib/seek/item";
import type { TrackDef } from "@/lib/seek/tracks/types";

import type { ConsoleDict } from "./dictionary";
import { ago, humanize, stageLabel } from "./format";
import { ItemSheet } from "./item-sheet";

// The whole board as rows, filtered by the URL (?lane=&stage=&q=). The form
// is a plain GET so filters are links you can share and reload. One client
// module end to end: a server table with a client sheet per row streamed
// empty cells mid-<tbody> and failed hydration. `now` comes from the server
// so "3 days ago" renders the same on both sides.
export function ItemTable({
  items,
  track,
  lang,
  t,
  pendingIds,
  filters,
  lanes,
  now,
}: {
  items: SeekItem[];
  track: TrackDef;
  lang: Locale;
  t: ConsoleDict;
  pendingIds: Set<string>;
  filters: { lane?: string; stage?: string; q?: string };
  lanes: string[];
  now: number;
}) {
  const q = filters.q?.toLowerCase();
  const rows = items.filter(
    (i) =>
      (!filters.lane || i.lane === filters.lane) &&
      (!filters.stage || i.stage === filters.stage) &&
      (!q || `${i.title} ${i.org ?? ""}`.toLowerCase().includes(q)),
  );
  const select = "border-input h-8 rounded-md border bg-transparent px-2 text-sm";
  return (
    <div className="space-y-4">
      <form className="flex flex-wrap gap-2" method="get">
        <input type="hidden" name="track" value={track.id} />
        <input name="q" defaultValue={filters.q} placeholder={t.search} className={`${select} w-56`} />
        <select name="lane" defaultValue={filters.lane ?? ""} className={select} aria-label={t.lane}>
          <option value="">{t.allLanes}</option>
          {lanes.map((l) => (
            <option key={l} value={l}>
              {humanize(l)}
            </option>
          ))}
        </select>
        <select name="stage" defaultValue={filters.stage ?? ""} className={select} aria-label={t.stage}>
          <option value="">{t.allStages}</option>
          {(track.stages ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.label[lang]}
            </option>
          ))}
        </select>
        <button type="submit" className={`${select} hover:bg-muted`}>
          ↵
        </button>
        <span className="text-muted-foreground self-center text-xs">{rows.length}</span>
      </form>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b">
              {[t.title_, t.org, t.lane, t.stage, t.score, t.country, t.updated].map((h) => (
                <th key={h} className="px-3 py-2 text-start font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 300).map((i) => (
              <tr key={i.externalId} className="border-b align-top last:border-0">
                <td className="px-3 py-2">
                  <ItemSheet item={i} track={track} lang={lang} t={t} pending={pendingIds.has(i.externalId)}>
                    <button type="button" className="max-w-[36ch] truncate text-start hover:underline" dir="auto">
                      {i.title}
                    </button>
                  </ItemSheet>
                </td>
                <td className="text-muted-foreground max-w-[20ch] truncate px-3 py-2" dir="auto">
                  {i.org ?? "—"}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{humanize(i.lane)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {stageLabel(track, i.stage, lang)}
                  {pendingIds.has(i.externalId) && <span className="text-muted-foreground"> · {t.pending}</span>}
                </td>
                <td className="px-3 py-2 font-mono">{i.score ?? "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">{humanize(i.country)}</td>
                <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">{ago(i.updatedAt, lang, t.never, now)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
