"use client";

// The review queue's search bar — how a draft gets into the composer.
//
// Shaped after hogwarts' spotlight (components/atom/generic-command-menu), and
// deliberately NOT a port of it: that one is a Cmd+K modal over a surface-aware
// config with RBAC and a server search. Here the whole corpus is already in the
// client — listAnsweredDrafts hands the provider 20 drafts across every brand —
// so search is a filter over an array, with no endpoint, no debounce and no
// loading state to design around. What is borrowed is the part that matters:
// the glass bar, the spring-revealed dropdown, and cmdk's keyboard model.
//
// Not a modal, on purpose. Spotlight hides what is behind it because it is a
// launcher over a desktop; this box sits at the top of the thing it filters, so
// covering the queue would be hiding the answer.
//
// It finds; it does not send. It briefly had its own send row, and that was a
// mistake: the composer below is already a place to write and already has a
// Send, so the page grew two writing surfaces and three ways to publish. The
// composer is the single sender now — empty means write from scratch, and this
// box is how you fill it from the queue instead.
//
// The queue shows on focus, before a single keystroke — the common case is
// "show me what is waiting", not "search". Typing narrows it.
//
// Scoped to the brand in the picker, because that picker already scopes the
// channels, the transport check and the approve payload; a queue that ignored
// it would be the one control on the page that disagreed with the others.
//
// But scoped is not the same as hidden. `loadDraft` SWITCHES the Hub's brand to
// the draft's, so a strict filter would make every other brand's work
// unreachable from the box that exists to reach things. Other brands stay, in a
// second group, and only once a query is typed — the label says opening one
// switches the brand, so the side effect is announced rather than sprung.
//

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { matchesQuery } from "@/lib/normalize-search";
import { publishPostDirect } from "@/actions/post-social";
import type { ChannelOutcome } from "@/lib/social-publish";
import { PRODUCTS } from "@/components/root/social/products";
import { fill } from "@/components/root/social/dictionary";
import { useSocial } from "@/components/root/social/provider";

/**
 * Opaque rather than a real backdrop blur — the same call hogwarts made. A
 * blurred panel over a scrolling list reads as smeared rather than glassy.
 */
const GLASS = "bg-muted border border-muted-foreground/20 shadow-2xl";

/** Long enough that the send row is not offered for a stray keystroke. */
const MIN_SEND_CHARS = 2;

export function ReviewSpotlight() {
  const {
    t,
    isRTL,
    product,
    selectedChannels,
    transportsReady,
    composerMediaUrls,
    reviewQueue,
  } = useSocial();

  const [query, setQuery] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const trimmed = query.trim();

  const brandLabel = React.useCallback(
    (id: string) => {
      const p = PRODUCTS.find((product) => product.id === id);
      return p ? (isRTL ? p.labelAr : p.label) : id;
    },
    [isRTL],
  );

  // The corpus is already here — filter it, do not fetch it. Matching folds
  // Arabic orthography on both sides so "مكان" finds "مكـان".
  const haystack = React.useCallback(
    (d: (typeof reviewQueue.drafts)[number]) =>
      [d.ar, d.en, d.brief, d.instruction ?? "", brandLabel(d.brand), d.brand]
        .filter(Boolean)
        .join(" "),
    [brandLabel],
  );

  /** This brand's queue, narrowed by the query. Shown even with no query. */
  const mine = React.useMemo(
    () =>
      reviewQueue.drafts.filter(
        (d) => d.brand === product && (!trimmed || matchesQuery(haystack(d), trimmed)),
      ),
    [reviewQueue.drafts, product, trimmed, haystack],
  );

  /**
   * Everything else that matches — only once something is typed. With an empty
   * query this would just be "the rest of the queue", which is the brand picker's
   * job to change, not this box's job to dump.
   */
  const others = React.useMemo(
    () =>
      !trimmed
        ? []
        : reviewQueue.drafts.filter(
            (d) => d.brand !== product && matchesQuery(haystack(d), trimmed),
          ),
    [reviewQueue.drafts, product, trimmed, haystack],
  );

  const open = focused && (trimmed.length > 0 || reviewQueue.drafts.length > 0);

  const handleSelectDraft = React.useCallback(
    (id: string) => {
      // MUST go through loadDraft: it hydrates the composer, fills the media
      // tray, AND switches the Hub's brand to the draft's. Setting the active
      // id alone would leave the approve payload scoped to the wrong brand.
      reviewQueue.loadDraft(id);
      setQuery("");
      document
        .getElementById("composer")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [reviewQueue],
  );

  // Cmd/Ctrl+K focuses rather than opens — the box is already on the page, so
  // there is nothing to summon. Ignored while the caret is in another field so
  // it cannot steal focus mid-sentence in the composer.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "k" || !(e.metaKey || e.ctrlKey)) return;
      const el = e.target;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      ) {
        if (el !== inputRef.current) return;
      }
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <CommandPrimitive
        loop
        // cmdk filters by each item's `value`; ours is already filtered by the
        // Arabic-aware matcher, and cmdk's Latin-only scorer would then throw
        // half of it away again.
        shouldFilter={false}
        className={cn(GLASS, "overflow-hidden rounded-[28px]")}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setQuery("");
          }
        }}
      >
        <div className="relative flex h-12 items-center gap-3 px-5">
          <Search className="text-muted-foreground size-5 shrink-0" />
          <CommandPrimitive.Input
            ref={inputRef}
            value={query}
            onValueChange={(v) => {
              setQuery(v);
            }}
            onFocus={() => setFocused(true)}
            // Deferred: a click on a row blurs the input before the row's own
            // handler runs, and closing first would unmount the thing being
            // clicked. cmdk's Enter path is unaffected either way.
            onBlur={() => window.setTimeout(() => setFocused(false), 150)}
            placeholder={t.spotlightPlaceholder}
            // 16px keeps iOS Safari from zooming the page on focus.
            className={cn(
              "flex h-12 w-full bg-transparent text-base outline-hidden",
              "placeholder:text-muted-foreground/70",
            )}
          />
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              key="spotlight-dropdown"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0, transition: { duration: 0.2 } }}
              transition={{ type: "spring", duration: 0.45, bounce: 0.05 }}
              className="w-full overflow-hidden"
            >
              <CommandPrimitive.List className="max-h-[min(360px,45vh)] scroll-py-1 overflow-x-hidden overflow-y-auto p-2">
                {/* FIND — this brand's queue first, because the picker above
                    already says which brand the reader is working in. */}
                {mine.length > 0 && (
                  <CommandPrimitive.Group>
                    {mine.map((draft) => (
                      <CommandPrimitive.Item
                        key={draft.id}
                        value={draft.id}
                        onSelect={() => handleSelectDraft(draft.id)}
                        className={cn(
                          "relative flex cursor-default items-start gap-3 rounded-xl px-3 py-3 text-sm outline-hidden select-none",
                          "transition-colors duration-100",
                          "data-[selected=true]:bg-accent/50",
                        )}
                      >
                        <span className="border-input text-muted-foreground mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px]">
                          {brandLabel(draft.brand)}
                        </span>
                        <span
                          dir="auto"
                          className="line-clamp-2 min-w-0 flex-1 text-start leading-relaxed"
                        >
                          {draft.ar || draft.en || draft.brief}
                        </span>
                      </CommandPrimitive.Item>
                    ))}
                  </CommandPrimitive.Group>
                )}

                {/* Other brands — only when searching, and labelled, because
                    opening one silently retargets the whole page. */}
                {others.length > 0 && (
                  <>
                    <p className="text-muted-foreground/50 px-3 pt-2 pb-1 text-[11px]">
                      {t.spotlightOtherBrands}
                    </p>
                    <CommandPrimitive.Group>
                      {others.map((draft) => (
                        <CommandPrimitive.Item
                          key={draft.id}
                          value={draft.id}
                          onSelect={() => handleSelectDraft(draft.id)}
                          className={cn(
                            "relative flex cursor-default items-start gap-3 rounded-xl px-3 py-3 text-sm outline-hidden select-none",
                            "transition-colors duration-100",
                            "data-[selected=true]:bg-accent/50",
                          )}
                        >
                          <span className="border-input text-muted-foreground mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[10px]">
                            {brandLabel(draft.brand)}
                          </span>
                          <span
                            dir="auto"
                            className="line-clamp-2 min-w-0 flex-1 text-start leading-relaxed"
                          >
                            {draft.ar || draft.en || draft.brief}
                          </span>
                        </CommandPrimitive.Item>
                      ))}
                    </CommandPrimitive.Group>
                  </>
                )}

                {mine.length === 0 && others.length === 0 && (
                  <p className="text-muted-foreground/60 px-3 py-4 text-center text-xs">
                    {trimmed ? t.spotlightNoDrafts : t.spotlightQueueEmpty}
                  </p>
                )}
              </CommandPrimitive.List>
            </motion.div>
          )}
        </AnimatePresence>
      </CommandPrimitive>
    </div>
  );
}
