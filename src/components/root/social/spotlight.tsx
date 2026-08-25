"use client";

// The publish stage's search bar — how a draft gets into the composer, and how
// the rest of the lane stays visible while you work.
//
// Shaped after hogwarts' spotlight (components/atom/generic-command-menu), and
// deliberately NOT a port of it: that one is a Cmd+K modal over a surface-aware
// config with RBAC and a server search. Here the whole corpus is already in the
// client — the provider hands us every answered draft and the recent scheduled
// and published variants — so search is a filter over arrays, with no endpoint,
// no debounce and no loading state to design around. What is borrowed is the
// part that matters: the glass bar, the spring-revealed dropdown, the circular
// category buttons, the per-row kind icon, and cmdk's keyboard model.
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
// ——— The mode row ———
//
// Four modes, as split icon buttons in the bar: All · Drafts · Scheduled ·
// Published. They are not decoration over one list — they are three different
// tables. Drafts are `SocialDraftRequest` rows awaiting a human decision;
// scheduled and published are `SocialVariant` rows where that decision is
// already made. Before this, answering "did that one go out?" meant leaving the
// stage for the ledger on /social/measure, which is why the ledger's own comment
// calls variant-awareness a gap.
//
// Only a DRAFT loads into the composer. A variant is downstream of a
// SocialPiece, so approving one again would mint a duplicate — those rows open
// the ledger instead, and say so on the row.
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
// second group, once a query is typed or the filter menu opts into every brand
// — the label says opening one switches the brand, so the side effect is
// announced rather than sprung.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command as CommandPrimitive } from "cmdk";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarClock,
  CheckCircle2,
  Images,
  Layers,
  Loader2,
  PenLine,
  RefreshCw,
  Search,
  Send,
  Settings2,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { matchesQuery } from "@/lib/normalize-search";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  approveDraft,
  publishPostDirect,
  type PostResult,
} from "@/actions/post-social";
import { CHANNELS } from "@/components/root/social/config";
import { PRODUCTS } from "@/components/root/social/products";
import { fill, type SocialDict } from "@/components/root/social/dictionary";
import { useSocial } from "@/components/root/social/provider";

/**
 * Opaque rather than a real backdrop blur — the same call hogwarts made. A
 * blurred panel over a scrolling list reads as smeared rather than glassy.
 */
const GLASS = "bg-muted border border-muted-foreground/20 shadow-2xl";

/**
 * What Approve does — publish on the spot, or write `scheduled` variants for
 * the ~15-minute cron drain. Persisted per browser; it used to live on the
 * review panel beside a composer that is no longer there, so it travels with
 * the Send it configures.
 */
type ApproveMode = "now" | "schedule";

const APPROVE_MODE_KEY = "social:approve-mode";

type Mode = "all" | "draft" | "scheduled" | "published";
type Scope = "brand" | "every";
type Order = "oldest" | "newest";

/** One row of the dropdown, whichever table it came from. */
interface QueueItem {
  id: string;
  kind: "draft" | "scheduled" | "published";
  brand: string;
  text: string;
  /** ISO — filed (draft), due (scheduled) or delivered (published). */
  when: string;
  mediaUrls: string[];
  /** Drafts only: refinement depth, rendered as a v2 badge. */
  turn?: number;
  /** Variants only. */
  channel?: string;
  /** Everything the matcher may look at, joined once. */
  haystack: string;
}

const MODES: readonly {
  id: Mode;
  icon: LucideIcon;
  labelKey: keyof SocialDict;
  shortcut: string;
}[] = [
  { id: "all", icon: Layers, labelKey: "spotlightModeAll", shortcut: "⌘1" },
  {
    id: "draft",
    icon: PenLine,
    labelKey: "spotlightModeDrafts",
    shortcut: "⌘2",
  },
  {
    id: "scheduled",
    icon: CalendarClock,
    labelKey: "spotlightModeScheduled",
    shortcut: "⌘3",
  },
  {
    id: "published",
    icon: CheckCircle2,
    labelKey: "spotlightModePublished",
    shortcut: "⌘4",
  },
] as const;

const KIND_ICON: Record<QueueItem["kind"], LucideIcon> = {
  draft: PenLine,
  scheduled: CalendarClock,
  published: CheckCircle2,
};

/** The group heading in "all" mode — the mode row's own words, plural. */
const KIND_HEADING_KEY: Record<QueueItem["kind"], keyof SocialDict> = {
  draft: "spotlightModeDrafts",
  scheduled: "spotlightModeScheduled",
  published: "spotlightModePublished",
};

export function ReviewSpotlight() {
  const {
    t,
    lang,
    isRTL,
    product,
    reviewQueue,
    selectedChannels,
    transportsReady,
    composerText,
    setComposerText,
    composerMediaUrls,
  } = useSocial();
  const router = useRouter();

  // ONE field, two jobs: what is typed here is the post copy AND the query the
  // queue below is filtered by. It reads from the provider rather than local
  // state so a draft loaded out of the queue lands in the same box the writer
  // is already looking at, and so leaving the stage does not lose the copy.
  const query = composerText;
  const setQuery = setComposerText;

  const [mode, setMode] = React.useState<Mode>("all");
  const [scope, setScope] = React.useState<Scope>("brand");
  const [order, setOrder] = React.useState<Order>("oldest");
  const [mediaOnly, setMediaOnly] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  // Radix portals the filter menu outside this subtree, so a plain blur would
  // close the dropdown the moment the menu opens.
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  // Read after mount so the server render never touches localStorage.
  const [approveMode, setApproveModeState] =
    React.useState<ApproveMode>("now");
  React.useEffect(() => {
    const stored = window.localStorage.getItem(APPROVE_MODE_KEY);
    if (stored === "now" || stored === "schedule") setApproveModeState(stored);
  }, []);
  const setApproveMode = (next: ApproveMode) => {
    setApproveModeState(next);
    window.localStorage.setItem(APPROVE_MODE_KEY, next);
  };

  const trimmed = query.trim();

  const brandLabel = React.useCallback(
    (id: string) => {
      const p = PRODUCTS.find((entry) => entry.id === id);
      return p ? (isRTL ? p.labelAr : p.label) : id;
    },
    [isRTL],
  );

  const channelLabel = React.useCallback(
    (id?: string) => {
      if (!id) return null;
      const c = CHANNELS.find((entry) => entry.id === id);
      return c ? (isRTL ? c.labelAr : c.label) : id;
    },
    [isRTL],
  );

  // Both tables, normalized once. The corpus is already here — filter it, do
  // not fetch it. Matching folds Arabic orthography on both sides so "مكان"
  // finds "مكـان".
  const items = React.useMemo<QueueItem[]>(() => {
    const drafts: QueueItem[] = reviewQueue.drafts.map((d) => ({
      id: d.id,
      kind: "draft",
      brand: d.brand,
      text: d.ar || d.en || d.brief,
      when: d.answeredAt ?? d.createdAt,
      mediaUrls: d.mediaUrls,
      turn: d.turn,
      haystack: [
        d.ar,
        d.en,
        d.brief,
        d.instruction ?? "",
        brandLabel(d.brand),
        d.brand,
      ]
        .filter(Boolean)
        .join(" "),
    }));

    const variants: QueueItem[] = reviewQueue.variants.map((v) => ({
      id: v.id,
      kind: v.kind,
      brand: v.brand,
      text: v.text,
      when: v.when,
      mediaUrls: v.mediaUrls,
      channel: v.channel,
      haystack: [
        v.text,
        brandLabel(v.brand),
        v.brand,
        channelLabel(v.channel) ?? "",
        v.channel,
      ]
        .filter(Boolean)
        .join(" "),
    }));

    return [...drafts, ...variants];
  }, [reviewQueue.drafts, reviewQueue.variants, brandLabel, channelLabel]);

  /**
   * Everything the query and the filter menu allow, before the mode row picks
   * a slice. Counting the modes against THIS is what lets the row say where a
   * search actually landed rather than how big each table is.
   */
  const matching = React.useMemo(
    () =>
      items.filter(
        (item) =>
          (!mediaOnly || item.mediaUrls.length > 0) &&
          (!trimmed || matchesQuery(item.haystack, trimmed)),
      ),
    [items, mediaOnly, trimmed],
  );

  const counts = React.useMemo(() => {
    // Counts follow the brand the picker shows — the number next to "Drafts"
    // has to mean the rows about to be listed, or it is a different question's
    // answer sitting on this button.
    const inScope = matching.filter(
      (item) => scope === "every" || item.brand === product,
    );
    return {
      all: inScope.length,
      draft: inScope.filter((i) => i.kind === "draft").length,
      scheduled: inScope.filter((i) => i.kind === "scheduled").length,
      published: inScope.filter((i) => i.kind === "published").length,
    } satisfies Record<Mode, number>;
  }, [matching, scope, product]);

  const sort = React.useCallback(
    (list: QueueItem[]) =>
      [...list].sort((a, b) => {
        const delta = a.when.localeCompare(b.when);
        return order === "oldest" ? delta : -delta;
      }),
    [order],
  );

  const inMode = React.useCallback(
    (item: QueueItem) => mode === "all" || item.kind === mode,
    [mode],
  );

  /** This brand's slice. Shown even with no query. */
  const mine = React.useMemo(
    () =>
      sort(matching.filter((item) => item.brand === product && inMode(item))),
    [matching, product, inMode, sort],
  );

  /**
   * Everything else that matches. With scope "brand" this stays empty until
   * something is typed — an untyped dump of the other brands is the brand
   * picker's job to change, not this box's job to pre-empt. The filter menu is
   * the explicit way to ask for all of them.
   */
  const others = React.useMemo(() => {
    if (scope === "brand" && !trimmed) return [];
    return sort(
      matching.filter((item) => item.brand !== product && inMode(item)),
    );
  }, [matching, product, inMode, sort, scope, trimmed]);

  const open = focused || menuOpen;

  const handleSelect = React.useCallback(
    (item: QueueItem) => {
      if (item.kind !== "draft") {
        // Read-only: a variant is downstream of a piece, so there is nothing
        // here to re-approve. The ledger is where its status and numbers live.
        router.push(`/${lang}/social/measure#social-ledger`);
        return;
      }
      // MUST go through loadDraft: it hydrates the composer, fills the media
      // tray, AND switches the Hub's brand to the draft's. Setting the active
      // id alone would leave the approve payload scoped to the wrong brand.
      // loadDraft writes the draft's copy into composerText, which IS this
      // field — so the row the reader picked is now the text in the box.
      // Collapse the panel so they can see that rather than a list filtered
      // by the paragraph they just loaded.
      reviewQueue.loadDraft(item.id);
      setNotice(null);
      setError(null);
      setFocused(false);
      inputRef.current?.blur();
    },
    [reviewQueue, router, lang],
  );

  /**
   * The button says which of the two sends it is about to perform: approving a
   * queue draft (which also claims it) reads differently from publishing a
   * line typed from scratch, and scheduling reads differently again.
   */
  const sendLabel = !reviewQueue.activeDraftId
    ? t.publishDirectAction
    : approveMode === "schedule"
      ? t.approveScheduleAction
      : t.approveAction;

  /**
   * Stating the blocker beats a dead button with no explanation.
   */
  const blockedReason = !trimmed
    ? t.blockedNoText
    : selectedChannels.length === 0
      ? t.blockedNoChannel
      : !transportsReady
        ? t.blockedTransport
        : null;

  /**
   * One Send, two paths — chosen by where the copy came from, not by a control
   * the writer has to think about.
   *
   * A draft loaded from the queue must go through `approveDraft`, because
   * approving is also a claim: it moves the request `answered → consumed` in
   * the same transaction, which is what stops two reviewers publishing the
   * same post. Copy typed here answers to no queue entry, so there is nothing
   * to claim and `publishPostDirect` is the whole job.
   *
   * Routing on `activeDraftId` rather than on a mode flag means the wrong path
   * cannot be selected by mistake — the state that decides is the same state
   * that put the text on screen. Lifted verbatim from review-editor.tsx, which
   * is where this reasoning was paid for.
   */
  const handleSend = React.useCallback(async () => {
    if (blockedReason || sending) return;
    setSending(true);
    setNotice(null);
    setError(null);
    const payload = {
      product,
      text: query,
      channels: selectedChannels,
      mediaUrls: composerMediaUrls,
    };
    try {
      const draftId = reviewQueue.activeDraftId;
      let scheduled: { count: number; at: string } | null = null;
      let res: PostResult;
      if (draftId) {
        const approved = await approveDraft({
          draftId,
          mode: approveMode,
          ...payload,
        });
        res = approved;
        if (approveMode === "schedule") {
          scheduled = {
            count: approved.count ?? 0,
            at: approved.at ? new Date(approved.at).toLocaleString() : "",
          };
        }
      } else {
        res = await publishPostDirect(payload);
      }

      if (res.ok) {
        setNotice(
          scheduled ? fill(t.scheduledMsg, scheduled) : t.approvedNowMsg,
        );
        reviewQueue.clearActive();
        void reviewQueue.refresh();
      } else {
        // A partial landing consumed the draft server-side, so the queue has
        // moved even though the send did not fully succeed — refresh either
        // way rather than leaving a consumed row on screen as pending work.
        const partial = Boolean(res.results?.some((r) => r.ok));
        setError(partial ? t.partialMsg : `${t.errorMsg}${res.error}`);
        if (partial) {
          reviewQueue.clearActive();
          void reviewQueue.refresh();
        }
      }
    } catch (err: unknown) {
      setError(
        `${t.errorMsg}${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setSending(false);
    }
  }, [
    blockedReason,
    sending,
    product,
    query,
    selectedChannels,
    composerMediaUrls,
    reviewQueue,
    approveMode,
    t,
  ]);

  /**
   * Focusing the box brings the stage to the top of the screen, so the panel
   * that just unfolded has room to be read instead of opening into whatever
   * sliver was left below the fold. The scroll-snap in globals.css does this
   * for a scroll; this does it for a keystroke.
   *
   * The target is found by climbing, not by a shared id: the thing worth
   * lifting is whatever section this bar was placed in, so the bar stays
   * portable and review.tsx does not have to import back from the file that
   * imports it.
   *
   * Skipped when the stage is already there — a smooth scroll of a few pixels
   * is a twitch, not an animation — and skipped for anyone who asked for less
   * motion, who gets the jump the browser would have made anyway.
   */
  const liftStage = React.useCallback(() => {
    // From the input, not the cmdk root: `CommandPrimitive`'s ref is the
    // library's to define, while `CommandPrimitive.Input` forwards to the real
    // <input> — the same node ⌘K already focuses.
    const stage = inputRef.current?.closest("section");
    if (!stage) return;
    if (Math.abs(stage.getBoundingClientRect().top) < 24) return;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? "auto"
      : "smooth";
    // Two frames, not zero. Focus opens the panel in the same tick, and a
    // smooth scroll started before that layout lands is cancelled outright —
    // measured: the call ran, found the section, and moved nothing. Waiting
    // until the panel has mounted costs 32ms and is the difference between
    // this working and silently doing nothing.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => stage.scrollIntoView({ behavior, block: "start" })),
    );
  }, []);

  // Cmd/Ctrl+K focuses rather than opens — the box is already on the page, so
  // there is nothing to summon. Cmd/Ctrl+1..4 switch modes, the same shortcuts
  // hogwarts prints on its category buttons. Both are ignored while the caret
  // is in another field so they cannot steal focus mid-sentence.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const modeIndex = ["1", "2", "3", "4"].indexOf(e.key);
      if (e.key !== "k" && modeIndex === -1) return;

      const el = e.target;
      const typingElsewhere =
        (el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          (el instanceof HTMLElement && el.isContentEditable)) &&
        el !== inputRef.current;
      if (typingElsewhere) return;

      e.preventDefault();
      if (modeIndex !== -1) {
        setMode(MODES[modeIndex].id);
        setFocused(true);
      }
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const emptyText = trimmed
    ? t.spotlightNoDrafts
    : scope === "every"
      ? t.spotlightEmptyEverywhere
      : mode === "scheduled"
        ? t.spotlightNoScheduled
        : mode === "published"
          ? t.spotlightNoPublished
          : t.spotlightQueueEmpty;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <CommandPrimitive
        ref={rootRef}
        loop
        // cmdk filters by each item's `value`; ours is already filtered by the
        // Arabic-aware matcher, and cmdk's Latin-only scorer would then throw
        // half of it away again.
        shouldFilter={false}
        className={cn(GLASS, "overflow-hidden rounded-[28px]")}
        // Focus moving between the input, the mode pills and the filter button
        // must not read as leaving the box — only a landing outside it does.
        onBlurCapture={(e: React.FocusEvent<HTMLDivElement>) => {
          const next = e.relatedTarget;
          if (next instanceof Node && rootRef.current?.contains(next)) return;
          window.setTimeout(() => {
            if (menuOpen) return;
            setFocused(false);
          }, 150);
        }}
        // Escape collapses the box; it does NOT clear. The field holds the
        // post now, so the old "Escape empties it" would throw away writing
        // on the key people press to dismiss a panel.
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          setFocused(false);
          inputRef.current?.blur();
        }}
      >
        <div className="relative flex h-12 items-center gap-3 px-5">
          <Search className="text-muted-foreground size-5 shrink-0" />
          <CommandPrimitive.Input
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
            onFocus={() => {
              setFocused(true);
              liftStage();
            }}
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
              {/* The split icons — a second row that arrives WITH the dropdown
                rather than standing under the input all day. At rest this box
                is one search line: the list it filters is not on screen yet,
                so neither is the filtering. Inside the reveal, not beside it,
                so one spring carries the whole panel. */}
              <div className="flex items-center gap-1 border-t border-black/5 px-2 py-2 dark:border-white/10">
                {MODES.map((entry, i) => {
                  const Icon = entry.icon;
                  const active = mode === entry.id;
                  const count = counts[entry.id];
                  return (
                    <motion.button
                      key={entry.id}
                      type="button"
                      data-active={active}
                      title={`${t[entry.labelKey]} (${entry.shortcut})`}
                      aria-pressed={active}
                      initial={{ opacity: 0, x: isRTL ? 20 : -20, scale: 0.6 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{
                        type: "spring",
                        duration: 0.4,
                        bounce: 0.2,
                        delay: i * 0.04,
                      }}
                      // Keep the caret in the input — switching mode is a filter, not
                      // a departure from what you were typing.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setMode(entry.id);
                        setFocused(true);
                        inputRef.current?.focus();
                      }}
                      className={cn(
                        "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5",
                        "text-xs font-medium transition-colors duration-150",
                        active
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground/70 hover:bg-accent/50 hover:text-accent-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="hidden sm:inline">
                        {t[entry.labelKey]}
                      </span>
                      {count > 0 && (
                        <span
                          dir="ltr"
                          className={cn(
                            "rounded-full px-1.5 py-px text-[10px] tabular-nums",
                            active
                              ? "bg-background/60"
                              : "bg-muted-foreground/10 text-muted-foreground",
                          )}
                        >
                          {count}
                        </span>
                      )}
                    </motion.button>
                  );
                })}

                <div className="ms-auto flex items-center gap-1">
                  <button
                    type="button"
                    title={t.spotlightRefresh}
                    aria-label={t.spotlightRefresh}
                    disabled={reviewQueue.loading}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void reviewQueue.refresh()}
                    className="text-muted-foreground/70 hover:bg-accent/50 hover:text-accent-foreground flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors duration-150 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={cn(
                        "size-4",
                        reviewQueue.loading && "animate-spin",
                      )}
                    />
                  </button>

                  {/* The filter menu — the knobs that are a preference rather than a
                  slice: which brands, which order, and whether a row has to
                  carry media at all. */}
                  <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                    <DropdownMenuTrigger
                      title={t.spotlightFilters}
                      aria-label={t.spotlightFilters}
                      onMouseDown={(e) => e.preventDefault()}
                      className={cn(
                        "flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors duration-150",
                        menuOpen || scope === "every" || mediaOnly
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground/70 hover:bg-accent/50 hover:text-accent-foreground",
                      )}
                    >
                      <SlidersHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align={isRTL ? "start" : "end"}
                      className="w-56"
                      // Returning focus would fight the deferred blur above; the
                      // input is refocused explicitly instead.
                      onCloseAutoFocus={(e) => {
                        e.preventDefault();
                        inputRef.current?.focus();
                      }}
                    >
                      <DropdownMenuLabel>{t.spotlightScope}</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={scope}
                        onValueChange={(value) => setScope(value as Scope)}
                      >
                        <DropdownMenuRadioItem value="brand">
                          {fill(t.spotlightScopeThis, {
                            brand: brandLabel(product),
                          })}
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="every">
                          {t.spotlightScopeAll}
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>

                      <DropdownMenuSeparator />

                      <DropdownMenuLabel>{t.spotlightOrder}</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={order}
                        onValueChange={(value) => setOrder(value as Order)}
                      >
                        <DropdownMenuRadioItem value="oldest">
                          {t.spotlightOrderOldest}
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="newest">
                          {t.spotlightOrderNewest}
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>

                      <DropdownMenuSeparator />

                      <DropdownMenuCheckboxItem
                        checked={mediaOnly}
                        onCheckedChange={(checked) =>
                          setMediaOnly(Boolean(checked))
                        }
                      >
                        {t.spotlightMediaOnly}
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* What Send does — publish on the spot, or park `scheduled`
                      variants for the cron drain. It sat beside the composer that
                      is no longer on this page; it belongs next to the button it
                      configures. */}
                  <Popover>
                    <PopoverTrigger
                      aria-label={t.approveModeLabel}
                      title={
                        approveMode === "schedule"
                          ? t.approveModeSchedule
                          : t.approveModeNow
                      }
                      onMouseDown={(e) => e.preventDefault()}
                      className={cn(
                        "flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors duration-150",
                        approveMode === "schedule"
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground/70 hover:bg-accent/50 hover:text-accent-foreground",
                      )}
                    >
                      <Settings2 className="size-4" />
                    </PopoverTrigger>
                    <PopoverContent
                      align={isRTL ? "start" : "end"}
                      className="w-72 text-start"
                    >
                      <p className="text-muted-foreground mb-2 text-xs font-medium">
                        {t.approveModeLabel}
                      </p>
                      <div className="space-y-1.5">
                        {(["now", "schedule"] as const).map((option) => (
                          <label
                            key={option}
                            className="hover:bg-muted flex cursor-pointer items-start gap-2 rounded-lg p-2 text-sm"
                          >
                            <input
                              type="radio"
                              name="approve-mode"
                              checked={approveMode === option}
                              onChange={() => setApproveMode(option)}
                              className="mt-1"
                            />
                            <span>
                              <span className="block font-medium">
                                {option === "now"
                                  ? t.approveModeNow
                                  : t.approveModeSchedule}
                              </span>
                              <span className="text-muted-foreground block text-xs">
                                {option === "now"
                                  ? t.approveModeNowHint
                                  : t.approveModeScheduleHint}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Send. Disabled states carry their reason in the tooltip —
                      a dead button that will not say why is the thing this
                      replaces. */}
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void handleSend()}
                    disabled={Boolean(blockedReason) || sending}
                    title={blockedReason ?? sendLabel}
                    className={cn(
                      "ms-1 flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3",
                      "text-xs font-medium transition-colors duration-150",
                      "bg-primary text-primary-foreground hover:opacity-90",
                      "disabled:cursor-not-allowed disabled:opacity-40",
                    )}
                  >
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4 rtl:-scale-x-100" />
                    )}
                    <span className="hidden sm:inline">{sendLabel}</span>
                  </button>
                </div>
              </div>

              <CommandPrimitive.List className="max-h-[min(360px,45vh)] scroll-py-1 overflow-x-hidden overflow-y-auto border-t border-black/5 p-2 dark:border-white/10">
                {/* FIND — this brand's slice first, because the picker above
                    already says which brand the reader is working in. */}
                <ItemGroup
                  items={mine}
                  grouped={mode === "all"}
                  t={t}
                  lang={lang}
                  brandLabel={brandLabel}
                  channelLabel={channelLabel}
                  onSelect={handleSelect}
                />

                {/* Other brands — labelled, because opening one silently
                    retargets the whole page. */}
                {others.length > 0 && (
                  <>
                    <p className="text-muted-foreground/50 px-3 pt-2 pb-1 text-[11px]">
                      {t.spotlightOtherBrands}
                    </p>
                    <ItemGroup
                      items={others}
                      grouped={mode === "all"}
                      t={t}
                      lang={lang}
                      brandLabel={brandLabel}
                      channelLabel={channelLabel}
                      onSelect={handleSelect}
                    />
                  </>
                )}

                {mine.length === 0 && others.length === 0 && (
                  <p className="text-muted-foreground/60 px-3 py-4 text-center text-xs">
                    {emptyText}
                  </p>
                )}
              </CommandPrimitive.List>

              <Footer t={t} />
            </motion.div>
          )}
        </AnimatePresence>
      </CommandPrimitive>

      {/* What the send did. Under the box, because the box collapses and a
          notice inside it would vanish with the panel that carried it. */}
      {(notice || error) && (
        <p
          role={error ? "alert" : "status"}
          className={cn(
            "mt-3 rounded-lg px-3 py-2 text-sm",
            error
              ? "border border-rose-500/30 bg-rose-500/10 text-rose-500"
              : "text-muted-foreground",
          )}
        >
          {error ?? notice}
        </p>
      )}
    </div>
  );
}

/**
 * One block of rows. In "all" mode the kinds are headed, because a draft and a
 * published post look alike at a glance and mean opposite things.
 */
function ItemGroup({
  items,
  grouped,
  t,
  lang,
  brandLabel,
  channelLabel,
  onSelect,
}: {
  items: QueueItem[];
  grouped: boolean;
  t: SocialDict;
  lang: string;
  brandLabel: (id: string) => string;
  channelLabel: (id?: string) => string | null;
  onSelect: (item: QueueItem) => void;
}) {
  if (items.length === 0) return null;

  if (!grouped) {
    return (
      <CommandPrimitive.Group>
        {items.map((item) => (
          <Row
            key={item.id}
            item={item}
            t={t}
            lang={lang}
            brandLabel={brandLabel}
            channelLabel={channelLabel}
            onSelect={onSelect}
          />
        ))}
      </CommandPrimitive.Group>
    );
  }

  const kinds: QueueItem["kind"][] = ["draft", "scheduled", "published"];
  return (
    <>
      {kinds.map((kind) => {
        const slice = items.filter((item) => item.kind === kind);
        if (slice.length === 0) return null;
        return (
          <React.Fragment key={kind}>
            <p className="text-muted-foreground/50 px-3 pt-2 pb-1 text-[11px] uppercase">
              {t[KIND_HEADING_KEY[kind]]}
            </p>
            <CommandPrimitive.Group>
              {slice.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  t={t}
                  lang={lang}
                  brandLabel={brandLabel}
                  channelLabel={channelLabel}
                  onSelect={onSelect}
                />
              ))}
            </CommandPrimitive.Group>
          </React.Fragment>
        );
      })}
    </>
  );
}

function Row({
  item,
  t,
  lang,
  brandLabel,
  channelLabel,
  onSelect,
}: {
  item: QueueItem;
  t: SocialDict;
  lang: string;
  brandLabel: (id: string) => string;
  channelLabel: (id?: string) => string | null;
  onSelect: (item: QueueItem) => void;
}) {
  const Icon = KIND_ICON[item.kind];
  const readOnly = item.kind !== "draft";
  const channel = channelLabel(item.channel);

  return (
    <CommandPrimitive.Item
      // cmdk uses `value` as its selection key; ids collide across the two
      // tables in principle, so the kind is part of it.
      value={`${item.kind}:${item.id}`}
      onSelect={() => onSelect(item)}
      className={cn(
        "relative flex cursor-default items-start gap-3 rounded-xl px-3 py-3 text-sm outline-hidden select-none",
        "transition-colors duration-100",
        "data-[selected=true]:bg-accent/50",
      )}
    >
      <span className="bg-muted/50 text-muted-foreground mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl">
        <Icon className="size-4" />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          dir="auto"
          className="line-clamp-2 min-w-0 text-start leading-relaxed"
        >
          {item.text}
        </span>
        <span className="text-muted-foreground/70 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          <span className="border-input rounded-full border px-2 py-0.5 text-[10px]">
            {brandLabel(item.brand)}
          </span>
          {channel && <span>{channel}</span>}
          {item.turn && item.turn > 1 && (
            <span dir="ltr">{fill(t.spotlightTurn, { turn: item.turn })}</span>
          )}
          {item.mediaUrls.length > 0 && (
            <span className="flex items-center gap-1" dir="ltr">
              <Images className="size-3" />
              {item.mediaUrls.length}
            </span>
          )}
          <span dir="auto">{whenLabel(item, t, lang)}</span>
          {readOnly && (
            <span className="opacity-70">· {t.spotlightReadOnly}</span>
          )}
        </span>
      </span>
    </CommandPrimitive.Item>
  );
}

/**
 * Drafts read as an age ("3h ago") because the queue's question is how long
 * something has waited; variants read as a date, because theirs is when.
 */
function whenLabel(item: QueueItem, t: SocialDict, lang: string): string {
  const date = new Date(item.when);
  if (Number.isNaN(date.getTime())) return "";

  if (item.kind === "draft") {
    const minutes = Math.max(
      0,
      Math.round((Date.now() - date.getTime()) / 60_000),
    );
    const age =
      minutes >= 60 * 24
        ? `${Math.round(minutes / (60 * 24))}d`
        : minutes >= 60
          ? `${Math.round(minutes / 60)}h`
          : `${minutes}m`;
    return fill(t.reviewAgo, { age });
  }

  const when = date.toLocaleString(lang === "ar" ? "ar" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return fill(
    item.kind === "scheduled" ? t.spotlightGoesOut : t.spotlightWentOut,
    { when },
  );
}

/** hogwarts' keyboard hints, trimmed to the three keys this box binds. */
function Footer({ t }: { t: SocialDict }) {
  return (
    <div className="text-muted-foreground/50 flex items-center gap-4 border-t border-black/5 px-4 py-2 text-[11px] dark:border-white/10">
      <span className="flex items-center gap-1.5">
        <Key>↑</Key>
        <Key>↓</Key>
        <span>{t.spotlightHintNavigate}</span>
      </span>
      <span className="flex items-center gap-1.5">
        <Key>↵</Key>
        <span>{t.spotlightHintOpen}</span>
      </span>
      <span className="ms-auto flex items-center gap-1.5">
        <Key>esc</Key>
        <span>{t.spotlightHintClose}</span>
      </span>
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      dir="ltr"
      className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-black/10 bg-black/5 px-1.5 font-mono text-[10px] dark:border-white/10 dark:bg-white/5"
    >
      {children}
    </kbd>
  );
}
