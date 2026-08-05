"use client";

// The calendar, real.
//
// content/social/pillars.json IS the recurring calendar: per-brand briefs the
// Monday seeder rotates into the draft queue by ISO week. This panel renders
// that file (statically imported — a commit redeploys the page, the showroom
// precedent), highlights the briefs this week's rotation picks, shows where
// each brief currently sits in the queue (from a 14-day server read — the
// seeder's own dedup window), and lets a contributor queue any brief now via
// the same requestSocialDraft the agent window uses.

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requestSocialDraft } from "@/actions/post-social";
import pillarsJson from "../../../../content/social/pillars.json";
import { fill } from "@/components/root/social/dictionary";
import { useSocial } from "@/components/root/social/provider";
import { isoWeek, weeklyPickIndexes } from "@/components/root/social/rotation";

/** Mirrors the seeder's default (scripts/seed-drafts.sh SEED_COUNT). */
const SEED_COUNT = 2;

interface PillarBrief {
  id: string;
  pillar: string;
  brief: string;
}

// The file's envelope carries `version` and `$comment` beside the brand
// arrays — only actual arrays of briefs count.
function briefsFor(brand: string): PillarBrief[] {
  const raw = (pillarsJson as Record<string, unknown>)[brand];
  return Array.isArray(raw) ? (raw as PillarBrief[]) : [];
}

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
  const briefs = briefsFor(product);
  const week = isoWeek(new Date());
  const picks = new Set(weeklyPickIndexes(briefs.length, week, SEED_COUNT));

  const [queueing, setQueueing] = useState<string | null>(null);
  // Optimistic queue state for briefs asked from this panel — the server
  // read behind `recent` is a page load old.
  const [justQueued, setJustQueued] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  // The seeder's dedup key, exactly: (brand, brief) within 14 days.
  const matchFor = (brief: PillarBrief) =>
    recent.find((r) => r.brand === product && r.brief === brief.brief);

  const queueNow = async (brief: PillarBrief) => {
    setQueueing(brief.id);
    setError(null);
    try {
      const res = await requestSocialDraft({ product, brief: brief.brief });
      if (res.ok) {
        setJustQueued((prev) => ({ ...prev, [brief.id]: "pending" }));
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

  const stateLabel = (status: string) => {
    const key = STATE_KEYS[status as keyof typeof STATE_KEYS];
    return key ? t[key] : status;
  };

  return (
    <section className="full-bleed from-background to-muted/20 flex flex-col bg-gradient-to-b py-16 md:py-24">
      <div className="mx-auto flex w-full max-w-4xl flex-col px-4">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t.calendarTitle}
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg font-light">
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

        {error && (
          <p
            role="alert"
            className="mx-auto mb-4 w-full max-w-3xl rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-500"
          >
            {error}
          </p>
        )}

        {briefs.length > 0 ? (
          <ul className="mx-auto w-full max-w-3xl space-y-2">
            {briefs.map((brief, index) => {
              const match = matchFor(brief);
              const state = justQueued[brief.id] ?? match?.status ?? null;
              const isPick = picks.has(index);
              return (
                <li
                  key={brief.id}
                  className={cn(
                    "border-border rounded-2xl border p-4 text-start",
                    isPick && "border-foreground/30 bg-muted/40",
                  )}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {isPick && (
                      <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase">
                        {t.calendarThisWeek}
                      </span>
                    )}
                    <span className="bg-muted rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase">
                      {brief.pillar}
                    </span>
                    <span className="text-muted-foreground ms-auto font-mono text-[10px]">
                      {brief.id}
                    </span>
                  </div>
                  <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
                    {brief.brief}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    {state ? (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase",
                          state === "consumed" &&
                            "bg-emerald-500/10 text-emerald-500",
                          state === "answered" && "bg-primary/10 text-primary",
                          state === "pending" && "bg-muted text-foreground",
                          (state === "dismissed" || state === "failed") &&
                            "bg-muted text-muted-foreground",
                        )}
                      >
                        {stateLabel(state)}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => queueNow(brief)}
                        disabled={queueing !== null}
                        className="h-7 rounded-full text-xs"
                      >
                        {queueing === brief.id
                          ? t.calendarQueueing
                          : t.calendarQueueNow}
                      </Button>
                    )}
                    {match && !justQueued[brief.id] && (
                      <span className="text-muted-foreground text-xs">
                        {t.calendarAskedRecently}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
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
}
