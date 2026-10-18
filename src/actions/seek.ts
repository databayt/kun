"use server";

import { revalidatePath } from "next/cache";

import { currentContributor } from "@/components/auth/auth";
import { db } from "@/lib/db";
import { commandTarget, seekCommandSchema } from "@/lib/seek/commands";
import { getNotes, resolveInstance } from "@/lib/seek/store";

// The console's only write: queue a command for the loop. The Mac's pull step
// applies it on the next tick (scripts/seek/pull.ts); nothing here touches the
// board directly, so the loop's walls stay the only walls.
export async function enqueueSeekCommand(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const who = await currentContributor();
  if (!who) return { ok: false, error: "Forbidden: contributors only." };

  const parsed = seekCommandSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid command" };

  const instance = await resolveInstance();
  if (!instance) return { ok: false, error: "No seek loop has pushed yet." };

  const cmd = parsed.data;
  const externalId = commandTarget(cmd);
  if (externalId) {
    const exists = await db.seekItem.findUnique({
      where: { instance_externalId: { instance: instance.id, externalId } },
      select: { id: true },
    });
    if (!exists) return { ok: false, error: "That card is not on the board." };
  }

  await db.seekCommand.create({
    data: { instance: instance.id, kind: cmd.kind, externalId, payload: cmd, by: who.email },
  });
  revalidatePath("/[lang]/seek", "layout");
  return { ok: true };
}

// One card's running notes, for the item sheet (lists leave them out).
export async function loadSeekNotes(externalId: string): Promise<string | null> {
  if (!(await currentContributor())) return null;
  const instance = await resolveInstance();
  return instance ? getNotes(instance.id, externalId) : null;
}
