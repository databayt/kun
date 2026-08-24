"use client";

// The Publish stage — a review queue, not a composer.
//
// Answered draft asks (copy AND/OR media) queue here oldest-first; the next
// one up is highlighted, every upcoming one is browsable, and loading one
// opens the editor to fine-tune and decide. Nothing is created from blank on
// this page — an empty queue points at the Draft stage instead of offering a
// textarea. The settings popover decides what Approve does: publish right
// away, or write `scheduled` variants the ~15-minute cron drain delivers.

import { useEffect, useState } from "react";
import { Film, Images, RefreshCw, Settings2 } from "lucide-react";

import { ReviewSpotlight } from "@/components/root/social/spotlight";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { fill } from "@/components/root/social/dictionary";
import { PRODUCTS } from "@/components/root/social/products";
import { useSocial } from "@/components/root/social/provider";
import { ReviewEditor } from "@/components/root/social/review-editor";
import { splitMedia } from "@/lib/media-kind";

type ApproveMode = "now" | "schedule";

const APPROVE_MODE_KEY = "social:approve-mode";

export function ReviewPanel() {
  const { t, isRTL, reviewQueue, goToStage } = useSocial();
  const { drafts, loading, error, refresh, activeDraftId, loadDraft } =
    reviewQueue;

  // The approve-mode setting, persisted per browser. Read after mount so the
  // server render never touches localStorage.
  const [approveMode, setApproveModeState] = useState<ApproveMode>("now");
  useEffect(() => {
    const stored = window.localStorage.getItem(APPROVE_MODE_KEY);
    if (stored === "now" || stored === "schedule") setApproveModeState(stored);
  }, []);
  const setApproveMode = (mode: ApproveMode) => {
    setApproveModeState(mode);
    window.localStorage.setItem(APPROVE_MODE_KEY, mode);
  };

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const brandLabel = (id: string) => {
    const p = PRODUCTS.find((product) => product.id === id);
    return p ? (isRTL ? p.labelAr : p.label) : id;
  };

  // Relative age, coarse on purpose — the queue cares about "hours vs days".
  const ageLabel = (iso: string) => {
    const minutes = Math.max(
      0,
      Math.round((Date.now() - new Date(iso).getTime()) / 60_000),
    );
    const age =
      minutes >= 60 * 24
        ? `${Math.round(minutes / (60 * 24))}d`
        : minutes >= 60
          ? `${Math.round(minutes / 60)}h`
          : `${minutes}m`;
    return fill(t.reviewAgo, { age });
  };

  return (
    <section className="full-bleed from-background to-muted/20 flex flex-col bg-gradient-to-b py-16 md:py-24">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4">
        <div className="w-full">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">
              {t.reviewTitle}
            </h2>
            <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg font-light">
              {t.reviewIntro}
            </p>
          </div>

          {/* The search bar sits above the queue it filters, and doubles as
              the way to send a line you just wrote — see spotlight.tsx. */}
          <div className="mb-6">
            <ReviewSpotlight />
          </div>

          {/* The queue header — count on one side, refresh + settings on the
              other. Settings is the whole "publish now vs delegate to cron"
              choice, so it lives here rather than per draft. */}
          <div className="mx-auto mb-4 flex w-full max-w-3xl items-center gap-2">
            <p className="text-muted-foreground text-sm">
              {fill(t.reviewQueueCount, { count: drafts.length })}
            </p>
            <div className="ms-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void refresh()}
                disabled={loading}
                className="h-8 gap-1.5 rounded-full"
              >
                <RefreshCw
                  className={cn("size-4", loading && "animate-spin")}
                />
                <span className="hidden md:flex">{t.reviewRefresh}</span>
              </Button>
              <Popover>
                <PopoverTrigger
                  aria-label={t.approveModeLabel}
                  className="border-input bg-muted text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-8 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-100 ease-in-out hover:border-transparent"
                >
                  <Settings2 className="size-4 shrink-0" />
                  <span className="hidden md:flex">
                    {approveMode === "schedule"
                      ? t.approveModeSchedule
                      : t.approveModeNow}
                  </span>
                </PopoverTrigger>
                <PopoverContent
                  align={isRTL ? "start" : "end"}
                  className="w-72 text-start"
                >
                  <p className="text-muted-foreground mb-2 text-xs font-medium">
                    {t.approveModeLabel}
                  </p>
                  <div className="space-y-1.5">
                    {(["now", "schedule"] as const).map((mode) => (
                      <label
                        key={mode}
                        className="hover:bg-muted flex cursor-pointer items-start gap-2 rounded-lg p-2 text-sm"
                      >
                        <input
                          type="radio"
                          name="approve-mode"
                          checked={approveMode === mode}
                          onChange={() => setApproveMode(mode)}
                          className="mt-1"
                        />
                        <span>
                          <span className="block font-medium">
                            {mode === "now"
                              ? t.approveModeNow
                              : t.approveModeSchedule}
                          </span>
                          <span className="text-muted-foreground block text-xs">
                            {mode === "now"
                              ? t.approveModeNowHint
                              : t.approveModeScheduleHint}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="mx-auto mb-4 max-w-3xl rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-500"
            >
              {error}
            </p>
          )}

          {/* No card list. The queue lives in the search box above — focus it
              and this brand's drafts are there; the list was the same data
              rendered twice, and the one that could not be searched. */}
          {loading && drafts.length === 0 && (
            <p className="text-muted-foreground mb-6 text-center text-sm">
              {t.checking}
            </p>
          )}

          {/* Always mounted. An empty composer IS the direct-write path — this
              stage used to render nothing until a queue draft was picked, which
              is why publishPostDirect sat with no caller anywhere in the repo. */}
          <ReviewEditor
            approveMode={approveMode}
            onDecided={() => void refresh()}
          />
        </div>
      </div>
    </section>
  );
}
