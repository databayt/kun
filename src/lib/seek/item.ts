import { z } from "zod";

import type { TrackId } from "./tracks/types";

// One opportunity as the console sees it, whatever board or file it came
// from. Adapters map a source row into this shape; the Mac pushes it to Neon
// and every console view reads it. Keep it flat and track-agnostic: a field
// that only one track has belongs in `raw`, not here.

export const seekItemSchema = z.object({
  // Whose loop this is ("abdout"). Another person's seek pushes under theirs.
  instance: z.string().min(1),
  track: z.string() as z.ZodType<TrackId>,
  // The source record's id (a Twenty row id) — unique within an instance.
  externalId: z.string().min(1),
  lane: z.string().nullable(),
  stage: z.string(),
  tier: z.string().nullable(),
  score: z.number().nullable(),
  title: z.string(),
  org: z.string().nullable(),
  country: z.string().nullable(),
  city: z.string().nullable(),
  remote: z.string().nullable(),
  channel: z.string().nullable(),
  // Who it earns for (FOUNDER, DATABAYT, …).
  beneficiary: z.string().nullable(),
  deadline: z.string().nullable(),
  touch: z.number().nullable(),
  appliedAt: z.string().nullable(),
  lastTouchAt: z.string().nullable(),
  holdReason: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  // Where to open it in the system of record.
  recordUrl: z.string().nullable(),
  // The card's running notes, newest last.
  notes: z.string().nullable(),
  updatedAt: z.string(),
});

export type SeekItem = z.infer<typeof seekItemSchema>;

// One loop event (a ledger line) as the console sees it.
export const seekEventSchema = z.object({
  instance: z.string().min(1),
  ts: z.string(),
  kind: z.string(),
  externalId: z.string().nullable(),
  title: z.string().nullable(),
  lane: z.string().nullable(),
  detail: z.string().nullable(),
});

export type SeekEvent = z.infer<typeof seekEventSchema>;
