"use client";

// The Publish stage — a frame around one box.
//
// Everything that used to live here has moved twice. First into the box: the
// queue, the filters, the approve-mode setting and Send are all in
// spotlight.tsx. Then the screen itself went into stage.tsx, once Draft and
// Media asked for the same head and the alternative was three copies of two
// hundred lines of scroll machinery.
//
// What is left is what only Publish knows: which box goes in the frame, and
// the two states that box cannot show for itself — a queue read that failed,
// and the first read still in flight.

import { useEffect } from "react";
import { ReviewSpotlight } from "@/components/root/social/spotlight";
import { StageFrame } from "@/components/root/social/stage";
import { useSocial } from "@/components/root/social/provider";

export function ReviewPanel() {
  const { t, reviewQueue } = useSocial();
  const { drafts, loading, error, refresh } = reviewQueue;

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <StageFrame title={t.reviewTitle}>
      {({ onEngagedChange, triggerCenter }) => (
        <>
          {/* One box: find a draft, write the copy, and send it. Its command
              row carries the per-mode counts, refresh, the filters, what
              Approve does, and Send — see spotlight.tsx. */}
          <ReviewSpotlight
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

          {/* No card list. The queue lives in the search box above — focus it
              and this brand's drafts are there; the list was the same data
              rendered twice, and the one that could not be searched. */}
          {loading && drafts.length === 0 && (
            <p className="text-muted-foreground mt-6 text-center text-sm">
              {t.checking}
            </p>
          )}

          {/* review-editor.tsx is still on disk and still holds what has not
              been folded in yet — dismiss-with-a-reason and the craft
              findings. It is not rendered anywhere; the fold continues from
              there. */}
        </>
      )}
    </StageFrame>
  );
}
