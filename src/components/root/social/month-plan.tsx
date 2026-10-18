"use client";

// The month grid — a brand's dated plan (plan.ts), one slot a day, each
// chipped with where its draft stands. A slot is the way into the work: Write
// it opens the Draft stage on that slot's concept, Publish opens the composer
// on the draft once one exists. Below md the grid becomes an agenda — seven
// columns of 40px do not hold a sentence.

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Locale } from "@/components/local/config";
import type { SocialDict } from "@/components/root/social/dictionary";
import { todayIso, type PlanSlot } from "@/components/root/social/plan";

export interface PlannedSlot extends PlanSlot {
  draftId: string | null;
  /** The draft's status, or null when the slot has none yet. */
  state: string | null;
}

function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

/** Every date cell of the month, Monday-first, padded with nulls. */
function monthCells(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) {
    cells.push(`${month}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}

const STATE_TONE: Record<string, string> = {
  consumed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  answered: "bg-primary/10 text-primary",
  pending: "bg-muted text-foreground",
  dismissed: "bg-muted text-muted-foreground line-through",
  failed: "bg-rose-500/10 text-rose-500",
};

export function MonthPlan({
  slots,
  lang,
  t,
  stateLabel,
}: {
  slots: PlannedSlot[];
  lang: Locale;
  t: SocialDict;
  stateLabel: (state: string) => string;
}) {
  const today = todayIso();
  const first = slots[0]?.date ?? today;
  const last = slots[slots.length - 1]?.date ?? today;
  // Open on this month while the plan runs, else on its nearest edge.
  const initial = monthOf(today < first ? first : today > last ? last : today);
  const [month, setMonth] = useState(initial);

  const byDate = useMemo(() => {
    const map = new Map<string, PlannedSlot[]>();
    for (const s of slots) {
      const list = map.get(s.date) ?? [];
      list.push(s);
      map.set(s.date, list);
    }
    return map;
  }, [slots]);

  const cells = useMemo(() => monthCells(month), [month]);
  const inMonth = slots.filter((s) => monthOf(s.date) === month);
  const locale = lang === "ar" ? "ar-u-nu-latn" : "en";
  const monthName = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, {
      weekday: "short",
      timeZone: "UTC",
    }).format(
      // 2024-01-01 was a Monday.
      new Date(Date.UTC(2024, 0, 1 + i)),
    ),
  );
  const dayLabel = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${iso}T00:00:00Z`));

  const slotCard = (s: PlannedSlot, compact: boolean) => (
    <div
      key={s.key}
      className={cn(
        "border-border bg-background rounded-lg border text-start",
        compact ? "p-1.5" : "p-3",
      )}
    >
      <div className="mb-1 flex flex-wrap items-center gap-1">
        <span className="bg-muted rounded-full px-1.5 py-0.5 text-[9px] font-medium tracking-wider uppercase">
          {s.kind}
        </span>
        <span className="text-muted-foreground truncate text-[10px]">
          {s.feature}
        </span>
      </div>
      <p
        dir="auto"
        className={cn(
          "text-foreground/90 leading-snug",
          compact ? "line-clamp-3 text-[11px]" : "text-sm",
        )}
        title={s.angle}
      >
        {s.angle}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[9px] font-medium",
            s.state ? STATE_TONE[s.state] : "text-muted-foreground border",
          )}
        >
          {s.state ? stateLabel(s.state) : t.calendarStatePlanned}
        </span>
        {s.draftId && s.state === "answered" ? (
          <Link
            href={`/${lang}/social/publish?draft=${s.draftId}`}
            className="text-primary ms-auto text-[10px] font-medium hover:underline"
          >
            {t.calendarPublishIt}
          </Link>
        ) : !s.state || s.state === "dismissed" || s.state === "failed" ? (
          <Link
            href={`/${lang}/social/draft?slot=${encodeURIComponent(s.key)}`}
            className="text-primary ms-auto text-[10px] font-medium hover:underline"
          >
            {t.calendarWriteIt}
          </Link>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t.calendarPrevMonth}
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          disabled={month <= monthOf(first)}
        >
          <ChevronLeft className="size-4 rtl:rotate-180" />
        </Button>
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">{monthName}</h4>
          {month !== monthOf(today) && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 rounded-full px-2 text-[11px]"
              onClick={() => setMonth(monthOf(today))}
            >
              {t.calendarToday}
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t.calendarNextMonth}
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          disabled={month >= monthOf(last)}
        >
          <ChevronRight className="size-4 rtl:rotate-180" />
        </Button>
      </div>

      {inMonth.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-2xl border border-dashed p-8 text-center text-sm">
          {t.calendarPlanEmptyMonth}
        </p>
      ) : (
        <>
          {/* Desktop: the month as a grid. */}
          <div className="hidden md:block">
            <div className="text-muted-foreground mb-1 grid grid-cols-7 gap-1 text-center text-[11px]">
              {weekdays.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((iso, i) => (
                <div
                  key={iso ?? `pad-${i}`}
                  className={cn(
                    "min-h-28 rounded-xl p-1",
                    iso ? "bg-muted/30" : "bg-transparent",
                    iso === today && "ring-primary/50 ring-2",
                  )}
                >
                  {iso && (
                    <>
                      <div className="text-muted-foreground mb-1 px-1 text-[10px] tabular-nums">
                        {Number(iso.slice(8))}
                      </div>
                      <div className="space-y-1">
                        {(byDate.get(iso) ?? []).map((s) => slotCard(s, true))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Phone: the month as an agenda. */}
          <ul className="space-y-3 md:hidden">
            {inMonth.map((s) => (
              <li key={s.key}>
                <p
                  className={cn(
                    "text-muted-foreground mb-1 text-xs",
                    s.date === today && "text-primary font-medium",
                  )}
                >
                  {dayLabel(s.date)}
                </p>
                {slotCard(s, false)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
