import { afterAll, describe, expect, it } from "vitest";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

// Hits a real database, like social-queue.test.ts and for the same reason: the
// review queue's correctness rests on a conditional status transition, which is
// a Postgres guarantee a mock would only pretend to have. Skipped when
// DATABASE_URL is absent so CI stays hermetic.
const connectionString = (process.env.DATABASE_URL ?? "").trim();
const describeDb = connectionString ? describe : describe.skip;

describeDb("social review queue", () => {
  const db = new PrismaClient({
    adapter: new PrismaNeon({ connectionString }),
  });
  const created: string[] = [];

  afterAll(async () => {
    if (created.length) {
      await db.socialDraftRequest.deleteMany({
        where: { id: { in: created } },
      });
    }
    await db.$disconnect();
  });

  async function seedAnswered(mediaUrls: string[] = []) {
    const row = await db.socialDraftRequest.create({
      data: {
        brand: "databayt",
        brief: "vitest — review queue lifecycle",
        status: "answered",
        ar: "نص عربي",
        en: "English copy",
        mediaUrls,
        answeredAt: new Date(),
      },
    });
    created.push(row.id);
    return row;
  }

  it("round-trips a full draft — copy and its media set", async () => {
    const row = await seedAnswered([
      "https://cdn.example.com/a.png",
      "https://cdn.example.com/b.mp4",
    ]);
    expect(row.ar).toBe("نص عربي");
    expect(row.mediaUrls).toEqual([
      "https://cdn.example.com/a.png",
      "https://cdn.example.com/b.mp4",
    ]);
  });

  it("carries a text-only draft — media is optional, not implied", async () => {
    const row = await seedAnswered();
    expect(row.mediaUrls).toEqual([]);
  });

  it("cannot be approved twice — the no-double-post guarantee", async () => {
    const row = await seedAnswered();

    // approveDraft's claim. Two reviewers pressing at the same moment both
    // issue it; exactly one may match, or the same draft publishes twice.
    const first = await db.socialDraftRequest.updateMany({
      where: { id: row.id, status: "answered" },
      data: { status: "consumed" },
    });
    const second = await db.socialDraftRequest.updateMany({
      where: { id: row.id, status: "answered" },
      data: { status: "consumed" },
    });

    expect(first.count).toBe(1);
    expect(second.count).toBe(0);
  });

  it("refuses to dismiss a draft that was already approved", async () => {
    const row = await seedAnswered();
    await db.socialDraftRequest.updateMany({
      where: { id: row.id, status: "answered" },
      data: { status: "consumed" },
    });

    // dismissDraft is conditional on `answered` too, so the two lanes cannot
    // both decide one draft.
    const dismissed = await db.socialDraftRequest.updateMany({
      where: { id: row.id, status: "answered" },
      data: { status: "dismissed" },
    });

    expect(dismissed.count).toBe(0);
  });

  it("lists only answered drafts, oldest first — what the queue reads", async () => {
    const older = await seedAnswered();
    const newer = await seedAnswered();
    // A decided draft leaves the queue.
    await db.socialDraftRequest.update({
      where: { id: newer.id },
      data: { status: "dismissed" },
    });

    const rows = await db.socialDraftRequest.findMany({
      where: { status: "answered", id: { in: [older.id, newer.id] } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    expect(rows.map((r) => r.id)).toEqual([older.id]);
  });
});
