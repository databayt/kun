import type { StageGroup } from "@/lib/seek/tracks/types";
import { GROUPS } from "@/lib/seek/metrics";

import type { ConsoleDict } from "./dictionary";

// Five numbers, one per stage group — the console's summary and the public
// pulse share it, so both read the same.
export function GroupStrip({ groups, t }: { groups: Record<StageGroup, number>; t: ConsoleDict }) {
  return (
    <dl className="grid grid-cols-5 gap-2">
      {GROUPS.map((g) => (
        <div key={g} className="bg-muted/30 rounded-lg border p-3 text-center">
          <dt className="text-muted-foreground text-[11px]">{t.groups[g]}</dt>
          <dd className="text-xl font-semibold tabular-nums">{groups[g]}</dd>
        </div>
      ))}
    </dl>
  );
}
