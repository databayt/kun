"use client";

// The Publish stage — a frame around one box.
//
// Everything that used to live here has moved into that box: the queue, the
// filters, the approve-mode setting and Send are all in spotlight.tsx now, and
// this file is what is left once one surface does the work of two — a heading,
// the box, and the two states the box cannot show for itself (a queue read
// that failed, and the first read still in flight).

import { useEffect } from "react";

import { ReviewSpotlight } from "@/components/root/social/spotlight";
import { useSocial } from "@/components/root/social/provider";

/** Defined in globals.css, on <html> — the document is the scroll container. */
const SNAP_CLASS = "snap-stage";

export function ReviewPanel() {
  const { t, reviewQueue } = useSocial();
  const { drafts, loading, error, refresh } = reviewQueue;

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // The stage asks the document to settle on it. Only while this stage is
  // mounted: snapping is scoped to the route that wants it, so navigating to
  // Calendar or Measure leaves the page scrolling normally. The class has to
  // land on <html> because that is the scroll container — see globals.css.
  useEffect(() => {
    document.documentElement.classList.add(SNAP_CLASS);
    return () => document.documentElement.classList.remove(SNAP_CLASS);
  }, []);

  return (
    // A full screen, and centred in it: the stage is one column — a search
    // line and the composer under it — so anything less left it stranded at
    // the top of a mostly empty page.
    //
    // `snap-start` is the other half: scrolling down from the header settles
    // here rather than halfway, so the stage arrives whole. Focusing the
    // search does the same deliberately — see spotlight.tsx, which climbs to
    // this section and lifts it.
    <section className="full-bleed from-background to-muted/20 flex min-h-screen snap-start flex-col justify-center bg-gradient-to-b py-16 md:py-24">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4">
        <div className="w-full">
          {/* One word. The paragraph that stood here explained where writing
              and media happen, which the tab row above already answers by
              being a tab row. */}
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">
              {t.reviewTitle}
            </h2>
          </div>

          {/* One box: find a draft, write the copy, and send it. Its command
              row carries the per-mode counts, refresh, the filters, what
              Approve does, and Send — see spotlight.tsx. */}
          <div className="mb-4">
            <ReviewSpotlight />
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

          {/* review-editor.tsx is still on disk and still holds what has not
              been folded in yet — stage-for-review, dismiss-with-a-reason, the
              craft findings, the media tray and the schedule picker. It is not
              rendered anywhere; the fold continues from there. */}
        </div>
      </div>
    </section>
  );
}
