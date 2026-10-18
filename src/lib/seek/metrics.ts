import type { SeekEvent, SeekItem } from "./item";
import type { StageGroup, TrackDef } from "./tracks/types";

// Pure counts over items and events. Every console view and the public pulse
// read through these, so a number means the same thing everywhere.

export const GROUPS: readonly StageGroup[] = ["inbox", "needs", "in_play", "won", "lost"];

export function stageGroup(track: TrackDef, stage: string): StageGroup {
  return track.stages?.find((s) => s.id === stage)?.group ?? "inbox";
}

export function countByStage(items: readonly SeekItem[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of items) out[i.stage] = (out[i.stage] ?? 0) + 1;
  return out;
}

export function countByGroup(
  items: readonly SeekItem[],
  track: TrackDef,
): Record<StageGroup, number> {
  const out = Object.fromEntries(GROUPS.map((g) => [g, 0])) as Record<StageGroup, number>;
  for (const i of items) if (i.track === track.id) out[stageGroup(track, i.stage)] += 1;
  return out;
}

// Ordered stage counts for one track — the board's column headers.
export function funnel(
  items: readonly SeekItem[],
  track: TrackDef,
): { id: string; group: StageGroup; count: number }[] {
  const counts = countByStage(items.filter((i) => i.track === track.id));
  return (track.stages ?? []).map((s) => ({ id: s.id, group: s.group, count: counts[s.id] ?? 0 }));
}

// Cards waiting on the person: everything in a "needs" stage, the ones with a
// clock (queued to send) first, then by score.
export function needsMe(items: readonly SeekItem[], track: TrackDef): SeekItem[] {
  return items
    .filter((i) => i.track === track.id && stageGroup(track, i.stage) === "needs")
    .sort((a, b) => {
      const qa = a.stage === "QUEUED" ? 0 : 1;
      const qb = b.stage === "QUEUED" ? 0 : 1;
      return qa - qb || (b.score ?? 0) - (a.score ?? 0);
    });
}

export interface Weekly {
  sent: number;
  followups: number;
  replies: number;
  holds: number;
  errors: number;
}

// Events in the last `days` days (default 7), by kind.
export function weekly(
  events: readonly SeekEvent[],
  now = new Date(),
  days = 7,
): Weekly {
  const since = now.getTime() - days * 86_400_000;
  const out: Weekly = { sent: 0, followups: 0, replies: 0, holds: 0, errors: 0 };
  const seenReply = new Set<string>();
  for (const e of events) {
    if (Date.parse(e.ts) < since) continue;
    if (e.kind === "sent") out.sent += 1;
    else if (e.kind === "followup") out.followups += 1;
    else if (e.kind === "hold") out.holds += 1;
    else if (e.kind === "error") out.errors += 1;
    else if (e.kind === "reply") {
      // The inbox can log one reply twice; count a card's reply once.
      const key = `${e.externalId}:${e.detail}`;
      if (!seenReply.has(key)) out.replies += 1;
      seenReply.add(key);
    }
  }
  return out;
}
