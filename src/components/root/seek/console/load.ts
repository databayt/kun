import "server-only";

import { cache } from "react";

import { listEvents, listItems, listPending, resolveInstance } from "@/lib/seek/store";
import { getTrack } from "@/lib/seek/tracks/registry";
import type { TrackDef } from "@/lib/seek/tracks/types";

// One read per request, shared by the hub layout and the view under it
// (React.cache dedupes within a render). The store guards every read.

// Tracks with console stages, in registry order.
export const CONSOLE_TRACKS: readonly TrackDef[] = [getTrack("job"), getTrack("funding")];

export const pickTrack = (id: string | undefined): TrackDef =>
  CONSOLE_TRACKS.find((t) => t.id === id) ?? CONSOLE_TRACKS[0];

export const loadConsole = cache(async () => {
  const instance = await resolveInstance();
  if (!instance) return null;
  const [items, events, pending] = await Promise.all([
    listItems(instance.id),
    listEvents(instance.id),
    listPending(instance.id),
  ]);
  return {
    instance,
    items,
    events,
    pending,
    pendingIds: new Set(pending.map((p) => p.externalId).filter((v): v is string => Boolean(v))),
  };
});
