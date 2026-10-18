import type { SeekEvent, SeekItem } from "./item";
import { countByGroup, weekly } from "./metrics";
import type { StageGroup, TrackDef } from "./tracks/types";

// What the public /seek page may show: counts, never a name, an org, a
// contact or a link. Built only from numbers so nothing personal can leak by
// accident when a field is added to SeekItem.
export interface Pulse {
  groups: Record<StageGroup, number>;
  total: number;
  week: { sent: number; replies: number; followups: number };
  lastTickAt: string | null;
}

export function toPulse(
  items: readonly SeekItem[],
  events: readonly SeekEvent[],
  tracks: readonly TrackDef[],
  lastTickAt: string | null,
  now = new Date(),
): Pulse {
  const groups: Record<StageGroup, number> = { inbox: 0, needs: 0, in_play: 0, won: 0, lost: 0 };
  for (const t of tracks) {
    const g = countByGroup(items, t);
    for (const k of Object.keys(groups) as StageGroup[]) groups[k] += g[k];
  }
  const w = weekly(events, now);
  return {
    groups,
    total: Object.values(groups).reduce((a, b) => a + b, 0),
    week: { sent: w.sent, replies: w.replies, followups: w.followups },
    lastTickAt,
  };
}
