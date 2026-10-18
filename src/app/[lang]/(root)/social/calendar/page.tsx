import { Suspense } from "react";
import { db } from "@/lib/db";
import {
  CalendarPanel,
  type RecentAsk,
  type SlotDraft,
} from "@/components/root/social/calendar-panel";

/**
 * The calendar stage — a brand's dated plan (plan.ts) as a month grid, each
 * slot chipped with its draft; brands without one get pillars.json rendered
 * as the recurring plan, this week's rotation picks highlighted, each brief chipped with where it sits
 * in the draft queue. The one server read covers the seeder's 14-day dedup
 * window, so "asked recently" here means exactly what it means to the seeder.
 */
export default function SocialCalendarPage() {
  return (
    <Suspense fallback={<CalendarPanel recent={[]} slotDrafts={[]} />}>
      <CalendarContent />
    </Suspense>
  );
}

async function CalendarContent() {
  let recent: RecentAsk[] = [];
  let slotDrafts: SlotDraft[] = [];
  try {
    const [rows, slotted] = await Promise.all([
      db.socialDraftRequest.findMany({
        where: {
          createdAt: { gt: new Date(Date.now() - 14 * 24 * 60 * 60_000) },
        },
        orderBy: { createdAt: "desc" },
        select: { brand: true, brief: true, status: true, createdAt: true },
      }),
      // Every live turn that answers a plan slot — the month grid's chips.
      // Superseded turns are history; the thread's latest turn speaks for it.
      db.socialDraftRequest.findMany({
        where: { slot: { not: null }, status: { not: "superseded" } },
        orderBy: { createdAt: "asc" },
        select: { id: true, slot: true, status: true },
      }),
    ]);
    slotDrafts = slotted.map((row) => ({
      id: row.id,
      slot: row.slot as string,
      status: row.status,
    }));
    recent = rows.map((row) => ({
      brand: row.brand,
      brief: row.brief,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    }));
  } catch {
    // No DATABASE_URL (preview deployments) — the calendar still renders the
    // plan; only the queue chips go quiet.
  }
  return <CalendarPanel recent={recent} slotDrafts={slotDrafts} />;
}
