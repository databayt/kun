"use client";

// The review queue's search bar — one box that both finds a draft and sends
// what you typed.
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
// The two row kinds are the whole idea:
//
//   FIND — every answered draft that matches, selected into the editor below.
//   SEND — the query itself, published as written to the brand in the picker.
//
// Send goes through `publishPostDirect`, which until now had no caller anywhere
// in the repo: an exported action that reaches a public brand page and that
// nothing exercised. This is its first one.

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Search, SendHorizontal } from "lucide-react";

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
  const [sending, setSending] = React.useState(false);
  const [outcome, setOutcome] = React.useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const trimmed = query.trim();
  const open = trimmed.length > 0;

  const brandLabel = React.useCallback(
    (id: string) => {
      const p = PRODUCTS.find((product) => product.id === id);
      return p ? (isRTL ? p.labelAr : p.label) : id;
    },
    [isRTL],
  );

  // The corpus is already here — filter it, do not fetch it. Matching folds
  // Arabic orthography on both sides so "مكان" finds "مكـان".
  const matches = React.useMemo(() => {
    if (!trimmed) return [];
    return reviewQueue.drafts.filter((d) =>
      matchesQuery(
        [d.ar, d.en, d.brief, d.instruction ?? "", brandLabel(d.brand), d.brand]
          .filter(Boolean)
          .join(" "),
        trimmed,
      ),
    );
  }, [reviewQueue.drafts, trimmed, brandLabel]);

  // Why send can refuse, in the order a reader would check it. Kept as a
  // reason rather than a boolean so the row can say which gate it is on —
  // a disabled control that will not explain itself is the thing this
  // codebase keeps writing comments about.
  const sendBlockedReason = React.useMemo(() => {
    if (trimmed.length < MIN_SEND_CHARS) return t.spotlightSendTooShort;
    if (selectedChannels.length === 0) return t.blockedNoChannel;
    if (!transportsReady) return t.blockedTransport;
    return null;
  }, [trimmed, selectedChannels, transportsReady, t]);

  const handleSelectDraft = React.useCallback(
    (id: string) => {
      // MUST go through loadDraft: it hydrates the composer, fills the media
      // tray, AND switches the Hub's brand to the draft's. Setting the active
      // id alone would leave the approve payload scoped to the wrong brand.
      reviewQueue.loadDraft(id);
      setQuery("");
      setOutcome(null);
      document
        .getElementById("composer")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [reviewQueue],
  );

  const handleSend = React.useCallback(async () => {
    if (sendBlockedReason || sending) return;
    setSending(true);
    setOutcome(null);
    try {
      const res = await publishPostDirect({
        product,
        text: trimmed,
        channels: selectedChannels,
        mediaUrls: composerMediaUrls,
      });
      if (res.ok) {
        setQuery("");
        setOutcome({
          ok: true,
          message: fill(t.spotlightSentTo, { brand: brandLabel(product) }),
        });
      } else {
        // A partial fan-out already reached a public page — say so rather than
        // reporting a flat failure the reader would retry.
        const landed = (res.results ?? []).filter((r: ChannelOutcome) => r.ok);
        setOutcome({
          ok: false,
          message: landed.length
            ? `${t.partialMsg} ${res.error ?? ""}`.trim()
            : `${t.errorMsg}${res.error ?? ""}`,
        });
      }
    } catch (err: unknown) {
      setOutcome({
        ok: false,
        message: `${t.errorMsg}${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setSending(false);
    }
  }, [
    sendBlockedReason,
    sending,
    product,
    trimmed,
    selectedChannels,
    composerMediaUrls,
    t,
    brandLabel,
  ]);

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
            setOutcome(null);
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
              setOutcome(null);
            }}
            placeholder={t.spotlightPlaceholder}
            // 16px keeps iOS Safari from zooming the page on focus.
            className={cn(
              "flex h-12 w-full bg-transparent text-base outline-hidden",
              "placeholder:text-muted-foreground/70",
            )}
          />
          {sending && (
            <Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" />
          )}
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
                {/* SEND — the query itself, always first: it is the one row
                    whose content the reader already knows they want. */}
                <CommandPrimitive.Group>
                  <CommandPrimitive.Item
                    value="__send__"
                    disabled={sendBlockedReason !== null || sending}
                    onSelect={() => void handleSend()}
                    className={cn(
                      "relative flex cursor-default items-center gap-3 rounded-xl px-3 py-3 text-sm outline-hidden select-none",
                      "transition-colors duration-100",
                      "data-[selected=true]:bg-accent/50",
                      "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
                    )}
                  >
                    <div className="bg-muted/50 flex size-9 shrink-0 items-center justify-center rounded-xl">
                      <SendHorizontal className="text-muted-foreground size-5 rtl:rotate-180" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">
                        {fill(t.spotlightSend, {
                          brand: brandLabel(product),
                        })}
                      </span>
                      <span
                        dir="auto"
                        className="text-muted-foreground truncate text-xs"
                      >
                        {sendBlockedReason ?? trimmed}
                      </span>
                    </div>
                    <kbd className="bg-muted text-muted-foreground pointer-events-none hidden h-5 items-center rounded border px-1.5 font-mono text-[10px] sm:flex">
                      ↵
                    </kbd>
                  </CommandPrimitive.Item>
                </CommandPrimitive.Group>

                {/* FIND — matching drafts, into the editor below. */}
                {matches.length > 0 && (
                  <CommandPrimitive.Group>
                    {matches.map((draft) => (
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

                {matches.length === 0 && (
                  <p className="text-muted-foreground/60 px-3 py-4 text-center text-xs">
                    {t.spotlightNoDrafts}
                  </p>
                )}
              </CommandPrimitive.List>
            </motion.div>
          )}
        </AnimatePresence>
      </CommandPrimitive>

      {outcome && (
        <p
          role={outcome.ok ? "status" : "alert"}
          className={cn(
            "mt-2 px-2 text-xs",
            outcome.ok ? "text-emerald-600" : "text-rose-600",
          )}
        >
          {outcome.message}
        </p>
      )}
    </div>
  );
}
