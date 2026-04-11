"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, ExternalLink, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { type Asset, CATEGORY_COLORS, ILLUSTRATION_COLORS } from "./data";

const DARK_BGS = new Set(["#141413", "#0f0f0e", "#1a1918"]);

function getBg(asset: Asset, index: number): string {
  if (asset.category === "illustrations") {
    return ILLUSTRATION_COLORS[index % ILLUSTRATION_COLORS.length];
  }
  return CATEGORY_COLORS[asset.category];
}

export function AssetCard({ asset, index }: { asset: Asset; index: number }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const isImage = ["svg", "png", "jpg", "webp", "ico"].includes(asset.format);

  const bg = getBg(asset, index);
  const isDark = DARK_BGS.has(bg);

  const copyUrl = async () => {
    await navigator.clipboard.writeText(asset.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <motion.button
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.02, duration: 0.35, ease: "easeOut" }}
        onClick={() => setOpen(true)}
        className="group flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden p-6"
        style={{ backgroundColor: bg }}
      >
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.url}
            alt={asset.name}
            className={`max-h-full max-w-full object-contain ${
              isDark ? "brightness-0 invert" : ""
            }`}
            loading="lazy"
          />
        ) : (
          <span className={`font-mono text-xs font-medium uppercase tracking-wider ${
            isDark ? "text-white/60" : "text-muted-foreground"
          }`}>
            {asset.format}
          </span>
        )}
      </motion.button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden rounded-none p-0">
          <div
            className="flex min-h-[240px] items-center justify-center p-8"
            style={{ backgroundColor: bg }}
          >
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={asset.url}
                alt={asset.name}
                className="max-h-[200px] max-w-full object-contain"
              />
            ) : (
              <span className={`px-4 py-2 font-mono text-sm uppercase ${
                isDark ? "text-white/70" : "text-foreground/60"
              }`}>
                {asset.format}
              </span>
            )}
          </div>

          <div className="space-y-4 p-5">
            <DialogHeader>
              <DialogTitle>{asset.name}</DialogTitle>
              <DialogDescription>{asset.description}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-2">
              <span className="bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                {asset.category}
              </span>
              <span className="bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                {asset.format}
              </span>
              {asset.width && asset.height && (
                <span className="bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                  {asset.width}x{asset.height}
                </span>
              )}
              <span className="bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                {asset.source}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={copyUrl}
                className="flex flex-1 items-center justify-center gap-2 border px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                {copied ? (
                  <><Check className="h-4 w-4 text-green-600" /> Copied</>
                ) : (
                  <><Copy className="h-4 w-4" /> Copy URL</>
                )}
              </button>
              <a
                href={asset.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 border px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                <ExternalLink className="h-4 w-4" /> Open
              </a>
              {isImage && (
                <a
                  href={asset.url}
                  download
                  className="flex items-center justify-center gap-2 border px-3 py-2 text-sm transition-colors hover:bg-muted"
                >
                  <Download className="h-4 w-4" /> Save
                </a>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
