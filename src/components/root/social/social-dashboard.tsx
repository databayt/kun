"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isRTL, type Locale } from "@/components/local/config";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { verifyConnections } from "@/actions/post-social";
import {
  CHANNELS,
  DISTRIBUTION_CHANNELS,
  type ChannelId,
} from "@/components/root/social/config";
import {
  PRODUCTS,
  DEFAULT_PRODUCT,
  productChannelWired,
  type ProductId,
} from "@/components/root/social/products";
import {
  getSocialDict,
  type SocialDict,
} from "@/components/root/social/dictionary";
import { ChannelPicker } from "@/components/root/social/channel-picker";
import { Composer } from "@/components/root/social/composer";
import { DraftAgent } from "@/components/root/social/draft-agent";
import { StageNote } from "@/components/root/social/stage-note";
import { StatusDialog } from "@/components/root/social/status";
import type { EgressStatus } from "@/lib/social-status";

/**
 * The Hub's tabs are the documented pipeline (docs/social), in its order. Seven
 * stages, five tabs: Approve · Schedule · Publish are one composer with three
 * buttons, so splitting them would be three tabs over one form.
 */
const STAGES = ["calendar", "draft", "media", "publish", "measure"] as const;

type Stage = (typeof STAGES)[number];

const STAGE_LABEL_KEY = {
  calendar: "tabCalendar",
  draft: "tabDraft",
  media: "tabMedia",
  publish: "tabPublish",
  measure: "tabMeasure",
} as const satisfies Record<Stage, keyof SocialDict>;

interface SocialDashboardProps {
  lang: Locale;
  /**
   * The activity ledger, behind the Measure tab. A Server Component passed as a
   * prop rather than rendered in page.tsx, because a tab panel has to sit inside
   * the component that owns the tab state. Passing it keeps the DB read on the
   * server — its markup is serialized in, never bundled.
   */
  ledger: React.ReactNode;
}

/**
 * The interactive shell. Holds what every child reads — which brand we publish
 * as, which channels are selected, and which pipeline stage is open — and
 * nothing else; the composer, the picker, and the status panel own their own
 * concerns. The page header above it is static, so it stays a Server Component
 * in page.tsx.
 */
export default function SocialDashboard({
  lang,
  ledger,
}: SocialDashboardProps) {
  const t = getSocialDict(lang);
  const isRightToLeft = isRTL(lang);

  // Which brand we're publishing as. Every channel toggle, health check, and
  // publish call below is scoped to it — Facebook resolves a different Page and
  // a different permanent token per product.
  const [product, setProduct] = useState<ProductId>(DEFAULT_PRODUCT);
  const [selectedChannels, setSelectedChannels] = useState<ChannelId[]>([]);
  const [status, setStatus] = useState<EgressStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [stage, setStage] = useState<Stage>("draft");
  // A draft the agent window hands to the composer. The nonce makes re-using
  // the same text a fresh injection rather than a no-op.
  const [prefill, setPrefill] = useState<{
    text: string;
    nonce: number;
  } | null>(null);

  // Taking a draft is a stage transition: the composer lives behind Publish, so
  // handing it copy without switching would drop the text into a hidden panel.
  // The scroll waits for the panel to be shown — on the click it is still
  // `hidden`, and scrollIntoView on a display:none element does nothing.
  const useDraft = useCallback((text: string) => {
    setPrefill({ text, nonce: Date.now() });
    setStage("publish");
  }, []);

  useEffect(() => {
    if (stage !== "publish" || !prefill) return;
    const id = requestAnimationFrame(() => {
      document
        .getElementById("composer")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(id);
  }, [stage, prefill]);

  // Arrow keys move along the tablist, which is what makes it one — a row of
  // buttons that only responds to clicks is a row of buttons. Left and right are
  // swapped under RTL so "next" always means the direction the eye travels.
  const onTablistKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const forward = isRightToLeft ? "ArrowLeft" : "ArrowRight";
    const back = isRightToLeft ? "ArrowRight" : "ArrowLeft";
    const step =
      event.key === forward
        ? 1
        : event.key === back
          ? -1
          : event.key === "Home"
            ? -STAGES.length
            : event.key === "End"
              ? STAGES.length
              : 0;
    if (step === 0) return;
    event.preventDefault();
    const at = STAGES.indexOf(stage);
    const next = Math.min(STAGES.length - 1, Math.max(0, at + step));
    setStage(STAGES[next]);
    document.getElementById(`stage-tab-${STAGES[next]}`)?.focus();
  };

  // Publishable for THIS brand: the global transport is wired AND the brand has
  // its own destination on it (its own Page, its own channel). Distribution
  // only — a communication channel is never an audience destination.
  const wiredForProduct = useMemo(
    () =>
      DISTRIBUTION_CHANNELS.filter((ch) =>
        productChannelWired(product, ch.id, ch.wired),
      ).map((ch) => ch.id as ChannelId),
    [product],
  );

  // Switching brand must never carry a selection the new brand can't publish to.
  useEffect(() => {
    setSelectedChannels((prev) => {
      const kept = prev.filter((id) => wiredForProduct.includes(id));
      return kept.length > 0 ? kept : wiredForProduct.slice(0, 1);
    });
  }, [wiredForProduct]);

  // One action, one round trip. The three probes still run in parallel — they
  // just do it server-side now instead of as three separate POSTs from here.
  const checkConnections = useCallback(async () => {
    setChecking(true);
    try {
      setStatus(await verifyConnections(product));
    } catch (err: unknown) {
      const failed = {
        connected: false,
        error: err instanceof Error ? err.message : String(err),
      };
      setStatus({ hermes: failed, telegram: failed, facebook: failed });
    } finally {
      setChecking(false);
    }
  }, [product]);

  useEffect(() => {
    checkConnections();
  }, [checkConnections]);

  // Publish is gated per transport: only the relays the selection actually
  // needs must be connected.
  const transportsReady = useMemo(() => {
    if (!status) return false;
    const needs = (transport: string) =>
      selectedChannels.some(
        (id) => CHANNELS.find((c) => c.id === id)?.transport === transport,
      );
    return (
      (!needs("hermes") || status.hermes.connected) &&
      (!needs("telegram") || status.telegram.connected) &&
      (!needs("facebook") || status.facebook.connected)
    );
  }, [status, selectedChannels]);

  return (
    <>
      {/* Top bar — product, channels, and status side-by-side at start */}
      <div className="flex flex-wrap items-center justify-start gap-3 border-b-[0.5px] py-3">
        <label htmlFor="product-selector" className="sr-only">
          {t.product}
        </label>
        <Select
          value={product}
          onValueChange={(value) => setProduct(value as ProductId)}
        >
          <SelectTrigger
            id="product-selector"
            className="h-8 w-auto justify-start border-0 bg-transparent shadow-none dark:bg-transparent dark:hover:bg-transparent"
          >
            <SelectValue placeholder={t.selectProduct} />
          </SelectTrigger>
          <SelectContent align={isRightToLeft ? "end" : "start"}>
            {PRODUCTS.map((p) => (
              <SelectItem
                key={p.id}
                value={p.id}
                className="data-[state=checked]:opacity-50"
              >
                {isRightToLeft ? p.labelAr : p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ChannelPicker
          product={product}
          selected={selectedChannels}
          wiredForProduct={wiredForProduct}
          onChange={setSelectedChannels}
          isRTL={isRightToLeft}
          t={t}
        />

        <StatusDialog
          status={status}
          checking={checking}
          onRefresh={checkConnections}
          t={t}
        />

        {/* The pipeline, as tabs. The row above them is context that spans every
            stage — brand especially, since it selects the Page and the token. */}
        <div
          role="tablist"
          aria-label={t.tabsLabel}
          aria-orientation="horizontal"
          onKeyDown={onTablistKeyDown}
          className="ms-auto flex items-center gap-1"
        >
          {STAGES.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              id={`stage-tab-${s}`}
              aria-selected={stage === s}
              aria-controls={`stage-panel-${s}`}
              tabIndex={stage === s ? 0 : -1}
              onClick={() => setStage(s)}
              data-active={stage === s}
              className="hover:text-primary data-[active=true]:bg-muted data-[active=true]:text-primary flex h-7 items-center justify-center rounded-full px-4 text-center text-sm transition-colors"
            >
              {t[STAGE_LABEL_KEY[s]]}
            </button>
          ))}
        </div>
      </div>

      {/* Every panel stays mounted and is hidden rather than unmounted. The
          agent polls a queue for minutes at a time and the composer holds typed
          copy: unmounting on a tab switch would throw both away, which is the
          bug a contributor would hit first. */}
      <Panel stage="calendar" active={stage}>
        <StageNote
          title={t.calendarNoteTitle}
          body={t.calendarNoteBody}
          keyword={`content calendar for ${product}`}
          docsHref={`/${lang}/docs/social/strategy`}
          t={t}
        />
      </Panel>

      <Panel stage="draft" active={stage}>
        <DraftAgent
          product={product}
          onUse={useDraft}
          onSeePublished={() => setStage("measure")}
          isRTL={isRightToLeft}
          t={t}
        />
      </Panel>

      <Panel stage="media" active={stage}>
        <StageNote
          title={t.mediaNoteTitle}
          body={t.mediaNoteBody}
          keyword={`higgs an image for ${product}`}
          docsHref={`/${lang}/docs/social/carousel`}
          t={t}
        />
      </Panel>

      {/* Approve, Schedule and Publish are one composer with three buttons, so
          they are one stage here rather than three tabs over the same form. */}
      <Panel stage="publish" active={stage}>
        <div className="space-y-8 py-8">
          <Composer
            product={product}
            selectedChannels={selectedChannels}
            wiredForProduct={wiredForProduct}
            transportsReady={transportsReady}
            isRTL={isRightToLeft}
            t={t}
            prefill={prefill}
          />
        </div>
      </Panel>

      <Panel stage="measure" active={stage}>
        {ledger}
      </Panel>
    </>
  );
}

/**
 * One stage's panel. `hidden` rather than a conditional render, so an inactive
 * panel keeps its state: the agent's poll survives a tab switch and the composer
 * keeps its typed copy. `display: none` still runs effects and intervals, which
 * is exactly what the poll needs.
 */
function Panel({
  stage,
  active,
  children,
}: {
  stage: Stage;
  active: Stage;
  children: React.ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`stage-panel-${stage}`}
      aria-labelledby={`stage-tab-${stage}`}
      hidden={stage !== active}
    >
      {children}
    </div>
  );
}
