import { afterAll, describe, expect, it } from "vitest";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

// Hits a real database. Skipped when DATABASE_URL is absent so CI stays
// hermetic — the point of these is to pin behaviour that only Postgres can
// actually demonstrate (cascade, atomic claim), which a mock would fake.
const connectionString = (process.env.DATABASE_URL ?? "").trim();
const describeDb = connectionString ? describe : describe.skip;

describeDb("social queue", () => {
  const db = new PrismaClient({
    adapter: new PrismaNeon({ connectionString }),
  });
  const created: string[] = [];

  afterAll(async () => {
    if (created.length) {
      await db.socialPiece.deleteMany({ where: { id: { in: created } } });
    }
    await db.$disconnect();
  });

  async function seed(scheduledFor: Date) {
    const piece = await db.socialPiece.create({
      data: {
        brand: "databayt",
        locale: "ar",
        source: "vitest",
        variants: {
          create: [
            {
              channel: "telegram",
              text: "t",
              status: "scheduled",
              scheduledFor,
            },
          ],
        },
      },
      include: { variants: true },
    });
    created.push(piece.id);
    return piece;
  }

  it("round-trips a piece with its variants", async () => {
    const piece = await seed(new Date(Date.now() - 60_000));
    expect(piece.variants).toHaveLength(1);
    expect(piece.variants[0].status).toBe("scheduled");
  });

  it("finds only variants whose scheduledFor has passed", async () => {
    const due = await seed(new Date(Date.now() - 60_000));
    const future = await seed(new Date(Date.now() + 60 * 60_000));

    const rows = await db.socialVariant.findMany({
      where: {
        status: "scheduled",
        scheduledFor: { lte: new Date() },
        pieceId: { in: [due.id, future.id] },
      },
    });

    expect(rows.map((r) => r.pieceId)).toEqual([due.id]);
  });

  it("cannot be claimed twice — the no-double-post guarantee", async () => {
    const piece = await seed(new Date(Date.now() - 60_000));
    const id = piece.variants[0].id;

    // A conditional update is the claim. Two concurrent drain runs both issue
    // it; exactly one may match, or the post goes out twice.
    const first = await db.socialVariant.updateMany({
      where: { id, status: "scheduled" },
      data: { status: "publishing" },
    });
    const second = await db.socialVariant.updateMany({
      where: { id, status: "scheduled" },
      data: { status: "publishing" },
    });

    expect(first.count).toBe(1);
    expect(second.count).toBe(0);
  });

  it("cascades variants when the piece is deleted", async () => {
    const piece = await seed(new Date());
    await db.socialPiece.delete({ where: { id: piece.id } });
    created.splice(created.indexOf(piece.id), 1);

    expect(await db.socialVariant.count({ where: { pieceId: piece.id } })).toBe(
      0,
    );
  });
});
