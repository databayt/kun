"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  assets,
  COLORS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CDN_BASE,
  LAST_CRAWLED,
  URL_INDEX,
  type AssetCategory,
} from "./data";
import { ColorSwatch } from "./color-swatch";
import { AssetCard } from "./asset-card";

const FORMAT_OPTIONS = ["all", "svg", "png", "jpg", "webp", "json", "pdf", "ico"] as const;

export default function AnthropicContent() {
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | "all">("all");
  const [selectedFormat, setSelectedFormat] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "urls">("grid");

  const sorted = useMemo(() => {
    const order = CATEGORY_ORDER;
    return [...assets].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
  }, []);

  const filtered = useMemo(() => {
    return sorted.filter((a) => {
      if (selectedCategory !== "all" && a.category !== selectedCategory) return false;
      if (selectedFormat !== "all" && a.format !== selectedFormat) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q) ||
          a.cdn.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [sorted, selectedCategory, selectedFormat, search]);

  const stats = useMemo(() => {
    const byCategory: Record<string, number> = {};
    const byFormat: Record<string, number> = {};
    for (const a of assets) {
      byCategory[a.category] = (byCategory[a.category] || 0) + 1;
      byFormat[a.format] = (byFormat[a.format] || 0) + 1;
    }
    return { byCategory, byFormat };
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-16"
      >
        <h1 className="mb-2 text-4xl font-bold tracking-tight">Anthropic</h1>
        <p className="text-muted-foreground">
          {COLORS.length} colors &middot; {assets.length} assets &middot; {Object.values(URL_INDEX).flat().length} URLs
          <span className="mx-2">|</span>
          {LAST_CRAWLED}
        </p>
      </motion.div>

      {/* ── Colors — single flat grid ──────────────────────────────────── */}
      <section className="mb-20">
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-6 text-xs font-medium uppercase tracking-widest text-muted-foreground"
        >
          Colors
        </motion.h2>
        <div className="grid grid-cols-6 gap-0 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
          {COLORS.map((color, i) => (
            <ColorSwatch key={color.name} color={color} index={i} />
          ))}
        </div>
      </section>

      {/* ── Assets ─────────────────────────────────────────────────────── */}
      <section>
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8 text-2xl font-bold tracking-tight"
        >
          Assets
        </motion.h2>

        {/* Category pills */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedCategory === "all"
                ? "bg-[#141413] text-white"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            All {assets.length}
          </button>
          {CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? "all" : cat)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedCategory === cat
                  ? "bg-[#141413] text-white"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {CATEGORY_LABELS[cat]} {stats.byCategory[cat] || 0}
            </button>
          ))}
        </div>

        {/* Filters row */}
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-48 border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
          />
          <select
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value)}
            className="h-9 border bg-background px-3 text-sm"
          >
            <option value="all">All formats</option>
            {FORMAT_OPTIONS.filter((f) => f !== "all").map((f) => (
              <option key={f} value={f}>
                {f.toUpperCase()} ({stats.byFormat[f] || 0})
              </option>
            ))}
          </select>
          <div className="flex gap-0 border">
            <button
              onClick={() => setView("grid")}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                view === "grid" ? "bg-muted" : ""
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setView("urls")}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                view === "urls" ? "bg-muted" : ""
              }`}
            >
              URLs
            </button>
          </div>
          <span className="text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "asset" : "assets"}
          </span>
          {(selectedCategory !== "all" || selectedFormat !== "all" || search) && (
            <button
              onClick={() => {
                setSelectedCategory("all");
                setSelectedFormat("all");
                setSearch("");
              }}
              className="text-xs text-muted-foreground underline"
            >
              Clear
            </button>
          )}
        </div>

        {/* Grid / URL view */}
        {view === "grid" ? (
          <div className="grid grid-cols-2 gap-0 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map((asset, i) => (
              <AssetCard key={asset.url} asset={asset} index={i} />
            ))}
          </div>
        ) : (
          <UrlIndexView />
        )}

        {filtered.length === 0 && (
          <div className="py-20 text-center text-muted-foreground">
            No assets match your filters.
          </div>
        )}
      </section>

      {/* CDN */}
      <div className="mt-16 border-t pt-8">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 bg-green-500" />
          <span className="font-mono text-xs text-muted-foreground">{CDN_BASE}</span>
          <span className="text-xs text-muted-foreground">&middot; {assets.length} assets</span>
        </div>
      </div>
    </div>
  );
}

function UrlIndexView() {
  return (
    <div className="space-y-6">
      {Object.entries(URL_INDEX).map(([section, urls]) => (
        <div key={section}>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {section}
          </h3>
          <div className="space-y-0.5">
            {urls.map((url) => {
              const fullUrl = url.startsWith("http")
                ? url
                : `https://www.anthropic.com${url}`;
              return (
                <a
                  key={url}
                  href={fullUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-2 py-1 font-mono text-sm hover:bg-muted"
                >
                  {url}
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
