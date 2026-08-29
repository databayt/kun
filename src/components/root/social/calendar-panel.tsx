"use client";

// The calendar, real — and since 2026-08-26 the same box the other stages
// wear on top of it.
//
// content/social/pillars.json IS the recurring calendar: per-brand briefs the
// Monday seeder rotates into the draft queue by ISO week. This panel renders
// that file (statically imported — a commit redeploys the page, the showroom
// precedent), highlights the briefs this week's rotation picks, shows where
// each brief currently sits in the queue (from a 14-day server read — the
// seeder's own dedup window), and lets a contributor queue any brief now via
// the same requestSocialDraft the agent window uses.
//
// The box and the list are two questions off one file, which is why both are
// here rather than one replacing the other. The list answers "what is the plan
// this week" — every brief in the plan's own order, the rotation's picks
// marked, a queue chip on each. The box answers "give me something to post
// about admission", which is the question a person actually arrives with.
// Media's stage made the same split first: the grid browses, the box finds.
//
// WHY THE STATE LIVES HERE. Both surfaces can file a brief and both draw the
// result, so `queueing` and the optimistic `justQueued` belong to neither.
// Queue from the box and the card below has to grey out in the same breath —
// one owner, two readers.

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requestSocialDraft } from "@/actions/post-social";
import { fill } from "@/components/root/social/dictionary";
import { pillarsFor } from "@/components/root/social/pillars";
import { useSocial } from "@/components/root/social/provider";
import { StageFrame } from "@/components/root/social/stage";
import {
  CalendarSpotlight,
  type CalendarRow,
} from "@/components/root/social/calendar-spotlight";
import {
  SEED_COUNT,
  isoWeek,
  weeklyPickIndexes,
} from "@/components/root/social/rotation";

export interface RecentAsk {
  brand: string;
  brief: string;
  status: string;
  createdAt: string;
}

const STATE_KEYS = {
  pending: "calendarStatePending",
  answered: "calendarStateAnswered",
  consumed: "calendarStateConsumed",
  dismissed: "calendarStateDismissed",
  failed: "calendarStateFailed",
} as const;

export function CalendarPanel({ recent }: { recent: RecentAsk[] }) {
  const { lang, t, product } = useSocial();
  const week = isoWeek(new Date());

  const [queueing, setQueueing] = useState<string | null>(null);
  // Optimistic queue state for briefs asked from either surface — the server
  // read behind `recent` is a page load old.
  const [justQueued, setJustQueued] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  /**
   * The plan, with the two facts the file itself does not carry.
   *
   * `pillarsFor` rather than a local reader: it validates the shape and skips
   * a malformed row, and this file used to keep an unvalidated copy of the
   * same three lines. One plan, one reader.
   */
  const rows: CalendarRow[] = useMemo(() => {
    const briefs = pillarsFor(product);
    const picks = new Set(weeklyPickIndexes(briefs.length, week, SEED_COUNT));
    return briefs.map((brief, index) => ({
      id: brief.id,
      pillar: brief.pillar,
      brief: brief.brief,
      isPick: picks.has(index),
      // The seeder's dedup key, exactly: (brand, brief) within 14 days.
      state:
        justQueued[brief.id] ??
        recent.find((r) => r.brand === product && r.brief === brief.brief)
          ?.status ??
        null,
    }));
  }, [product, week, recent, justQueued]);

  const stateLabel = (status: string) => {
    const key = STATE_KEYS[status as keyof typeof STATE_KEYS];
    return key ? t[key] : status;
  };

  const queueNow = async (row: CalendarRow) => {
    if (row.state !== null || queueing !== null) return;
    setQueueing(row.id);
    setError(null);
    try {
      const res = await requestSocialDraft({ product, brief: row.brief });
      if (res.ok) {
        setJustQueued((prev) => ({ ...prev, [row.id]: "pending" }));
      } else {
        setError(`${t.errorMsg}${res.error}`);
      }
    } catch (err: unknown) {
      setError(
        `${t.errorMsg}${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setQueueing(null);
    }
  };

  // Everything under the fold: the week's own facts, then the plan in full.
  // It is browsing, so it sits where Media's showroom sits — outside the
  // screen the box holds, and a press down here releases the stage's lock.
  const below = (
    <section className="full-bleed from-background to-muted/20 flex flex-col bg-gradient-to-b pb-16 md:pb-24">
      <div className="mx-auto flex w-full max-w-4xl flex-col px-4">
        <div className="mb-8 text-center">
          <h3 className="text-primary text-base font-medium">
            {t.calendarTitle}
          </h3>
          <p className="text-muted-foreground mx-auto mt-3 max-w-xl text-sm leading-relaxed font-light">
            {t.calendarIntro}
          </p>
        </div>

        <div className="mx-auto mb-4 flex w-full max-w-3xl flex-wrap items-center gap-2">
          <span className="bg-muted flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
            <CalendarClock className="size-3.5" />
            {fill(t.calendarWeek, { week })}
          </span>
          <span className="text-muted-foreground text-xs">
            {fill(t.calendarSeedNote, { count: SEED_COUNT })}
          </span>
        </div>

        {rows.length > 0 ? (
          <ul className="mx-auto w-full max-w-3xl space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className={cn(
                  "border-border rounded-2xl border p-4 text-start",
                  row.isPick && "border-foreground/30 bg-muted/40",
                )}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {row.isPick && (
                    <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase">
                      {t.calendarThisWeek}
                    </span>
                  )}
                  <span className="bg-muted rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase">
                    {row.pillar}
                  </span>
                  <span className="text-muted-foreground ms-auto font-mono text-[10px]">
                    {row.id}
                  </span>
                </div>
                <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
                  {row.brief}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  {row.state ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase",
                        row.state === "consumed" &&
                          "bg-emerald-500/10 text-emerald-500",
                        row.state === "answered" &&
                          "bg-primary/10 text-primary",
                        row.state === "pending" && "bg-muted text-foreground",
                        (row.state === "dismissed" || row.state === "failed") &&
                          "bg-muted text-muted-foreground",
                      )}
                    >
                      {stateLabel(row.state)}
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => queueNow(row)}
                      disabled={queueing !== null}
                      className="h-7 rounded-full text-xs"
                    >
                      {queueing === row.id
                        ? t.calendarQueueing
                        : t.calendarQueueNow}
                    </Button>
                  )}
                  {row.state && !justQueued[row.id] && (
                    <span className="text-muted-foreground text-xs">
                      {t.calendarAskedRecently}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="border-border mx-auto w-full max-w-3xl rounded-2xl border border-dashed p-8 text-center">
            <p className="text-muted-foreground mx-auto max-w-md text-sm leading-relaxed">
              {t.calendarNoPillars}
            </p>
          </div>
        )}

        <p className="mt-8 text-center">
          <Link
            href={`/${lang}/docs/social/strategy`}
            className="text-primary text-sm hover:underline"
          >
            {t.stageNoteDocs}
            <ArrowRight className="ms-1 inline size-4 align-middle rtl:rotate-180" />
          </Link>
        </p>
      </div>
    </section>
  );

  return (
    <StageFrame title={t.calendarStageTitle} below={below}>
      {({ onEngagedChange, triggerCenter }) => (
        <>
          <CalendarSpotlight
            rows={rows}
            queueing={queueing}
            onQueue={queueNow}
            stateLabel={stateLabel}
            onEngagedChange={onEngagedChange}
            triggerCenter={triggerCenter}
          />

          {error && (
            <p
              role="alert"
              className="mx-auto mt-4 max-w-3xl rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-500"
            >
              {error}
            </p>
          )}
        </>
      )}
    </StageFrame>
  );
}
