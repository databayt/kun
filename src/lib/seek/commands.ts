import { z } from "zod";

// What the console may ask the loop to do. The web only enqueues; the Mac's
// pull step applies each one through the loop's own tools on its next tick,
// so every wall the CLI has (adopt's hard limits, the send gate) still holds.

const card = { externalId: z.string().min(1) };

export const seekCommandSchema = z.discriminatedUnion("kind", [
  // HOLD → APPROVED: the person's yes; the next send window sends it.
  z.object({ kind: z.literal("approve"), ...card }),
  // Anything → HOLD with a reason.
  z.object({ kind: z.literal("hold"), ...card, reason: z.string().trim().min(1).max(300) }),
  // QUEUED → HOLD before the veto window closes.
  z.object({ kind: z.literal("veto"), ...card, reason: z.string().trim().max(300).optional() }),
  // Move to any stage the track declares (applied, interview, rejected …).
  z.object({
    kind: z.literal("move"),
    ...card,
    stage: z.string().min(1),
    note: z.string().trim().max(300).optional(),
  }),
  // The send kill switch.
  z.object({ kind: z.literal("send"), on: z.boolean() }),
  z.object({ kind: z.literal("pauseLane"), lane: z.string().min(1), paused: z.boolean() }),
  z.object({ kind: z.literal("dailyCap"), n: z.number().int().min(0).max(100) }),
  // A posting the person found: lands in the inbox for the next ingest.
  z.object({
    kind: z.literal("ingest"),
    url: z.url().optional(),
    text: z.string().trim().max(20_000).optional(),
    lane: z.string().optional(),
  }).refine((c) => c.url || c.text, { message: "a URL or the posting text" }),
]);

export type SeekCommand = z.infer<typeof seekCommandSchema>;
export type SeekCommandKind = SeekCommand["kind"];

// Card commands carry an externalId; loop commands don't.
export const commandTarget = (c: SeekCommand): string | null =>
  "externalId" in c ? c.externalId : null;
