"use client";

import { useState, useMemo } from "react";
import {
  assets,
  CATEGORY_LABELS,
  CDN_BASE,
  LAST_CRAWLED,
  BRAND_COLORS,
  URL_INDEX,
  type AssetCategory,
} from "./data";
import { AssetCard } from "./asset-card";

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as AssetCategory[];
const FORMAT_OPTIONS = ["all", "svg", "png", "jpg", "webp", "json", "pdf", "ico"] as const;

export default function AnthropicContent() {
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | "all">("all");
  const [selectedFormat, setSelectedFormat] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "urls">("grid");

  const filtered = useMemo(() => {
    return assets.filter((a) => {
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
  }, [selectedCategory, selectedFormat, search]);

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
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Anthropic Assets</h1>
        <p className="text-muted-foreground">
          {assets.length} assets crawled from {Object.values(URL_INDEX).flat().length} Anthropic URLs
          <span className="mx-2">|</span>
          Last crawled: {LAST_CRAWLED}
        </p>
      </div>

      {/* Brand Colors */}
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Brand Colors</h2>
        <div className="flex flex-wrap gap-3">
          {Object.entries(BRAND_COLORS).map(([name, hex]) => (
            <div key={name} className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded border"
                style={{ backgroundColor: hex }}
              />
              <div>
                <div className="text-xs font-medium">{name}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{hex}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6">
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(selectedCategory === cat ? "all" : cat)}
            className={`rounded-lg border p-3 text-start transition-colors ${
              selectedCategory === cat
                ? "border-foreground bg-foreground text-background"
                : "hover:bg-muted"
            }`}
          >
            <div className="text-2xl font-bold">{stats.byCategory[cat] || 0}</div>
            <div className="text-xs">{CATEGORY_LABELS[cat]}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search assets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
        />

        <select
          value={selectedFormat}
          onChange={(e) => setSelectedFormat(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="all">All formats</option>
          {FORMAT_OPTIONS.filter((f) => f !== "all").map((f) => (
            <option key={f} value={f}>
              {f.toUpperCase()} ({stats.byFormat[f] || 0})
            </option>
          ))}
        </select>

        <div className="flex gap-1 rounded-md border">
          <button
            onClick={() => setView("grid")}
            className={`px-3 py-1.5 text-sm ${view === "grid" ? "bg-muted" : ""}`}
          >
            Grid
          </button>
          <button
            onClick={() => setView("urls")}
            className={`px-3 py-1.5 text-sm ${view === "urls" ? "bg-muted" : ""}`}
          >
            URL Index
          </button>
        </div>

        <span className="text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "asset" : "assets"}
        </span>

        {(selectedCategory !== "all" || selectedFormat !== "all" || search) && (
          <button
            onClick={() => {
              setSelectedCategory("all");
              setSelectedFormat("all");
              setSearch("");
            }}
            className="text-sm text-muted-foreground underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Content */}
      {view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((asset) => (
            <AssetCard key={asset.url} asset={asset} />
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

      {/* CDN Reference */}
      <div className="mt-12 border-t pt-8">
        <h2 className="mb-4 text-lg font-semibold">CDN</h2>
        <div className="rounded-lg border p-4">
          <div className="text-sm font-medium">Databayt CloudFront</div>
          <div className="font-mono text-xs text-muted-foreground">{CDN_BASE}</div>
          <div className="text-xs text-muted-foreground">
            {assets.length} assets hosted on S3 + CloudFront
          </div>
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
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {section}
          </h3>
          <div className="space-y-1">
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
                  className="block rounded px-2 py-1 font-mono text-sm hover:bg-muted"
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
