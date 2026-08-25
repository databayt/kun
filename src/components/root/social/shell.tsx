"use client";

// The bar under the page header — the pipeline as pathname tabs at the start,
// its context at the end. The old dashboard hand-rolled an ARIA tablist over
// useState; stages are real routes now, so the house TabsNav atom (link tabs)
// carries the semantics and the URL carries the state.

import { TabsNav, type TabItem } from "@/components/atom/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChannelPicker } from "@/components/root/social/channel-picker";
import { StatusDialog } from "@/components/root/social/status";
import {
  PICKABLE_PRODUCTS,
  type ProductId,
} from "@/components/root/social/products";
import {
  STAGES,
  useSocial,
  type Stage,
} from "@/components/root/social/provider";
import type { SocialDict } from "@/components/root/social/dictionary";

const STAGE_LABEL_KEY = {
  calendar: "tabCalendar",
  draft: "tabDraft",
  media: "tabMedia",
  publish: "tabPublish",
  measure: "tabMeasure",
} as const satisfies Record<Stage, keyof SocialDict>;

export function SocialShell() {
  const {
    lang,
    isRTL,
    t,
    product,
    setProduct,
    selectedChannels,
    setSelectedChannels,
    wiredForProduct,
    status,
    checking,
    checkConnections,
  } = useSocial();

  const tabs: TabItem[] = STAGES.map((stage) => ({
    name: t[STAGE_LABEL_KEY[stage]],
    href: `/${lang}/social/${stage}`,
  }));

  return (
    <div className="flex flex-wrap items-center justify-start gap-3 border-b-[0.5px] py-3">
      <TabsNav tabs={tabs} aria-label={t.tabsLabel} />

      {/* The stage's context, travelling to the end as one group so the brand
          select lands last. `ms-auto` on the group, not the first child —
          ChannelPicker takes no className, and one wrapper beats a prop added
          for alignment. */}
      <div className="ms-auto flex flex-wrap items-center gap-3">
        <ChannelPicker
          product={product}
          selected={selectedChannels}
          wiredForProduct={wiredForProduct}
          onChange={setSelectedChannels}
          isRTL={isRTL}
          t={t}
        />

        <StatusDialog
          status={status}
          checking={checking}
          onRefresh={checkConnections}
          t={t}
        />

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
          {/* Aligned to the trigger's far edge — it sits at the end of the
              row, so the menu opens against the same edge. */}
          <SelectContent align={isRTL ? "start" : "end"}>
            {PICKABLE_PRODUCTS.map((p) => (
              <SelectItem
                key={p.id}
                value={p.id}
                className="data-[state=checked]:opacity-50"
              >
                {isRTL ? p.labelAr : p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
