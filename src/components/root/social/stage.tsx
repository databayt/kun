"use client";

// The stage frame — one screen, one word, one box.
//
// Lifted out of review.tsx on 2026-08-25, unchanged. Publish had grown the
// shape the other stages want: a full screen that the page settles onto, a
// single-word heading, and a box that locks the display around itself when
// you touch it. Draft and Media asked for the same head, and the alternative
// was three copies of two hundred lines of scroll machinery — which would
// have meant three places to fix the next thing measured wrong about it.
//
// What this owns is the SCREEN. Touch the box and the stage locks: the page
// stops scrolling, and the heading, the box and whatever its panel is wearing
// hold the middle of the display until you press outside.
//
// There is no scrim, no dim and no blur: the background keeps its gradient,
// the site header and the tab row keep their colours, and the only thing the
// lock does is stop the page moving. A focus mode that repaints half the
// window to say "you are focused" is louder than the thing it announces.

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Defined in globals.css, on <html> — the document is the scroll container. */
const SNAP_CLASS = "snap-stage";

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
 * Engaging the box starts a smooth scroll (spotlight.tsx lifts the stage to
 * the top of the viewport). Freezing the page mid-glide would strand it, so
 * the lock waits for three quiet frames rather than guessing at a duration —
 * the duration is the browser's, not ours. Bounded, because a page that never
 * settles must not leave the lock permanently unarmed.
 */
function whenScrollSettles(run: () => void): () => void {
  let frame = 0;
  let seen = 0;
  let quiet = 0;
  let last = window.scrollY;
  const deadline = performance.now() + 1500;
  let cancelled = false;

  // The lift itself waits two frames before it starts (spotlight.tsx), so the
  // first frames here are quiet for the wrong reason. Measured without this
  // grace: the lock landed at 250ms, froze the glide a third of the way, and
  // the release then jumped because the page was held off its snap point.
  const GRACE_FRAMES = 6;
  const QUIET_FRAMES = 3;

  const tick = () => {
    if (cancelled) return;
    seen += 1;
    const now = window.scrollY;
    quiet = now === last ? quiet + 1 : 0;
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
  children: (props: { onEngagedChange: (engaged: boolean) => void }) => ReactNode;
  below?: ReactNode;
}) {
  // Engaged: the box is open. Locked: the page has been frozen around it.
  // Two states rather than one, because there is a scroll between them that
  // has to finish first.
  const [engaged, setEngaged] = useState(false);
  const [locked, setLocked] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);

  // The stage asks the document to settle on it. Only while this stage is
  // mounted: snapping is scoped to the route that wants it, so navigating to
  // Calendar or Measure leaves the page scrolling normally. The class has to
  // land on <html> because that is the scroll container — see globals.css.
  useEffect(() => {
    document.documentElement.classList.add(SNAP_CLASS);
    return () => document.documentElement.classList.remove(SNAP_CLASS);
  }, []);

  useEffect(() => {
    if (!engaged) {
      setLocked(false);
      return;
    }
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
   *
   * There is no scrim to click — the page keeps its own background and its own
   * navigation, unchanged, because a lock is about where the scroll rests, not
   * about dimming everything a reader might still want to see. So the release
   * listens on the document instead: press outside, and whatever the box had
   * focused is blurred, which is what actually closes it. The lock is
   * downstream of that, so there is one way to be open and one to be shut
   * rather than two states to keep in agreement.
   *
   * Bound only while locked, and on pointerdown rather than click so it fires
   * before a focus lands somewhere new.
   */
  useEffect(() => {
    if (!locked) return;
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
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [locked]);


  return (
    // A full screen, and centred in it: the stage is one column — a heading
    // and the box under it — so anything less left it stranded at the top of
    // a mostly empty page.
    //
    // `snap-start` is the other half: scrolling down from the header settles
    // here rather than halfway, so the stage arrives whole. Focusing the box
    // does the same deliberately — spotlight.tsx climbs to `closest("section")`
    // and lifts it, which is why the section element is the frame's own and
    // not something a stage supplies.
    <>
      <section className="full-bleed from-background to-muted/20 flex min-h-screen snap-start flex-col justify-center bg-gradient-to-b py-16 md:py-24">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4">
          <div ref={columnRef} className="w-full">
            {/* One word. Any paragraph that stood here would explain what the
                tab row above already answers by being a tab row. */}
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
            </div>

            <div className="mb-4">{children({ onEngagedChange: setEngaged })}</div>
          </div>
        </div>
      </section>

      {below}
    </>
  );
}
