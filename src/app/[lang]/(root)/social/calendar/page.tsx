import { Suspense } from "react";
import { db } from "@/lib/db";
import {
  CalendarPanel,
  type RecentAsk,
} from "@/components/root/social/calendar-panel";

/**
 * The calendar stage — pillars.json rendered as the recurring plan, this
 * week's rotation picks highlighted, each brief chipped with where it sits
 * in the draft queue. The one server read covers the seeder's 14-day dedup
 * window, so "asked recently" here means exactly what it means to the seeder.
 */
export default function SocialCalendarPage() {
  return (
    <Suspense fallback={<CalendarPanel recent={[]} />}>
      <CalendarContent />
    </Suspense>
  );
}

async function CalendarContent() {
  let recent: RecentAsk[] = [];
  try {
    const rows = await db.socialDraftRequest.findMany({
      where: {
        createdAt: { gt: new Date(Date.now() - 14 * 24 * 60 * 60_000) },
      },
      orderBy: { createdAt: "desc" },
      select: { brand: true, brief: true, status: true, createdAt: true },
    });
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
  return <CalendarPanel recent={recent} />;
}
