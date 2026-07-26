"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NodeKind } from "./types";

/**
 * The graph settings card, structured exactly like Obsidian's graph panel:
 * Filters (search, depth, orphans) → Groups (color rules) → Display (text
 * fade, node size, link thickness) → Forces (center, repel, link, distance).
 * Dumb and fully controlled — the canvas owns every value.
 */

export interface GraphSettings {
  query: string;
  /** Local-graph depth: how many hops a selection reveals. */
  hops: number;
  showOrphans: boolean;
  /** 0..1 — higher shows labels sooner (Obsidian's "text fade threshold"). */
  textFade: number;
  /** Render multiplier for node radii. */
  nodeScale: number;
  /** Render multiplier for edge width. */
  linkWidth: number;
  /** 0..1 sliders, mapped onto simulation constants by the canvas. */
  centerForce: number;
  repelForce: number;
  linkForce: number;
  linkDistance: number;
}

export const DEFAULT_SETTINGS: GraphSettings = {
  query: "",
  hops: 1,
  showOrphans: true,
  textFade: 0.45,
  nodeScale: 1,
  linkWidth: 1,
  centerForce: 0.3,
  repelForce: 0.36,
  linkForce: 0.5,
  linkDistance: 0.33,
};

const KIND_COLOR_VAR: Record<NodeKind, string> = {
  school: "var(--graph-1)",
  spell: "var(--graph-2)",
  agent: "var(--graph-3)",
  portal: "var(--graph-4)",
  workflow: "var(--graph-5)",
  // Ungrouped base layer — Obsidian renders plain notes in the theme's muted
  // gray; only "groups" get categorical color.
  note: "var(--muted-foreground)",
};

export const kindColor = (kind: NodeKind): string => KIND_COLOR_VAR[kind];

const copy = {
  settings: { en: "Graph settings", ar: "إعدادات الخريطة" },
  filters: { en: "Filters", ar: "المرشحات" },
  search: { en: "Search the brain…", ar: "ابحث في الدماغ…" },
  depth: { en: "Depth", ar: "العمق" },
  orphans: { en: "Orphans", ar: "المعزولة" },
  groups: { en: "Groups", ar: "المجموعات" },
  display: { en: "Display", ar: "العرض" },
  textFade: { en: "Text fade threshold", ar: "عتبة ظهور النص" },
  nodeSize: { en: "Node size", ar: "حجم العقد" },
  linkWidth: { en: "Link thickness", ar: "سمك الروابط" },
  forces: { en: "Forces", ar: "القوى" },
  centerForce: { en: "Center force", ar: "قوة التمركز" },
  repelForce: { en: "Repel force", ar: "قوة التنافر" },
  linkForce: { en: "Link force", ar: "قوة الروابط" },
  linkDistance: { en: "Link distance", ar: "مسافة الروابط" },
  close: { en: "Close settings", ar: "إغلاق الإعدادات" },
};

const KIND_LABELS: Record<NodeKind, { en: string; ar: string }> = {
  school: { en: "Schools", ar: "المدارس" },
  spell: { en: "Spells", ar: "التعويذات" },
  agent: { en: "Agents", ar: "الوكلاء" },
  portal: { en: "MCP", ar: "المنافذ" },
  workflow: { en: "Workflows", ar: "المسارات" },
  note: { en: "Notes", ar: "الملاحظات" },
};

export const KIND_ORDER: NodeKind[] = [
  "school",
  "spell",
  "agent",
  "portal",
  "workflow",
  "note",
];

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ title, defaultOpen, children }: SectionProps) {
  return (
    <details open={defaultOpen} className="group border-t border-border/60">
      <summary className="flex cursor-pointer select-none items-center justify-between px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
        {title}
        <span
          aria-hidden
          className="text-[9px] transition-transform group-open:rotate-90 rtl:-scale-x-100"
        >
          ▸
        </span>
      </summary>
      <div className="flex flex-col gap-2.5 px-3 pb-3">{children}</div>
    </details>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}

function Slider({
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
}: SliderProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[11px] text-muted-foreground">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer accent-foreground"
      />
    </label>
  );
}

interface ToggleRowProps {
  label: string;
  on: boolean;
  onToggle: () => void;
  swatch?: string;
  count?: number;
}

function ToggleRow({ label, on, onToggle, swatch, count }: ToggleRowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-start font-mono text-[11px] transition-colors hover:bg-muted/60",
        on ? "text-foreground" : "text-muted-foreground/50",
      )}
    >
      {swatch && (
        <span
          aria-hidden
          className={cn("size-2.5 shrink-0 rounded-full", !on && "opacity-25")}
          style={{ backgroundColor: swatch }}
        />
      )}
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="tabular-nums text-muted-foreground">{count}</span>
      )}
      <span
        aria-hidden
        className={cn(
          "relative h-3 w-5 rounded-full transition-colors",
          on ? "bg-foreground" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-2 rounded-full bg-background transition-all",
            on ? "end-0.5" : "start-0.5",
          )}
        />
      </span>
    </button>
  );
}

interface GraphControlsProps {
  lang: string;
  settings: GraphSettings;
  onChange: (patch: Partial<GraphSettings>) => void;
  kinds: Set<NodeKind>;
  onToggleKind: (kind: NodeKind) => void;
  counts: Record<NodeKind, number>;
  onClose: () => void;
}

export function GraphControls({
  lang,
  settings,
  onChange,
  kinds,
  onToggleKind,
  counts,
  onClose,
}: GraphControlsProps) {
  const isAr = lang === "ar";
  const t = (key: keyof typeof copy) => (isAr ? copy[key].ar : copy[key].en);

  return (
    <aside className="flex max-h-full w-60 flex-col overflow-y-auto rounded-xl border border-border bg-background/95 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-mono text-[11px] font-semibold">
          {t("settings")}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <Section title={t("filters")} defaultOpen>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute start-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={settings.query}
            onChange={(e) => onChange({ query: e.target.value })}
            placeholder={t("search")}
            aria-label={t("search")}
            className="w-full rounded-md border border-border bg-muted/40 py-1 pe-2 ps-7 font-mono text-[11px] outline-none transition-colors focus-visible:border-foreground/40"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] text-muted-foreground">
            {t("depth")}
          </span>
          <div
            className="flex items-center gap-0.5 rounded-full bg-muted/60 p-0.5"
            role="group"
            aria-label={t("depth")}
          >
            {[1, 2, 3].map((depth) => (
              <button
                key={depth}
                type="button"
                onClick={() => onChange({ hops: depth })}
                aria-pressed={settings.hops === depth}
                className={cn(
                  "cursor-pointer rounded-full px-2 py-0.5 font-mono text-[10px] transition-colors",
                  settings.hops === depth
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {depth}
              </button>
            ))}
          </div>
        </div>

        <ToggleRow
          label={t("orphans")}
          on={settings.showOrphans}
          onToggle={() => onChange({ showOrphans: !settings.showOrphans })}
        />
      </Section>

      <Section title={t("groups")} defaultOpen>
        {KIND_ORDER.map((kind) => (
          <ToggleRow
            key={kind}
            label={isAr ? KIND_LABELS[kind].ar : KIND_LABELS[kind].en}
            on={kinds.has(kind)}
            onToggle={() => onToggleKind(kind)}
            swatch={KIND_COLOR_VAR[kind]}
            count={counts[kind]}
          />
        ))}
      </Section>

      <Section title={t("display")}>
        <Slider
          label={t("textFade")}
          value={settings.textFade}
          onChange={(textFade) => onChange({ textFade })}
        />
        <Slider
          label={t("nodeSize")}
          value={settings.nodeScale}
          min={0.6}
          max={1.8}
          onChange={(nodeScale) => onChange({ nodeScale })}
        />
        <Slider
          label={t("linkWidth")}
          value={settings.linkWidth}
          min={0.5}
          max={2.5}
          onChange={(linkWidth) => onChange({ linkWidth })}
        />
      </Section>

      <Section title={t("forces")}>
        <Slider
          label={t("centerForce")}
          value={settings.centerForce}
          onChange={(centerForce) => onChange({ centerForce })}
        />
        <Slider
          label={t("repelForce")}
          value={settings.repelForce}
          onChange={(repelForce) => onChange({ repelForce })}
        />
        <Slider
          label={t("linkForce")}
          value={settings.linkForce}
          onChange={(linkForce) => onChange({ linkForce })}
        />
        <Slider
          label={t("linkDistance")}
          value={settings.linkDistance}
          onChange={(linkDistance) => onChange({ linkDistance })}
        />
      </Section>
    </aside>
  );
}

export { KIND_LABELS };
