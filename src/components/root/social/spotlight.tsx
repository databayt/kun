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
  ArrowUp,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  Images,
  Layers,
  Loader2,
  PenLine,
  Plus,
  RefreshCw,
  Settings,
  Settings2,
  X,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mediaKind } from "@/lib/media-kind";
import {
  approveDraft,
  publishPostDirect,
  stageForReview,
  type BrandMedia,
  type PostResult,
  type ReviewLink,
} from "@/actions/post-social";
import { CHANNELS, type ChannelId } from "@/components/root/social/config";
import {
  DESTINATIONS,
  MEDIA_FILTERS,
  POST_TYPES,
  libraryFits,
  queueFits,
  type Destination,
  type MediaFilter,
  type PostType,
} from "@/components/root/social/post-settings";
import { PRODUCTS, type ProductId } from "@/components/root/social/products";
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

const DESTINATION_KEY = "social:destination";
const POST_TYPE_KEY = "social:post-type";
const MEDIA_FILTER_KEY = "social:media-filter";

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

/**
 * A choice that survives a reload, read after mount so the server render never
 * touches localStorage. Three settings wanted the same six lines.
 */
function usePersisted<T extends string>(
  key: string,
  fallback: T,
  isValid: (value: string) => value is T,
): [T, (next: T) => void] {
  const [value, setValue] = React.useState<T>(fallback);
  React.useEffect(() => {
    const stored = window.localStorage.getItem(key);
    if (stored && isValid(stored)) setValue(stored);
    // `isValid` is a fresh closure each render and the key never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const commit = React.useCallback(
    (next: T) => {
      setValue(next);
      window.localStorage.setItem(key, next);
    },
    [key],
  );
  return [value, commit];
}

export function ReviewSpotlight({
  onEngagedChange,
}: {
  /**
   * Fires when the box opens or closes. The stage above uses it to lock the
   * screen around this column — see review.tsx. A callback rather than shared
   * state because only one surface reacts, and the box should not have to know
   * what reacting means.
   */
  onEngagedChange?: (engaged: boolean) => void;
} = {}) {
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
    brandMedia,
    attachMedia,
    removeMedia,
    goToStage,
    setProduct,
    setSelectedChannels,
    wiredForProduct,
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
  // Which face the one panel is wearing. The dropdown under the bar is the
  // only revealed surface this box has; the media picker borrows it rather
  // than floating a second layer over the page.
  const [panel, setPanel] = React.useState<"queue" | "media" | "config">(
    "queue",
  );
  const [sending, setSending] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  /** Signed approval links, when Send staged instead of published. */
  const [links, setLinks] = React.useState<ReviewLink[] | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const [destination, setDestination] = usePersisted<Destination>(
    DESTINATION_KEY,
    "direct",
    (v): v is Destination => (DESTINATIONS as readonly string[]).includes(v),
  );
  const [postType, setPostType] = usePersisted<PostType>(
    POST_TYPE_KEY,
    "post",
    (v): v is PostType => (POST_TYPES as readonly string[]).includes(v),
  );
  const [mediaFilter, setMediaFilter] = usePersisted<MediaFilter>(
    MEDIA_FILTER_KEY,
    "any",
    (v): v is MediaFilter => (MEDIA_FILTERS as readonly string[]).includes(v),
  );

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
      items.filter((item) => {
        if (mediaOnly && item.mediaUrls.length === 0) return false;
        // The settings face reaches the queue too: asking for Video narrows
        // this to drafts and posts that actually carry one.
        if (!queueFits(item.mediaUrls, mediaFilter)) return false;
        return !trimmed || matchesQuery(item.haystack, trimmed);
      }),
    [items, mediaOnly, mediaFilter, trimmed],
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

  /**
   * What the quick-start row offers, for the brand the settings currently
   * name. Derived from the corpus already in the client — no extra read, and
   * no reaching into another face to find out whether there is anything
   * waiting.
   */
  const brandDrafts = React.useMemo(
    () => items.filter((i) => i.kind === "draft" && i.brand === product),
    [items, product],
  );
  const nextDraft = React.useMemo(
    () =>
      [...brandDrafts].sort((a, b) => a.when.localeCompare(b.when))[0] ?? null,
    [brandDrafts],
  );
  const lastPublished = React.useMemo(
    () =>
      [...items]
        .filter((i) => i.kind === "published" && i.brand === product)
        .sort((a, b) => b.when.localeCompare(a.when))[0] ?? null,
    [items, product],
  );

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
   * The button says what it is about to do, which is two questions at once:
   * where the post is going (the destination setting) and whether sending
   * also claims a queue draft.
   */
  const sendLabel =
    destination === "review"
      ? t.stageForReview
      : destination === "schedule"
        ? reviewQueue.activeDraftId
          ? t.approveScheduleAction
          : t.scheduleAction
        : reviewQueue.activeDraftId
          ? t.approveAction
          : t.publishDirectAction;

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
    setLinks(null);
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

      if (destination === "review") {
        // The draft half of draft-or-direct. Nothing reaches a platform: this
        // mints a piece with `pending` variants and one single-use signed link
        // per channel, and an approver's press is what publishes.
        const staged = await stageForReview(payload);
        res = staged;
        if (staged.ok) {
          setNotice(staged.delivered ? t.stagedMsg : t.stagedLocalMsg);
          setLinks(staged.links ?? null);
        }
      } else if (draftId) {
        const approved = await approveDraft({
          draftId,
          mode: destination === "schedule" ? "schedule" : "now",
          ...payload,
        });
        res = approved;
        if (destination === "schedule") {
          scheduled = {
            count: approved.count ?? 0,
            at: approved.at ? new Date(approved.at).toLocaleString() : "",
          };
        }
      } else {
        res = await publishPostDirect(payload);
      }

      if (res.ok) {
        if (destination !== "review") {
          setNotice(
            scheduled ? fill(t.scheduledMsg, scheduled) : t.approvedNowMsg,
          );
        }
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
    destination,
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

  // Report engagement upward on the transition only, so a parent re-render
  // cannot be mistaken for a state change.
  const engagedRef = React.useRef(false);
  React.useEffect(() => {
    if (engagedRef.current === open) return;
    engagedRef.current = open;
    onEngagedChange?.(open);
  }, [open, onEngagedChange]);

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
        {/* The line you see at rest: attach on one side, send on the other,
            and the writing between them. The magnifying glass that used to sit
            here described the smaller half of what this field does — it is the
            post now, and a post is written and sent, not looked up. Finding is
            still here, in the panel underneath. */}
        <div className="relative flex h-12 items-center gap-2 ps-3 pe-2">
          {/* Opens the panel already under the bar, on its media face. A
              second floating layer over a panel that was open anyway is one
              surface too many. Pressing it again returns to the queue. */}
          <button
            type="button"
            aria-label={t.mediaLabel}
            title={t.mediaLabel}
            aria-expanded={open && panel === "media"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setPanel((current) =>
                open && current === "media" ? "queue" : "media",
              );
              setFocused(true);
              inputRef.current?.focus();
            }}
            className={cn(
              "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full",
              "transition-colors duration-150",
              composerMediaUrls.length > 0 || (open && panel === "media")
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
            )}
          >
            {composerMediaUrls.length > 0 ? (
              <span className="text-xs font-medium tabular-nums" dir="ltr">
                {composerMediaUrls.length}
              </span>
            ) : (
              <Plus className="size-5" />
            )}
          </button>
          <CommandPrimitive.Input
            ref={inputRef}
            value={query}
            onValueChange={(value) => {
              // Writing or searching — either way the queue is the face that
              // answers, so a keystroke takes the panel back from the picker.
              setPanel("queue");
              setQuery(value);
            }}
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

          {/* One seat, two jobs, decided by whether there is anything to
              send. Empty, it opens the post's settings — brand, channels, and
              what Approve does. The moment a character lands it becomes Send.

              One button, not two swapped ones: the circle never moves or
              redraws, only the glyph inside it changes. A button that springs
              and rotates on every first keystroke is a firework where a state
              change would do. */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (trimmed) {
                void handleSend();
                return;
              }
              setPanel((current) =>
                open && current === "config" ? "queue" : "config",
              );
              setFocused(true);
              inputRef.current?.focus();
            }}
            disabled={trimmed ? Boolean(blockedReason) || sending : false}
            title={trimmed ? (blockedReason ?? sendLabel) : t.spotlightConfig}
            aria-label={trimmed ? sendLabel : t.spotlightConfig}
            aria-expanded={!trimmed && open && panel === "config"}
            className={cn(
              "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full",
              "bg-clay text-clay-foreground transition-opacity duration-150",
              "hover:opacity-90",
              // Blocked keeps the clay and loses only the pointer — no fade,
              // no grey, so the seat is the same object throughout.
              "disabled:cursor-not-allowed disabled:hover:opacity-100",
            )}
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : trimmed ? (
              <ArrowUp className="size-5" />
            ) : (
              /* A gear, not sliders: this opens what the post IS — brand,
                 channels, when it goes — and sliders already mean the queue's
                 filters, one row below. */
              <Settings className="size-5" />
            )}
          </button>
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
              {panel === "config" ? (
                <ConfigPanel
                  t={t}
                  isRTL={isRTL}
                  product={product}
                  onProduct={setProduct}
                  wired={wiredForProduct}
                  selected={selectedChannels}
                  onChannels={setSelectedChannels}
                  destination={destination}
                  onDestination={setDestination}
                  postType={postType}
                  onPostType={setPostType}
                  mediaFilter={mediaFilter}
                  onMediaFilter={setMediaFilter}
                  nextDraft={nextDraft}
                  queueCount={brandDrafts.length}
                  lastPublished={lastPublished}
                  onUseDraft={(id) => {
                    reviewQueue.loadDraft(id);
                    setPanel("queue");
                    setNotice(null);
                    setError(null);
                    setFocused(false);
                    inputRef.current?.blur();
                  }}
                  onReuse={(text) => {
                    // Text only. Carrying the draft id would make Send
                    // re-approve a consumed request; carrying the media would
                    // quietly republish the same image.
                    reviewQueue.clearActive();
                    setQuery(text);
                    setPanel("queue");
                    setNotice(t.spotlightStartReused);
                    setError(null);
                  }}
                  onBlank={() => {
                    reviewQueue.clearActive();
                    setPanel("queue");
                    setNotice(null);
                    setError(null);
                    inputRef.current?.focus();
                  }}
                />
              ) : panel === "media" ? (
                <MediaPanel
                  t={t}
                  urls={composerMediaUrls}
                  brandMedia={brandMedia}
                  postType={postType}
                  mediaFilter={mediaFilter}
                  onAttach={attachMedia}
                  onRemove={removeMedia}
                  onBrowse={() => goToStage("media")}
                />
              ) : (
                <>
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

                    {/* The config face's other door. The trailing button in
                        the line above is the same door while the field is
                        empty; once there is copy to send, that button has a
                        more urgent job and this one is how you still get
                        back here. */}
                    <button
                      type="button"
                      aria-label={t.spotlightConfig}
                      title={t.spotlightConfig}
                      // This row only renders on the queue face, so pressing
                      // it is always a move TO config, never a toggle back.
                      aria-expanded={false}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setPanel("config");
                        setFocused(true);
                        inputRef.current?.focus();
                      }}
                      className={cn(
                        "flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors duration-150",
                        destination !== "direct"
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground/70 hover:bg-accent/50 hover:text-accent-foreground",
                      )}
                    >
                      <Settings2 className="size-4" />
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
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CommandPrimitive>

      {/* What the send did. Under the box, because the box collapses and a
          notice inside it would vanish with the panel that carried it. */}
      {links && links.length > 0 && (
        <ul className="border-input mt-3 space-y-1 rounded-lg border p-3 text-sm">
          <li className="text-muted-foreground pb-1 text-xs font-medium">
            {t.reviewLinksTitle}
          </li>
          {links.map((link) => (
            <li key={link.channel} className="flex items-center gap-2">
              <span className="text-muted-foreground w-24 shrink-0 text-xs">
                {link.channel}
              </span>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                className="truncate font-mono text-xs underline underline-offset-4"
              >
                {link.url}
              </a>
            </li>
          ))}
        </ul>
      )}

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
 * The panel's third face — what the post IS, before what it says.
 *
 * Two levels, not one long form. The first is boxes: Brand · Channels ·
 * Timing, each carrying the answer it currently holds, so the face reads as a
 * summary of the post's settings before it is a way to change them. Opening
 * one puts its choices in the middle of the same panel, with a way back.
 *
 * These three decide where the copy lands and when, and they were scattered
 * across the page header, a popover and a shell select — a writer changing
 * brand had to leave the box they were writing in. Approve-mode lives here
 * rather than behind its own popover because a portal over a raised column is
 * a stacking fight nobody wins: measured, the popover opened underneath the
 * queue rows.
 */
type ConfigSection = "brand" | "channels" | "postType" | "media" | "destination";

function ConfigPanel({
  t,
  isRTL,
  product,
  onProduct,
  wired,
  selected,
  onChannels,
  destination,
  onDestination,
  postType,
  onPostType,
  mediaFilter,
  onMediaFilter,
  nextDraft,
  queueCount,
  lastPublished,
  onUseDraft,
  onReuse,
  onBlank,
}: {
  t: SocialDict;
  isRTL: boolean;
  product: string;
  onProduct: (id: ProductId) => void;
  wired: ChannelId[];
  selected: ChannelId[];
  onChannels: (next: ChannelId[]) => void;
  destination: Destination;
  onDestination: (next: Destination) => void;
  postType: PostType;
  onPostType: (next: PostType) => void;
  mediaFilter: MediaFilter;
  onMediaFilter: (next: MediaFilter) => void;
  /** Oldest draft awaiting review for this brand, if any. */
  nextDraft: { id: string } | null;
  queueCount: number;
  /** Most recent post that actually went out for this brand. */
  lastPublished: { text: string } | null;
  onUseDraft: (id: string) => void;
  onReuse: (text: string) => void;
  onBlank: () => void;
}) {
  const [section, setSection] = React.useState<ConfigSection | null>(null);

  const brandName = (() => {
    const p = PRODUCTS.find((entry) => entry.id === product);
    return p ? (isRTL ? p.labelAr : p.label) : product;
  })();

  const channelName = (id: ChannelId) => {
    const c = CHANNELS.find((entry) => entry.id === id);
    return c ? (isRTL ? c.labelAr : c.label) : id;
  };

  const postTypeName: Record<PostType, string> = {
    post: t.postTypePost,
    carousel: t.postTypeCarousel,
    reel: t.postTypeReel,
    story: t.postTypeStory,
  };

  const mediaName: Record<MediaFilter, string> = {
    any: t.mediaAny,
    image: t.mediaImage,
    video: t.mediaVideo,
  };

  const destinationName: Record<Destination, string> = {
    direct: t.destinationDirect,
    schedule: t.destinationSchedule,
    review: t.destinationReview,
  };

  const destinationHint: Record<Destination, string> = {
    direct: t.destinationDirectHint,
    schedule: t.destinationScheduleHint,
    review: t.destinationReviewHint,
  };

  const toggle = (id: ChannelId) =>
    onChannels(
      selected.includes(id)
        ? selected.filter((c) => c !== id)
        : [...selected, id],
    );

  const shell =
    "max-h-[min(360px,45vh)] overflow-y-auto border-t border-black/5 p-4 text-start dark:border-white/10";

  const pill = (on: boolean) =>
    cn(
      "cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150",
      on
        ? "bg-accent text-accent-foreground"
        : "text-muted-foreground/70 hover:bg-accent/50 hover:text-accent-foreground",
    );

  /**
   * ——— Under the boxes: the three ways a post actually starts ———
   *
   * Settings say what a post IS; this says where its words come from, which is
   * the part that was slow. The queue was reachable only by opening another
   * face and reading a list; the last post that went out was reachable only by
   * leaving for the ledger. Both are already in the client, so both are one
   * press from here.
   *
   * Reuse copies TEXT and nothing else — no draft id, no media. That matters:
   * carrying the id would make Send re-approve a request that is already
   * consumed, and carrying the media would quietly republish the same image.
   * What comes back is a starting point, and the notice says so.
   */
  const startFrom = (
    <div className="mt-3 border-t border-black/5 pt-3 dark:border-white/10">
      <p className="text-muted-foreground/60 pb-2 text-[11px]">
        {t.spotlightStartTitle}
      </p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <StartCard
          label={t.spotlightStartQueue}
          hint={
            nextDraft
              ? fill(t.spotlightStartQueueHint, { count: queueCount })
              : t.spotlightStartQueueEmpty
          }
          disabled={!nextDraft}
          onClick={() => nextDraft && onUseDraft(nextDraft.id)}
        />
        <StartCard
          label={t.spotlightStartReuse}
          hint={lastPublished ? t.spotlightStartReuseHint : t.spotlightStartReuseEmpty}
          disabled={!lastPublished}
          onClick={() => lastPublished && onReuse(lastPublished.text)}
        />
        <StartCard
          label={t.spotlightStartBlank}
          hint={t.spotlightStartBlankHint}
          onClick={onBlank}
        />
      </div>
    </div>
  );

  /* ——— Level one: the boxes ——— */
  if (!section) {
    const tiles: { id: ConfigSection; label: string; value: string }[] = [
      { id: "brand", label: t.spotlightConfigBrand, value: brandName },
      {
        id: "channels",
        label: t.spotlightConfigChannels,
        value: selected.length
          ? selected.map(channelName).join(" · ")
          : t.spotlightConfigNone,
      },
      {
        id: "postType",
        label: t.spotlightConfigPostType,
        value: postTypeName[postType],
      },
      {
        id: "media",
        label: t.spotlightConfigMedia,
        value: mediaName[mediaFilter],
      },
      {
        id: "destination",
        label: t.spotlightConfigTiming,
        value: destinationName[destination],
      },
    ];

    return (
      <div className={shell}>
        {/* One row, always. Five settings read as a single line of state —
            "hogwarts, facebook, a post, any media, publish now" — and a grid
            that reflows into two rows on a narrow screen turns that sentence
            into a paragraph. It scrolls sideways instead. */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {tiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setSection(tile.id)}
              className={cn(
                "border-input hover:border-foreground/30 hover:bg-accent/40 flex min-w-0 flex-1",
                "shrink-0 basis-0 cursor-pointer flex-col items-start gap-0.5 rounded-xl border",
                "px-2.5 py-2 text-start transition-colors duration-150",
              )}
            >
              <span className="text-muted-foreground/70 truncate text-[10px]">
                {tile.label}
              </span>
              <span className="w-full truncate text-xs font-medium">
                {tile.value}
              </span>
            </button>
          ))}
        </div>

        {startFrom}
      </div>
    );
  }

  /* ——— Level two: one box, opened ——— */
  const heading: Record<ConfigSection, string> = {
    brand: t.spotlightConfigBrand,
    channels: t.spotlightConfigChannels,
    postType: t.spotlightConfigPostType,
    media: t.spotlightConfigMedia,
    destination: t.spotlightConfigTiming,
  };

  const hint: Partial<Record<ConfigSection, string>> = {
    postType: t.postTypeHint,
    media: t.mediaFilterHint,
  };

  return (
    <div className={shell}>
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setSection(null)}
          aria-label={t.spotlightConfigBack}
          title={t.spotlightConfigBack}
          className="text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-150"
        >
          <ChevronLeft className="size-4 rtl:-scale-x-100" />
        </button>
        <p className="text-sm font-medium">{heading[section]}</p>
      </div>

      {/* Centred, because this is the middle of a panel rather than a form on
          a page — the choices are the only thing here and they should sit
          where the eye already is. */}
      <div className="flex min-h-[7rem] flex-col items-center justify-center gap-2">
        {section === "brand" && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {PRODUCTS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onProduct(entry.id)}
                aria-pressed={product === entry.id}
                className={pill(product === entry.id)}
              >
                {isRTL ? entry.labelAr : entry.label}
              </button>
            ))}
          </div>
        )}

        {section === "channels" &&
          (wired.length === 0 ? (
            <p className="text-muted-foreground/60 text-xs">
              {t.spotlightConfigNoChannels}
            </p>
          ) : (
            <div className="flex flex-wrap justify-center gap-1.5">
              {wired.map((id) => (
                <button
                  key={id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggle(id)}
                  aria-pressed={selected.includes(id)}
                  className={pill(selected.includes(id))}
                >
                  {channelName(id)}
                </button>
              ))}
            </div>
          ))}

        {section === "postType" && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {POST_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPostType(type)}
                aria-pressed={postType === type}
                className={pill(postType === type)}
              >
                {postTypeName[type]}
              </button>
            ))}
          </div>
        )}

        {section === "media" && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {MEDIA_FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onMediaFilter(value)}
                aria-pressed={mediaFilter === value}
                className={pill(mediaFilter === value)}
              >
                {mediaName[value]}
              </button>
            ))}
          </div>
        )}

        {section === "destination" && (
          <div className="w-full max-w-sm space-y-1">
            {DESTINATIONS.map((option) => (
              <button
                key={option}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onDestination(option)}
                aria-pressed={destination === option}
                className={cn(
                  "flex w-full cursor-pointer flex-col rounded-lg p-2 text-start transition-colors duration-150",
                  destination === option ? "bg-accent" : "hover:bg-muted",
                )}
              >
                <span className="text-sm font-medium">
                  {destinationName[option]}
                </span>
                <span className="text-muted-foreground text-xs">
                  {destinationHint[option]}
                </span>
              </button>
            ))}
          </div>
        )}

        {hint[section] && (
          <p className="text-muted-foreground/60 pt-1 text-center text-[11px]">
            {hint[section]}
          </p>
        )}
      </div>
    </div>
  );
}

/** One way in, on the quick-start row. Disabled when there is nothing there. */
function StartCard({
  label,
  hint,
  disabled,
  onClick,
}: {
  label: string;
  hint: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "border-input flex min-w-0 flex-1 shrink-0 basis-0 flex-col items-start gap-0.5",
        "rounded-xl border px-2.5 py-2 text-start transition-colors duration-150",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "hover:border-foreground/30 hover:bg-accent/40 cursor-pointer",
      )}
    >
      <span className="w-full truncate text-xs font-medium">{label}</span>
      <span className="text-muted-foreground/70 w-full truncate text-[10px]">
        {hint}
      </span>
    </button>
  );
}

/**
 * The panel's other face — where image and video get onto the post.
 *
 * It renders INSIDE the dropdown rather than in a popover of its own. The
 * panel is already open when the ⊕ is pressed, and a floating layer over an
 * open panel is one surface too many: two stacking contexts, two ways to
 * dismiss, and a picker that covers the thing it is attaching to.
 *
 * Three ways in, cheapest first: the brand's own library (the common case, and
 * it should not cost a trip to the showroom and a copied URL), a pasted CDN
 * link, and the showroom itself for actual browsing. What is already attached
 * sits on top with a remove on each — the tray has nowhere else to live now
 * that the composer's inline strip is gone.
 */
function MediaPanel({
  t,
  urls,
  brandMedia,
  postType,
  mediaFilter,
  onAttach,
  onRemove,
  onBrowse,
}: {
  t: SocialDict;
  urls: string[];
  brandMedia: BrandMedia[];
  postType: PostType;
  mediaFilter: MediaFilter;
  onAttach: (url: string) => void;
  onRemove: (url: string) => void;
  onBrowse: () => void;
}) {
  const [draft, setDraft] = React.useState("");
  const valid = /^https?:\/\//i.test(draft.trim());

  /**
   * Library picks not already in the tray — attached ones would be inert —
   * narrowed by what the post says it is. Choosing Reel in the settings stops
   * this offering hero stills; choosing Video stops it offering images. The
   * settings face is not decoration: this is where two of its boxes land.
   */
  const suggestions = brandMedia.filter(
    (m) => !urls.includes(m.url) && libraryFits(m, postType, mediaFilter),
  );

  const addUrl = () => {
    if (!valid) return;
    onAttach(draft.trim());
    setDraft("");
  };

  return (
    <div className="max-h-[min(360px,45vh)] overflow-y-auto border-t border-black/5 p-4 text-start dark:border-white/10">
      {urls.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {urls.map((url) => (
            <div key={url} className="group/chip relative">
              {mediaKind(url) === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt=""
                  loading="lazy"
                  className="border-border size-16 rounded-xl border object-cover"
                />
              ) : (
                <span className="border-border bg-muted-foreground/10 flex size-16 items-center justify-center rounded-xl border font-mono text-[10px] tracking-wider uppercase">
                  {t.mediaKindVideo}
                </span>
              )}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onRemove(url)}
                aria-label={t.attachRemove}
                className="bg-background border-border absolute -top-1.5 -end-1.5 rounded-full border p-0.5 opacity-0 transition-opacity group-hover/chip:opacity-100 focus-visible:opacity-100"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <>
          <p className="text-muted-foreground/60 pb-2 text-[11px]">
            {t.recommendedMedia}
          </p>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {suggestions.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onAttach(asset.url)}
                title={asset.title}
                aria-label={fill(t.attachNamed, { name: asset.title })}
                className="border-border hover:border-foreground/40 focus-visible:border-foreground/40 size-16 shrink-0 overflow-hidden rounded-xl border transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.url}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
            ))}
          </div>
        </>
      )}

      <label
        htmlFor="social-media-url"
        className="text-muted-foreground mb-1 block text-xs font-medium"
      >
        {t.attachAddUrl}
      </label>
      <div className="flex gap-1.5">
        <Input
          id="social-media-url"
          type="url"
          dir="ltr"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // The panel lives inside a cmdk root, which reads arrow keys and
          // Enter as list navigation. This field is not a list.
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              addUrl();
            }
          }}
          placeholder={t.mediaPlaceholder}
          className="font-mono text-sm"
        />
        <Button
          variant="outline"
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={addUrl}
          disabled={!valid}
          className="h-9 shrink-0 rounded-full"
          aria-label={t.attachAddAction}
        >
          <Plus className="size-4" />
        </Button>
      </div>
      <p className="text-muted-foreground mt-2 text-xs">{t.mediaHint}</p>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onBrowse}
        className="text-foreground mt-2 text-xs font-medium underline underline-offset-4"
      >
        {t.attachBrowse}
      </button>
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
