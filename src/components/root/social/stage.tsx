"use client";

// The stage frame — half a screen, one word, one box.
//
// Lifted out of review.tsx on 2026-08-25. Publish had grown the shape the
// other stages want: a single-word heading, and a box that locks the display
// around itself when you touch it. Draft and Media asked for the same head,
// and the alternative was three copies of two hundred lines of scroll
// machinery — which would have meant three places to fix the next thing
// measured wrong about it.
//
// What this owns is the LOWER HALF of the first screen, and then the middle
// of every screen after it. The layout above takes the other half (title,
// description, tab row), so the stage opens whole on arrival instead of
// waiting below the fold for someone to find it — measured, the box used to
// render at 94% of the viewport, which is another way of saying off it. From
// there the column rises with the page until it reaches the middle, and
// sticks: scrolling on moves the page behind a box that has stopped.
//
// Touch the box and the stage locks: the page stops scrolling, and the
// heading, the box and whatever its panel is wearing hold that middle until
// you press outside.
//
// There is no scrim, no dim and no blur: the background keeps its gradient,
// the site header and the tab row keep their colours, and the only thing the
// lock does is stop the page moving. A focus mode that repaints half the
// window to say "you are focused" is louder than the thing it announces.

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Defined in globals.css, on <html> — the document is the scroll container. */
const STAGE_CLASS = "stage-open";

/**
 * Where the section's own top edge sits once the column has reached the middle.
 *
 * The sticky container pins at a quarter-screen down (`top-[25svh]`), so this
 * is the same number twice — which is what makes the distance still to travel
 * readable off one rect, with nothing measured and nothing stored.
 */
const RESTING_FRACTION = 0.25;

/** Keys that scroll a page when nothing has swallowed them first. */
const SCROLLING_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
]);

/**
 * Run once the page has stopped moving.
 *
 * Engaging the box starts a smooth scroll (`liftColumn`, below). Freezing the
 * page mid-glide would strand it, so the lock waits for three quiet frames
 * rather than guessing at a duration — the duration is the browser's, not
 * ours. Bounded, because a page that never settles must not leave the lock
 * permanently unarmed. A lift with nothing to do is quiet from the start and
 * simply falls through the grace, which costs about 150ms and no motion.
 */
function whenScrollSettles(run: () => void): () => void {
  let frame = 0;
  let seen = 0;
  let quiet = 0;
  let last = window.scrollY;
  const deadline = performance.now() + 1200;
  let cancelled = false;

  const GRACE_FRAMES = 4;
  const QUIET_FRAMES = 2;

  const tick = () => {
    if (cancelled) return;
    seen += 1;
    const now = window.scrollY;
    quiet = Math.abs(now - last) <= 0.5 ? quiet + 1 : 0;
    last = now;
    const settled = seen > GRACE_FRAMES && quiet >= QUIET_FRAMES;
    if (settled || performance.now() > deadline) {
      run();
      return;
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
  };
}

/**
 * Bring the column to the middle of the screen smoothly.
 */
function liftColumn(section: HTMLElement): void {
  const behavior: ScrollBehavior = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches
    ? "instant"
    : "smooth";
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (document.documentElement.classList.contains("stage-engaged")) {
        window.scrollTo({ top: 0, behavior });
        return;
      }
      const rest = window.innerHeight * RESTING_FRACTION;
      const rect = section.getBoundingClientRect();
      const targetScrollY = window.scrollY + (rect.top - rest);
      if (Math.abs(window.scrollY - targetScrollY) <= 1) return;
      window.scrollTo({ top: Math.max(0, targetScrollY), behavior });
    }),
  );
}

/**
 * @param title  The stage's one word.
 * @param children  Rendered inside the locked column — the box, and anything
 *   that has to stay reachable while the stage holds the screen.
 *   `onEngagedChange` is what the box calls when it opens and closes; every
 *   stage box takes the same prop, which is the whole contract between them.
 * @param below  Rendered under the column, outside the fold. A press here
 *   releases the lock, which is correct: it is a different part of the page.
 */
export function StageFrame({
  title,
  children,
  below,
}: {
  title: string;
  children: (props: {
    onEngagedChange: (engaged: boolean) => void;
    triggerCenter: () => void;
  }) => ReactNode;
  below?: ReactNode;
}) {
  // Engaged: the box is open. Locked: the page has been frozen around it.
  // Two states rather than one, because there is a scroll between them that
  // has to finish first.
  const [engaged, setEngaged] = useState(false);
  const [locked, setLocked] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);
  // The lift's target. A ref, where the boxes used to climb out to
  // `closest("section")` — the frame renders this element, so it can hold it.
  const sectionRef = useRef<HTMLElement>(null);

  const triggerCenter = () => {
    setEngaged(true);
    if (sectionRef.current) liftColumn(sectionRef.current);
  };

  // The stage asks the document to stop anchoring its scroll to a growing
  // box. Only while this stage is mounted, so navigating to Calendar or
  // Measure leaves the page behaving normally. The class has to land on
  // <html> because that is the scroll container — see globals.css.
  useEffect(() => {
    document.documentElement.classList.add(STAGE_CLASS);
    return () => {
      document.documentElement.classList.remove(STAGE_CLASS);
      document.documentElement.classList.remove("stage-engaged");
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("stage-engaged", engaged);
    if (!engaged) {
      setLocked(false);
      return;
    }
    if (sectionRef.current) liftColumn(sectionRef.current);
    return whenScrollSettles(() => setLocked(true));
  }, [engaged]);

  /**
   * Hold the page still by refusing the gestures that scroll it — NOT by
   * setting `overflow: hidden` on <html>, which was the first attempt and was
   * wrong twice over.
   *
   * It hides the scrollbar, which shifts the layout sideways wherever the
   * platform reserves room for one. And, worse, it makes the document
   * non-scrollable, which quietly kills `position: sticky` on everything
   * above: measured, the site header stopped pinning and rendered 402px above
   * the viewport, so the navigation appeared to vanish the moment the box was
   * touched. Nobody asked for that and nothing on screen explained it.
   *
   * Swallowing wheel, touch and the scrolling keys leaves the page scrollable
   * as far as CSS is concerned. Sticky keeps working, the scrollbar keeps its
   * width, and the only thing that changes is that the page stops moving.
   */
  useEffect(() => {
    if (!locked) return;

    /**
     * Can something inside the stage take this wheel instead of the page?
     *
     * The first version of this lock swallowed every wheel event, which also
     * ate the ones aimed at a scroller INSIDE the stage — the settings panel's
     * own overflow, and the horizontal card strips within it. Measured: a
     * 300px horizontal wheel over the post strip moved it 0px, while dragging
     * the same strip moved it 336. The page is what is being held still, not
     * everything on it.
     */
    const innerCanTake = (e: WheelEvent) => {
      let node = e.target instanceof Element ? e.target : null;
      while (node && node !== document.body) {
        const cs = getComputedStyle(node);
        const scrollableY =
          (cs.overflowY === "auto" || cs.overflowY === "scroll") &&
          node.scrollHeight > node.clientHeight;
        if (scrollableY) {
          const room =
            e.deltaY < 0
              ? node.scrollTop > 0
              : node.scrollTop + node.clientHeight < node.scrollHeight - 1;
          if (room) return true;
        }
        const scrollableX =
          (cs.overflowX === "auto" || cs.overflowX === "scroll") &&
          node.scrollWidth > node.clientWidth;
        if (scrollableX) {
          // A plain mouse has no deltaX, so a vertical wheel over a horizontal
          // strip counts as intent to move it — the strip is the only thing
          // under the pointer that can move at all.
          const delta = e.deltaX || e.deltaY;
          const room =
            delta < 0
              ? node.scrollLeft > 0
              : node.scrollLeft + node.clientWidth < node.scrollWidth - 1;
          if (room) return true;
        }
        node = node.parentElement;
      }
      return false;
    };

    const swallowWheel = (e: WheelEvent) => {
      if (innerCanTake(e)) return;
      e.preventDefault();
    };
    const swallow = (e: Event) => e.preventDefault();
    const onKeyDown = (e: KeyboardEvent) => {
      if (!SCROLLING_KEYS.has(e.key)) return;
      // A caret in a field owns its own arrows and spaces.
      const el = e.target;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
    };

    window.addEventListener("wheel", swallowWheel, { passive: false });
    window.addEventListener("touchmove", swallow, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("wheel", swallowWheel);
      window.removeEventListener("touchmove", swallow);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [locked]);

  /**
   * A press anywhere outside the column is the way out.
   */
  useEffect(() => {
    if (!engaged) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (target instanceof Node && columnRef.current?.contains(target)) return;
      // A portalled menu (filters) lives outside the column but belongs to it.
      if (
        target instanceof Element &&
        target.closest("[data-radix-popper-content-wrapper]")
      ) {
        return;
      }
      const active = document.activeElement;
      if (active instanceof HTMLElement) active.blur();
      setEngaged(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const active = document.activeElement;
        if (active instanceof HTMLElement) active.blur();
        setEngaged(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [engaged]);


  return (
    // The stage begins exactly at the fold, because the layout gives the
    // header the half above it (social/layout.tsx). A screen tall, so there
    // is a runway to scroll after the column has stopped moving — the whole
    // point of sticking is that the page keeps going and the box does not.
    //
    // Touching the box lifts the section to its stick point (`liftColumn`),
    // which is the same move a scroll makes by hand — so however the column
    // arrives at the middle, it arrives the same way and stops in the same
    // place.
    <>
      <section
        ref={sectionRef}
        className="full-bleed from-background to-muted/20 min-h-svh bg-gradient-to-b"
      >
        {/* Half a viewport, at the top of the stage, with the column centred
            inside it — so at rest the column sits at 75svh: the middle of the
            screen's second half.

            `top-[25svh]` is that same centring written for the stuck state.
            Pin a half-screen box a quarter-screen down and its middle is the
            screen's middle, whatever the column inside it happens to be
            wearing. Between the two the column just rises with the page: no
            measurement, no listener, no height to keep in sync — a box taller
            than its container overflows both edges of a centred flex column,
            which is exactly what an open panel should do.

            No `overflow-hidden` here, for that reason. */}
        <div className="sticky top-[25svh] flex h-[50svh] flex-col justify-center">
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4">
            <div ref={columnRef} className="w-full">
              {/* One word. Any paragraph that stood here would explain what
                  the tab row above already answers by being a tab row. */}
              <div className="mb-8 text-center">
                <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
              </div>

              <div className="mb-4">
                {children({ onEngagedChange: setEngaged, triggerCenter })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {below}
    </>
  );
}
