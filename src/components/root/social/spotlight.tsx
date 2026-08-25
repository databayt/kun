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

import {
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandLinkedin,
  IconBrandSlack,
  IconBrandSnapchat,
  IconBrandTiktok,
  IconBrandWhatsapp,
  IconBrandX,
  type IconProps,
} from "@tabler/icons-react";

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
  POST_TYPE_META,
  featureFits,
  featureLabel,
  featuresFor,
  libraryFits,
  queueFits,
  type Destination,
  type BrandFeature,
  type MediaFilter,
  type PostType,
  type PostTypeMeta,
} from "@/components/root/social/post-settings";
import {
  PICKABLE_PRODUCTS,
  PRODUCTS,
  SOCIAL_PRODUCTS,
  type ProductId,
} from "@/components/root/social/products";
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
const FEATURE_KEY = "social:feature";

/** The select's "no pillar chosen" row, stored as a value rather than absence. */
const ANY_FEATURE = "any";

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
  /** Drafts only: the ask it was written from, which carries its pillar. */
  brief?: string;
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

/**
 * A channel's own glyph, for the picker that offers it.
 *
 * Tabler rather than an asset folder: these are platform marks, they ship with
 * a dependency the app already has, and they are drawn as icons — an outline
 * that sits beside our own brand marks without pretending to be one. lucide
 * dropped its brand set, which is why the house icon library cannot serve here.
 *
 * Keyed by the ids in config.ts. A channel with no entry falls back to its
 * name, the same way a brand without artwork does.
 */
/** One name per shape, so the summary and the cards cannot disagree. */
const POST_TYPE_LABEL: Record<PostType, keyof SocialDict> = {
  text: "postTypeText",
  image: "postTypeImage",
  gallery: "postTypeGallery",
  video: "postTypeVideo",
  imageOnly: "postTypeImageOnly",
  videoOnly: "postTypeVideoOnly",
  carousel: "postTypeCarousel",
  story: "postTypeStory",
  reel: "postTypeReel",
};

const CHANNEL_ICON: Record<string, React.ComponentType<IconProps>> = {
  facebook: IconBrandFacebook,
  instagram: IconBrandInstagram,
  whatsapp: IconBrandWhatsapp,
  x: IconBrandX,
  linkedin: IconBrandLinkedin,
  tiktok: IconBrandTiktok,
  snapchat: IconBrandSnapchat,
  slack: IconBrandSlack,
};

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
    checking,
    checkConnections,
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
  // The settings dialog. Like the filters menu it portals out of this subtree,
  // so the panel has to be told to stay open behind it.
  // Brand is open by default: the face should show something the moment it
  // appears, and brand is the setting every other one is scoped by.
  const [configFocus, setConfigFocus] = React.useState<ConfigSection | null>(
    "brand",
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
    // Text and one still is the ordinary post; the rest are departures from it.
    "image",
    (v): v is PostType => (POST_TYPES as readonly string[]).includes(v),
  );
  const [feature, setFeature] = usePersisted<string>(
    FEATURE_KEY,
    ANY_FEATURE,
    (v): v is string => typeof v === "string",
  );
  const [mediaFilter, setMediaFilter] = usePersisted<MediaFilter>(
    MEDIA_FILTER_KEY,
    "any",
    (v): v is MediaFilter => (MEDIA_FILTERS as readonly string[]).includes(v),
  );

  /**
   * Features are per-brand vocabulary — mkan does not have Attendance — so a
   * feature chosen under one brand is meaningless under the next, and would
   * silently narrow the queue rather than say why. Switching brand drops it.
   */
  const brandFeatures = React.useMemo(() => featuresFor(product), [product]);
  React.useEffect(() => {
    if (
      feature !== ANY_FEATURE &&
      !brandFeatures.some((f) => f.id === feature)
    ) {
      setFeature(ANY_FEATURE);
    }
  }, [brandFeatures, feature, setFeature]);

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
      brief: d.brief,
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
        // Every mode, not only drafts: a feature is matched on the words a
        // post uses, and a published post uses them too.
        if (
          !featureFits(
            item.brand,
            item.haystack,
            feature === ANY_FEATURE ? null : feature,
          )
        ) {
          return false;
        }
        return !trimmed || matchesQuery(item.haystack, trimmed);
      }),
    [items, mediaOnly, mediaFilter, feature, trimmed],
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
   * Relative age, the same coarse one the queue rows use — the Queue word's
   * list asks the same question ("how long has this waited"), so it should not
   * grow a second clock that rounds differently.
   */
  const ageLabel = React.useCallback(
    (iso: string) => {
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
    },
    [t],
  );

  /**
   * This brand's drafts awaiting review, oldest first — what the Queue word
   * lists. Derived from the corpus already in the client, so reaching the
   * queue costs no read.
   */
  const brandDrafts = React.useMemo(
    () =>
      items
        .filter((i) => i.kind === "draft" && i.brand === product)
        .sort((a, b) => a.when.localeCompare(b.when)),
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
          // The filters menu portals out of this subtree but still bubbles
          // through the React tree, so its Escape arrives here too. Whoever is
          // on top owns that key.
          if (menuOpen) return;
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
                  feature={feature}
                  onFeature={setFeature}
                  features={brandFeatures}
                  destination={destination}
                  onDestination={setDestination}
                  postType={postType}
                  onPostType={setPostType}
                  mediaFilter={mediaFilter}
                  onMediaFilter={setMediaFilter}
                  drafts={brandDrafts.map((d) => ({
                    id: d.id,
                    text: d.text,
                    when: d.when,
                  }))}
                  ago={ageLabel}
                  onUseDraft={(id) => {
                    reviewQueue.loadDraft(id);
                    setPanel("queue");
                    setNotice(null);
                    setError(null);
                    setFocused(false);
                    inputRef.current?.blur();
                  }}
                  onOpenDialog={setConfigFocus}
                  openSection={configFocus}
                  onCloseSection={() => {
                    setConfigFocus(null);
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
type ConfigSection =
  | "brand"
  | "feature"
  | "channels"
  | "postType"
  | "media"
  | "destination"
  | "queue";

function ConfigPanel({
  t,
  isRTL,
  product,
  onProduct,
  wired,
  selected,
  onChannels,
  feature,
  onFeature,
  features,
  destination,
  onDestination,
  postType,
  onPostType,
  mediaFilter,
  onMediaFilter,
  drafts,
  onUseDraft,
  ago,
  onOpenDialog,
  openSection,
  onCloseSection,
}: {
  t: SocialDict;
  isRTL: boolean;
  product: string;
  onProduct: (id: ProductId) => void;
  wired: ChannelId[];
  selected: ChannelId[];
  onChannels: (next: ChannelId[]) => void;
  feature: string;
  onFeature: (next: string) => void;
  features: BrandFeature[];
  destination: Destination;
  onDestination: (next: Destination) => void;
  postType: PostType;
  onPostType: (next: PostType) => void;
  mediaFilter: MediaFilter;
  onMediaFilter: (next: MediaFilter) => void;
  /** This brand's drafts awaiting review, oldest first. */
  drafts: { id: string; text: string; when: string }[];
  onUseDraft: (id: string) => void;
  /** Relative age, formatted by the parent so one clock serves both faces. */
  ago: (iso: string) => string;
  onOpenDialog: (section: ConfigSection) => void;
  /** Which box is open, and how to shut it. Held by the parent so Escape
   *  can be given to this card before it reaches the box underneath. */
  openSection: ConfigSection | null;
  onCloseSection: () => void;
}) {

  const brandName = (() => {
    const p = PRODUCTS.find((entry) => entry.id === product);
    return p ? (isRTL ? p.labelAr : p.label) : product;
  })();

  const channelName = (id: ChannelId) => {
    const c = CHANNELS.find((entry) => entry.id === id);
    return c ? (isRTL ? c.labelAr : c.label) : id;
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
    "relative max-h-[min(360px,45vh)] overflow-y-auto border-t border-black/5 p-4 text-start dark:border-white/10";

  const pill = (on: boolean) =>
    cn(
      "cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150",
      on
        ? "bg-accent text-accent-foreground"
        : "text-muted-foreground/70 hover:bg-accent/50 hover:text-accent-foreground",
    );

  const WORDS: { id: ConfigSection; label: string }[] = [
    { id: "brand", label: t.spotlightConfigBrand },
    { id: "feature", label: t.spotlightConfigFeature },
    { id: "channels", label: t.spotlightConfigChannels },
    { id: "postType", label: t.spotlightConfigPostType },
    { id: "media", label: t.spotlightConfigMedia },
    { id: "destination", label: t.spotlightConfigTiming },
    { id: "queue", label: t.spotlightConfigQueue },
  ];

  return (
    <div className={shell}>
      {/* Six words, and the one you press opens under it.
          
          They were boxes carrying their own values, and pressing one opened a
          card floating over the panel. Two things wrong with that: the card
          covered the rows it was launched from, and the value on every box
          made a settings summary out of a row that is really a nav. A word,
          then its choices, in the space below — nothing is hidden while you
          choose, and pressing the same word again shuts it. */}
      <div className="-mx-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
        {WORDS.map((word) => {
          const active = openSection === word.id;
          return (
            <button
              key={word.id}
              type="button"
              aria-pressed={active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                active ? onCloseSection() : onOpenDialog(word.id)
              }
              className={cn(
                "cursor-pointer py-1 text-sm transition-colors duration-150",
                active
                  ? "text-foreground font-medium"
                  : "text-muted-foreground/70 hover:text-foreground",
              )}
            >
              {word.label}
            </button>
          );
        })}
      </div>

      {openSection && (
        <div className="border-t border-black/5 pt-3 pb-1 dark:border-white/10">
          <ConfigChoices
            section={openSection}
            t={t}
            isRTL={isRTL}
            product={product}
            onProduct={onProduct}
            wired={wired}
            selected={selected}
            onChannels={onChannels}
            feature={feature}
            onFeature={onFeature}
            features={features}
            postType={postType}
            onPostType={onPostType}
            mediaFilter={mediaFilter}
            onMediaFilter={onMediaFilter}
            destination={destination}
            onDestination={onDestination}
            drafts={drafts}
            onUseDraft={onUseDraft}
            ago={ago}
          />
        </div>
      )}

    </div>
  );
}

/**
 * A post's shape, drawn as the post itself.
 *
 * Not an abstract diagram: a feed card with an avatar, a name, the copy, the
 * media and an action bar, because that is the thing being chosen and a
 * reader recognises it before reading a word. The 9:16 surfaces drop the feed
 * chrome — a story has no byline row above it — and the swipe frame lets the
 * next card peek in at the edge, which is the only thing that tells a carousel
 * apart from a single image at this size.
 */
function PostShape({
  meta,
  avatar,
  invertAvatar,
  pageName,
  when,
}: {
  meta: PostTypeMeta;
  /** The current brand's mark — a Page's profile picture is its logo. */
  avatar?: string;
  invertAvatar?: boolean;
  /** What the Page calls itself, shown where Facebook shows it. */
  pageName?: string;
  /** The byline's second line — when this will appear, per the Send setting. */
  when?: string;
}) {
  // Facebook's own furniture: a white card on a grey ground, with the
  // placeholder grey it uses for anything not yet loaded. Tokens rather than
  // the literal hexes, so the card follows the theme instead of staying white
  // in the dark.
  const surface = "bg-card";
  const skin = "bg-muted-foreground/20";
  const line = "bg-muted-foreground/20 h-1.5 rounded-full";
  const tall = meta.frame === "tall";

  return (
    <div
      aria-hidden
      className={cn(
        surface,
        "flex h-44 w-full flex-col gap-2 rounded-lg p-2.5 shadow-sm",
      )}
    >
      {/* The byline. Every feed post has one; a full-bleed vertical surface
          does not, so the tall frames spend that room on the media. */}
      {!tall && (
        <div className="flex items-center gap-1.5">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt=""
              className={cn(
                "size-6 shrink-0 rounded-full",
                // A Page picture fills its circle the way Facebook crops it;
                // a bare mark is padded so it does not touch the edge.
                invertAvatar
                  ? "bg-muted object-contain p-0.5 dark:invert"
                  : "object-cover",
              )}
            />
          ) : (
            <span className={cn(skin, "size-6 shrink-0 rounded-full")} />
          )}
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            {/* The Page's name, not a placeholder for one — it is known, and
                a bar where a name belongs is a skeleton pretending to load
                something that is already here. The timestamp stays a bar:
                when this posts is the Send setting's answer, not ours. */}
            {pageName ? (
              <span className="text-foreground/70 truncate text-start text-[9px] leading-none font-semibold">
                {pageName}
              </span>
            ) : (
              <span className={cn(line, "w-2/3")} />
            )}
            {/* Where Facebook prints the time and the audience. It is known
                too — the Send setting decides when this appears — so a grey
                bar here was a placeholder for an answer already given. */}
            {when ? (
              <span className="text-muted-foreground/70 truncate text-start text-[8px] leading-none">
                {when}
              </span>
            ) : (
              <span className={cn(line, "h-1 w-1/3")} />
            )}
          </span>
        </div>
      )}

      {meta.text && !tall && (
        <div className="flex flex-col gap-1">
          <span className={cn(line, "w-full")} />
          <span className={cn(line, "w-4/5")} />
          {meta.kind === "none" && (
            <>
              <span className={cn(line, "w-full")} />
              <span className={cn(line, "w-3/5")} />
            </>
          )}
        </div>
      )}

      {meta.kind !== "none" && (
        <div className="relative flex min-h-0 flex-1 gap-1">
          {meta.count === "many" && meta.frame !== "swipe" ? (
            <div className="grid h-full w-full grid-cols-2 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cn(skin, "h-full w-full rounded-sm")} />
              ))}
            </div>
          ) : (
            <>
              <span
                className={cn(
                  skin,
                  "flex h-full items-center justify-center rounded-md",
                  // The swipe frame leaves a sliver for the next card.
                  meta.frame === "swipe" ? "w-4/5" : "w-full",
                )}
              >
                {meta.kind === "video" && (
                  <span className="border-s-card h-0 w-0 border-y-[7px] border-s-[12px] border-y-transparent rtl:rotate-180" />
                )}
              </span>
              {meta.frame === "swipe" && (
                <span className={cn(skin, "h-full flex-1 rounded-s-md")} />
              )}
            </>
          )}
        </div>
      )}

      {/* Copy under the media is where a reel or a caption-last post puts it. */}
      {meta.text && tall && <span className={cn(line, "w-3/4")} />}

    </div>
  );
}

/**
 * The choices for whichever word is open, rendered under it.
 *
 * One shape for all six, because they all answer the same question — which of
 * these — and five layouts would be five things to learn. Pills wrap, so a
 * dozen features need no grid maths and no card to be measured and clamped;
 * the row simply grows and the panel scrolls if it must.
 *
 * Send is the exception, and earns it: its three answers change what pressing
 * the arrow DOES, so each carries the sentence that says so.
 */
/**
 * Drag a horizontal strip with the pointer.
 *
 * A finger and a trackpad can already flick an overflow row; a mouse cannot —
 * it gets a scrollbar, and the scrollbar is the thing being hidden. So the
 * strip itself becomes the handle.
 *
 * A CALLBACK ref, not an effect on a ref object. The row only exists while its
 * word is open, so an effect with an empty dependency list runs once against a
 * node that is not there yet and never attaches — measured: the strip sat at
 * scrollLeft 4 through a ten-step drag. A callback ref fires on every mount
 * and unmount, which is exactly when the listener should come and go.
 *
 * `dragging` is reported back so the caller can switch the cursor, suspend
 * scroll-snap (mandatory snapping corrects every scrollLeft this sets, which
 * pins the strip in place), and make the cards inert mid-drag — without that
 * last one, releasing after a swipe lands as a click and silently changes the
 * setting.
 */
function useDragScroll(): {
  ref: (node: HTMLElement | null) => void;
  dragging: boolean;
} {
  const [dragging, setDragging] = React.useState(false);
  const cleanup = React.useRef<(() => void) | null>(null);

  const ref = React.useCallback((node: HTMLElement | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!node) return;

    const from = { x: 0, left: 0, moved: false };
    const down = (e: PointerEvent) => {
      // Primary button only, and never a touch — a finger already scrolls,
      // and hijacking it would fight the platform's own momentum.
      if (e.pointerType === "touch" || e.button !== 0) return;
      from.x = e.clientX;
      from.left = node.scrollLeft;
      from.moved = false;

      const move = (m: PointerEvent) => {
        const dx = m.clientX - from.x;
        // A few pixels of slop, so a press that wobbles is still a press.
        if (!from.moved && Math.abs(dx) < 4) return;
        from.moved = true;
        setDragging(true);
        node.scrollLeft = from.left - dx;
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        // Released on the next frame: a click fires after pointerup, and the
        // cards must still be inert when it does.
        requestAnimationFrame(() => setDragging(false));
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };

    node.addEventListener("pointerdown", down);
    cleanup.current = () => node.removeEventListener("pointerdown", down);
  }, []);

  return { ref, dragging };
}

function ConfigChoices({
  section,
  t,
  isRTL,
  product,
  onProduct,
  wired,
  selected,
  onChannels,
  feature,
  onFeature,
  features,
  postType,
  onPostType,
  mediaFilter,
  onMediaFilter,
  destination,
  onDestination,
  drafts,
  onUseDraft,
  ago,
}: {
  section: ConfigSection;
  t: SocialDict;
  isRTL: boolean;
  product: string;
  onProduct: (id: ProductId) => void;
  wired: ChannelId[];
  selected: ChannelId[];
  onChannels: (next: ChannelId[]) => void;
  feature: string;
  onFeature: (next: string) => void;
  features: BrandFeature[];
  postType: PostType;
  onPostType: (next: PostType) => void;
  mediaFilter: MediaFilter;
  onMediaFilter: (next: MediaFilter) => void;
  destination: Destination;
  onDestination: (next: Destination) => void;
  drafts: { id: string; text: string; when: string }[];
  onUseDraft: (id: string) => void;
  ago: (iso: string) => string;
}) {
  const { ref: shapeRow, dragging } = useDragScroll();

  const pill = (on: boolean) =>
    cn(
      "cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150",
      on
        ? "bg-accent text-accent-foreground"
        : "text-muted-foreground/70 hover:bg-accent/50 hover:text-accent-foreground",
    );

  const Pills = ({
    items,
  }: {
    items: { id: string; label: string; on: boolean; pick: () => void }[];
  }) => (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={item.on}
          onMouseDown={(e) => e.preventDefault()}
          onClick={item.pick}
          className={pill(item.on)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  if (section === "brand") {
    // A brand with a mark shows it; the rest show their name. Mixed on
    // purpose — five wordmarks and one logo is the honest state of
    // public/brands/, and a placeholder for the missing five would be a
    // worse lie than a name.
    return (
      <div className="flex flex-wrap gap-1.5">
        {PICKABLE_PRODUCTS.map((p) => {
          const on = product === p.id;
          const name = isRTL ? p.labelAr : p.label;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              aria-label={name}
              title={name}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onProduct(p.id as ProductId)}
              className={cn(
                p.logo
                  ? cn(
                      // A mark needs room a word does not, and an outline of
                      // its own: a bare glyph on a bare background has no
                      // edge to say it is pressable, and no way to show it is
                      // the chosen one without dimming the others.
                      "flex size-20 shrink-0 cursor-pointer items-center justify-center",
                      "rounded-2xl border p-3.5 transition-colors duration-150",
                      on
                        ? "border-foreground/40 bg-accent"
                        : "border-input hover:border-foreground/30 hover:bg-accent/40",
                    )
                  : pill(on),
              )}
            >
              {p.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.logo}
                  alt={name}
                  className={cn(
                    // Full strength either way. Fading the ones you did not
                    // pick makes five brands look broken to say one is
                    // chosen; the outline says that.
                    "size-full object-contain",
                    // Monochrome-ink marks would vanish on a dark ground —
                    // the brand kit's own rule is that they invert to ivory
                    // there. Colour marks must never be inverted.
                    p.logoInvertsOnDark && "dark:invert",
                  )}
                />
              ) : (
                name
              )}
            </button>
          );
        })}
      </div>
    );
  }

  if (section === "feature") {
    // "Any" first, and always present: a pre-launch brand with no catalogue
    // still needs a way to say "no feature", not an empty row.
    return (
      <Pills
        items={[
          {
            id: ANY_FEATURE,
            label: t.mediaAny,
            on: feature === ANY_FEATURE,
            pick: () => onFeature(ANY_FEATURE),
          },
          ...features.map((f) => ({
            id: f.id,
            label: isRTL ? f.ar : f.en,
            on: feature === f.id,
            pick: () => onFeature(f.id),
          })),
        ]}
      />
    );
  }

  if (section === "channels") {
    if (wired.length === 0) {
      return (
        <p className="text-muted-foreground/60 text-xs">
          {t.spotlightConfigNoChannels}
        </p>
      );
    }
    // The same outlined tiles the brands get: a channel is picked by its mark
    // too, and two rows of the same question should not answer it in two
    // different shapes. Multi-select, so several can hold at once.
    return (
      <div className="flex flex-wrap gap-2">
        {wired.map((id) => {
          const channel = CHANNELS.find((entry) => entry.id === id);
          const label = channel ? (isRTL ? channel.labelAr : channel.label) : id;
          const Icon = CHANNEL_ICON[id];
          const on = selected.includes(id);
          const toggle = () =>
            onChannels(
              on ? selected.filter((x) => x !== id) : [...selected, id],
            );
          if (!Icon) {
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onMouseDown={(e) => e.preventDefault()}
                onClick={toggle}
                className={pill(on)}
              >
                {label}
              </button>
            );
          }
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              aria-label={label}
              title={label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggle}
              className={cn(
                "flex size-20 shrink-0 cursor-pointer items-center justify-center",
                "rounded-2xl border transition-colors duration-150",
                on
                  ? "border-foreground/40 bg-accent text-foreground"
                  : "border-input text-muted-foreground hover:border-foreground/30 hover:bg-accent/40 hover:text-foreground",
              )}
            >
              <Icon size={32} stroke={1.5} />
            </button>
          );
        })}
      </div>
    );
  }

  if (section === "postType") {
    // A Page's profile picture is its logo, so the preview wears the brand
    // that is actually selected — the card is this brand's post, not a
    // stock one.
    const brandMark = SOCIAL_PRODUCTS.find((p) => p.id === product);
    // Cards, not pills: a shape is easier to recognise drawn than named, and
    // "Text + images" versus "Carousel" is a distinction a word makes badly.
    return (
      <>
        {/* One row that scrolls, rather than a grid that reflows. Nine
            shapes read as a strip of posts to flick through; wrapped into
            rows they read as a form.

            Swipeable in both senses: a trackpad or a finger flicks it and the
            cards land on their own edges, and a mouse can drag the strip
            directly — see useDragScroll, which exists because a desktop
            pointer has nothing to flick with. No bar underneath, since the
            cards running off the edge already say there is more. */}
        <div
          ref={shapeRow}
          className={cn(
            "no-scrollbar -mx-1 flex gap-2 px-1 py-3",
            "overflow-x-auto overscroll-x-contain",
            // Snap is suspended mid-drag. Mandatory snapping corrects every
            // scrollLeft the pointer handler sets, back to the nearest card,
            // so the strip refused to move at all — measured, 4px before and
            // after an eight-step drag. Off while dragging, back on at
            // release, which is also when it lands the strip on a card.
            dragging ? "cursor-grabbing snap-none" : "cursor-grab snap-x snap-mandatory",
          )}
        >
          {POST_TYPES.map((type) => {
            const meta = POST_TYPE_META[type];
            const on = postType === type;
            return (
              <button
                key={type}
                type="button"
                aria-pressed={on}
                aria-label={t[POST_TYPE_LABEL[type]]}
                title={t[POST_TYPE_LABEL[type]]}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPostType(type)}
                // No tile around the post. A card inside a card, with a
                // caption under it, was three frames to say one thing — the
                // post IS the choice, so it is the button. Selection rides on
                // the post's own edge.
                className={cn(
                  "w-40 shrink-0 snap-start rounded-lg transition-all duration-150",
                  dragging ? "pointer-events-none" : "cursor-pointer",
                  // Lift, not an outline. A grey ring around a card that is
                  // already a card read as a second border; a shadow says
                  // "this one" without drawing another edge.
                  on
                    ? "shadow-lg"
                    : "opacity-80 hover:opacity-100 hover:shadow-md",
                )}
              >
                <PostShape
                  meta={meta}
                  // The Page's own picture where one has been read, the mark
                  // otherwise — and a real avatar is never inverted, because
                  // it is colour artwork on its own ground.
                  avatar={brandMark?.avatar ?? brandMark?.logo}
                  invertAvatar={
                    !brandMark?.avatar && brandMark?.logoInvertsOnDark
                  }
                  pageName={brandMark?.pageName ?? brandMark?.label}
                  when={
                    destination === "review"
                      ? t.previewWhenReview
                      : destination === "schedule"
                        ? t.previewWhenLater
                        : t.previewWhenNow
                  }
                />
              </button>
            );
          })}
        </div>
        <p className="text-muted-foreground/60 pt-2 text-[11px]">
          {t.postTypeHint}
        </p>
      </>
    );
  }

  if (section === "media") {
    const name: Record<MediaFilter, string> = {
      any: t.mediaAny,
      image: t.mediaImage,
      video: t.mediaVideo,
    };
    return (
      <>
        <Pills
          items={MEDIA_FILTERS.map((value) => ({
            id: value,
            label: name[value],
            on: mediaFilter === value,
            pick: () => onMediaFilter(value),
          }))}
        />
        <p className="text-muted-foreground/60 pt-2 text-[11px]">
          {t.mediaFilterHint}
        </p>
      </>
    );
  }

  if (section === "queue") {
    if (drafts.length === 0) {
      return (
        <p className="text-muted-foreground/60 text-xs">
          {t.spotlightConfigQueueEmpty}
        </p>
      );
    }
    // Oldest first, and pressing one puts it in the field above. The queue was
    // reachable only by leaving this face for another; it is a word now.
    return (
      <div className="space-y-1">
        {drafts.map((draft) => (
          <button
            key={draft.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onUseDraft(draft.id)}
            className="hover:bg-muted flex w-full cursor-pointer items-start gap-3 rounded-lg p-2 text-start transition-colors duration-150"
          >
            <span
              dir="auto"
              className="line-clamp-2 min-w-0 flex-1 text-xs leading-relaxed"
            >
              {draft.text}
            </span>
            <span className="text-muted-foreground/60 shrink-0 text-[10px]">
              {ago(draft.when)}
            </span>
          </button>
        ))}
      </div>
    );
  }

  const name: Record<Destination, string> = {
    direct: t.destinationDirect,
    schedule: t.destinationSchedule,
    review: t.destinationReview,
  };
  const hint: Record<Destination, string> = {
    direct: t.destinationDirectHint,
    schedule: t.destinationScheduleHint,
    review: t.destinationReviewHint,
  };
  return (
    <div className="space-y-1">
      {DESTINATIONS.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={destination === option}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onDestination(option)}
          className={cn(
            "flex w-full cursor-pointer flex-col rounded-lg p-2 text-start transition-colors duration-150",
            destination === option ? "bg-accent" : "hover:bg-muted",
          )}
        >
          <span className="text-sm font-medium">{name[option]}</span>
          <span className="text-muted-foreground text-xs">{hint[option]}</span>
        </button>
      ))}
    </div>
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
