"use client";

import { useState } from "react";
import { type Asset } from "./data";
import { Copy, Check, ExternalLink, Download } from "lucide-react";

export function AssetCard({ asset }: { asset: Asset }) {
  const [copied, setCopied] = useState(false);
  const isImage = ["svg", "png", "jpg", "webp", "ico"].includes(asset.format);
  const isSvg = asset.format === "svg";

  const copyUrl = async () => {
    await navigator.clipboard.writeText(asset.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-all hover:shadow-md">
      {/* Preview */}
      <div className="relative flex h-48 items-center justify-center overflow-hidden bg-muted/50 p-4">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.url}
            alt={asset.name}
            className="max-h-full max-w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <span className="rounded bg-muted px-3 py-1 font-mono text-sm uppercase">
              {asset.format}
            </span>
            <span className="text-xs">{asset.name}</span>
          </div>
        )}

        {/* Format badge */}
        <span className="absolute top-2 left-2 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[10px] uppercase backdrop-blur-sm">
          {asset.format}
        </span>

        {/* Dimensions */}
        {asset.width && asset.height && (
          <span className="absolute top-2 right-2 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[10px] backdrop-blur-sm">
            {asset.width}x{asset.height}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="text-sm font-medium leading-tight">{asset.name}</h3>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {asset.description}
        </p>
        <div className="mt-auto flex items-center gap-1.5 pt-2">
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
            {asset.category}
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
            {asset.source}
          </span>
        </div>
      </div>

      {/* Actions (visible on hover) */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={copyUrl}
          className="rounded bg-background/90 p-1.5 shadow-sm backdrop-blur-sm hover:bg-background"
          title="Copy URL"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
        <a
          href={asset.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded bg-background/90 p-1.5 shadow-sm backdrop-blur-sm hover:bg-background"
          title="Open in new tab"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        {(isSvg || isImage) && (
          <a
            href={asset.url}
            download
            className="rounded bg-background/90 p-1.5 shadow-sm backdrop-blur-sm hover:bg-background"
            title="Download"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
