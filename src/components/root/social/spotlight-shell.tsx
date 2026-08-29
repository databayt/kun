"use client";

// The surface every stage box wears, in one place.
//
// Publish, Draft, Media and Calendar are four different boxes — one sends a
// post, one asks for copy, one finds a picture, one files a brief — but they
// are meant to read as ONE surface repeated, and by the fourth they were four
// copies of the same eighteen lines: the glass, the 48px line, the panel under
// it, and the two handlers that decide when the panel is open.
//
// Extracted at four rather than at two, and deliberately: three copies of a
// thing are a smell, four with a fifth in sight is when the copying starts
// costing more than the indirection. The lift out of these same files
// (stage.tsx `liftColumn`) made the same call one release earlier, and the
// bug it found on the way out — a reduced-motion branch that had never worked
// in any of the three copies — is the argument for doing it before five.
//
// WHAT IS NOT HERE: the root element. Publish's is cmdk's `CommandPrimitive`
// and the other three are a plain div, so a shell component would have to be
// polymorphic over its own root — an abstraction that exists to hide one
// element name and charges a generic for it. The hook hands back the props
// instead, and each box spreads them onto whatever root it actually has.

import * as React from "react";

/**
 * The bar itself. Exported rather than copied: four boxes whose glass drifted
 * apart would read as four different components on what is one surface.
 */
export const GLASS = "bg-muted border border-muted-foreground/20 shadow-2xl";

/**
 * The line you see at rest — 48px, a seat at each end, the writing between.
 */
export const SPOTLIGHT_BAR = "relative flex h-12 items-center gap-2 ps-3 pe-2";

/**
 * The panel that unfolds under the bar.
 *
 * `min(360px, 45vh)` is the whole reason this is a constant: the box centres
 * itself in the stage (stage.tsx), so a panel that grows past the viewport
 * pushes its own input off the top. 45vh keeps the open box inside a screen on
 * a laptop, and the 360px ceiling stops a tall monitor from rendering a panel
 * nobody wants to read to the end of.
 */
export const SPOTLIGHT_PANEL =
  "relative max-h-[min(360px,45vh)] overflow-y-auto border-t border-black/5 dark:border-white/10";

/**
 * Open, closed, and the two ways out.
 *
 * @param onEngagedChange  What the stage frame is told. Fired on the
 *   TRANSITION only — a parent re-render must not read as a state change, and
 *   the frame lifts and locks the whole screen off this signal.
 * @param hold  Something outside the box is keeping it open. Publish's filters
 *   menu portals out of the box's subtree, so a focus landing in it looks like
 *   a focus leaving the box; without this the panel closes under the menu the
 *   moment you touch it. Called during render, so keep it a plain read.
 */
export function useSpotlightBox({
  onEngagedChange,
  triggerCenter,
  hold = false,
}: {
  onEngagedChange?: (engaged: boolean) => void;
  triggerCenter?: () => void;
  hold?: boolean;
} = {}) {
  const [focused, setFocused] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const open = focused || hold;

  // Report on the transition only. `onEngagedChange` is sometimes an inline
  // arrow (draft-agent wraps it to keep its own flag in step), so a plain
  // effect on [open, onEngagedChange] fires on every render of the parent.
  const engagedRef = React.useRef(false);
  React.useEffect(() => {
    if (engagedRef.current === open) return;
    engagedRef.current = open;
    onEngagedChange?.(open);
  }, [open, onEngagedChange]);

  /**
   * Props for the box's own root, whatever element that is.
   *
   * Focus moving between the input, the pills and the seats must not read as
   * leaving the box — only a landing OUTSIDE it does. The 150ms is for the
   * gap where `relatedTarget` is null (a mousedown on a portalled menu, a
   * click on the page chrome): it lets whatever is arriving arrive before the
   * box decides nothing did.
   *
   * Escape collapses; it does NOT clear. Publish's field holds the post, so
   * "Escape empties it" would throw away writing on the key people press to
   * dismiss a panel.
   */
  const shellProps = {
    ref: rootRef,
    onMouseEnter: () => {
      triggerCenter?.();
    },
    onFocusCapture: () => {
      triggerCenter?.();
    },
    onBlurCapture: (e: React.FocusEvent<HTMLElement>) => {
      const next = e.relatedTarget;
      if (next instanceof Node && rootRef.current?.contains(next)) return;
      window.setTimeout(() => {
        if (hold) return;
        setFocused(false);
      }, 150);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key !== "Escape") return;
      // Whoever is on top owns that key: a portalled menu bubbles its Escape
      // through the React tree to here, and it should close the menu, not the
      // box under it.
      if (hold) return;
      setFocused(false);
      inputRef.current?.blur();
    },
  };

  return { focused, setFocused, open, rootRef, inputRef, shellProps };
}
