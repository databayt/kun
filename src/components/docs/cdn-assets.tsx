// A live sample of the anthropic vendor mirror — the largest catalogued
// collection on the CDN (~715 assets). Reuses the real catalog (`data.ts`) and its
// `CDN_BASE`, so it renders identically to the /anthropic showcase. Tiles render
// the real (current) object; captions show the FLAT target key (anthropic/<file>),
// since the category subfolders collapse during the migration.
import {
  assets,
  CDN_BASE,
  CATEGORY_COLORS,
  ILLUSTRATION_COLORS,
  type Asset,
} from "@/components/root/anthropic/data";

const DARK_BGS = new Set(["#141413", "#0f0f0e", "#1a1918"]);
const IMAGE = new Set(["svg", "png", "jpg", "webp", "ico"]);

// Curated, image-only spread across categories — kept small for a doc.
const SAMPLE_PLAN: Array<[Asset["category"], number]> = [
  ["brand", 4],
  ["illustrations", 6],
  ["partners", 4],
  ["benchmarks", 2],
];

const SAMPLE: Asset[] = SAMPLE_PLAN.flatMap(([category, n]) =>
  assets
    .filter((a) => a.category === category && IMAGE.has(a.format))
    .slice(0, n),
);

/** anthropic/brand/anthropic-wordmark.svg → anthropic/wordmark.svg (flat + clean) */
function flatKey(key: string): string {
  const file = (key.split("/").pop() ?? key).replace(/^anthropic-/, "");
  return `anthropic/${file}`;
}

function bgFor(asset: Asset, index: number): string {
  if (asset.category === "illustrations") {
    return ILLUSTRATION_COLORS[index % ILLUSTRATION_COLORS.length];
  }
  return CATEGORY_COLORS[asset.category] ?? "#f5f4ed";
}

export function CdnAssets({ className }: { className?: string }) {
  return (
    <div className={`my-6 space-y-4 ${className ?? ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <code className="bg-transparent px-0 text-sm font-semibold">
          anthropic/
        </code>
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          vendor mirror · flat
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {SAMPLE.map((asset, i) => {
          const bg = bgFor(asset, i);
          const dark = DARK_BGS.has(bg);
          const flat = flatKey(asset.key);
          return (
            <a
              key={asset.key}
              href={asset.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`${asset.name} — /${flat}`}
              className="group block"
            >
              <div
                className="flex aspect-square w-full items-center justify-center overflow-hidden p-5 transition-opacity group-hover:opacity-90"
                style={{ backgroundColor: bg }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.url}
                  alt={asset.name}
                  loading="lazy"
                  className={`max-h-full max-w-full object-contain ${dark ? "brightness-0 invert" : ""}`}
                />
              </div>
              <p className="mt-1.5 truncate font-mono text-[11px] text-muted-foreground">
                /{flat}
              </p>
            </a>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        Rendered from the real catalog (
        <code className="bg-transparent px-0">data.ts</code>,{" "}
        <code className="bg-transparent px-0">
          {CDN_BASE.replace("https://", "")}
        </code>
        ) — the same source as the{" "}
        <code className="bg-transparent px-0">/anthropic</code> showcase.
        Captions show the flat target key (
        <code className="bg-transparent px-0">anthropic/&lt;file&gt;</code>);
        the category subfolders collapse during the migration.
      </p>
    </div>
  );
}
