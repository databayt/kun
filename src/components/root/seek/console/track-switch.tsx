import Link from "next/link";

import type { Locale } from "@/components/local/config";
import type { TrackDef } from "@/lib/seek/tracks/types";
import { cn } from "@/lib/utils";

import type { ConsoleDict } from "./dictionary";

// Which board a view shows — a link per track that has console stages, so the
// choice lives in the URL (?track=funding) and survives a reload.
export function TrackSwitch({
  tracks,
  active,
  base,
  lang,
  t,
  counts,
}: {
  tracks: readonly TrackDef[];
  active: string;
  base: string;
  lang: Locale;
  t: ConsoleDict;
  counts: Record<string, number>;
}) {
  return (
    <div className="inline-flex w-fit gap-1 rounded-full border p-0.5 text-xs">
      {tracks.map((tr) => (
        <Link
          key={tr.id}
          href={`${base}?track=${tr.id}`}
          className={cn(
            "rounded-full px-3 py-1 transition-colors",
            tr.id === active ? "bg-muted text-primary" : "text-muted-foreground hover:text-primary",
          )}
        >
          {t.tracks[tr.id] ?? tr.label[lang]} · {counts[tr.id] ?? 0}
        </Link>
      ))}
    </div>
  );
}
