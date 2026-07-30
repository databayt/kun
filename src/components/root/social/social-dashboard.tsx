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
import { getSocialDict } from "@/components/root/social/dictionary";
import { ChannelPicker } from "@/components/root/social/channel-picker";
import { Composer } from "@/components/root/social/composer";
import { DraftAgent } from "@/components/root/social/draft-agent";
import { StatusDialog } from "@/components/root/social/status";
import type { EgressStatus } from "@/lib/social-status";

interface SocialDashboardProps {
  lang: Locale;
}

/**
 * The interactive shell. Holds the two pieces of state every child reads — which
 * brand we publish as, and which channels are selected — and nothing else; the
 * composer, the picker, and the status panel own their own concerns. The page
 * header above it is static, so it stays a Server Component in page.tsx.
 */
export default function SocialDashboard({ lang }: SocialDashboardProps) {
  const t = getSocialDict(lang);
  const isRightToLeft = isRTL(lang);

  // Which brand we're publishing as. Every channel toggle, health check, and
  // publish call below is scoped to it — Facebook resolves a different Page and
  // a different permanent token per product.
  const [product, setProduct] = useState<ProductId>(DEFAULT_PRODUCT);
  const [selectedChannels, setSelectedChannels] = useState<ChannelId[]>([]);
  const [status, setStatus] = useState<EgressStatus | null>(null);
  const [checking, setChecking] = useState(true);
  // A draft the agent window hands to the composer. The nonce makes re-using
  // the same text a fresh injection rather than a no-op.
  const [prefill, setPrefill] = useState<{
    text: string;
    nonce: number;
  } | null>(null);

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
      </div>

      {/* The agent window — the brain is Claude, reachable from the page itself.
          It sits under the header and the toolbar rather than opening the page,
          so /social still introduces itself before handing over the prompt. */}
      <DraftAgent
        product={product}
        onUse={(text) => setPrefill({ text, nonce: Date.now() })}
        isRTL={isRightToLeft}
        t={t}
      />

      {/* One column now — status moved into the toolbar dialog, so the composer
          no longer shares the row with a permanent sidebar. */}
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
    </>
  );
}
