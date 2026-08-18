"use client";

// One showroom tile — the /anthropic asset-card pattern (motion tile → Dialog
// with badges and Copy/Open/Save) over the normalized ShowroomAsset shape.
// Plain <img loading="lazy"> on purpose: the S3/CDN hosts aren't in
// next.config remotePatterns, and the anthropic showcase set the precedent.

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, Download, ExternalLink, Paperclip, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ILLUSTRATION_COLORS } from "@/components/root/anthropic/data";
import { useSocial } from "@/components/root/social/provider";
import { typeLabel } from "./taxonomy";
import type { ShowroomAsset } from "./data";

export function ShowroomCard({
  asset,
  index,
}: {
  asset: ShowroomAsset;
  index: number;
}) {
  const { isRTL, t, attachMedia, goToStage } = useSocial();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Sticky, unlike the copy check: once something is in the tray, the way to
  // the Publish stage should stay visible.
  const [attached, setAttached] = useState(false);

  // References without a checked-in thumb render as a typed plate — the note
  // and source link are the value; a hotlinked competitor image would rot.
  const bg = ILLUSTRATION_COLORS[index % ILLUSTRATION_COLORS.length];

  const copyUrl = async () => {
    await navigator.clipboard.writeText(asset.imageUrl ?? asset.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Bridge reference or asset into Media Studio
  const useInStudio = () => {
    setOpen(false);
    window.dispatchEvent(
      new CustomEvent("media-studio:load-reference", {
        detail: {
          title: asset.title,
          note: asset.note,
          type: asset.type,
          brand: asset.brand,
        },
      }),
    );
    const el = document.getElementById("media-studio-root");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Only generated assets carry a renderable media URL a platform could
  // fetch; a reference's href is its source page, not media.
  const attach = () => {
    if (!asset.imageUrl) return;
    attachMedia(asset.imageUrl);
    setAttached(true);
  };

  const kindLabel =
    asset.kind === "generated" ? t.collectionGenerated : t.collectionReference;

  return (
    <>
      <motion.button
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.02, duration: 0.35, ease: "easeOut" }}
        onClick={() => setOpen(true)}
        className="group flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden p-4"
        style={{ backgroundColor: asset.imageUrl ? undefined : bg }}
      >
        {asset.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.imageUrl}
            alt={asset.title}
            className="max-h-full max-w-full object-contain"
            loading="lazy"
          />
        ) : (
          <>
            <span className="text-foreground/80 px-2 text-center text-sm font-medium">
              {asset.title}
            </span>
            <span className="text-muted-foreground font-mono text-[10px] tracking-wider uppercase">
              {typeLabel(asset.type, isRTL)}
            </span>
          </>
        )}
      </motion.button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg gap-0 overflow-hidden rounded-none p-0">
          <div
            className="flex min-h-[200px] items-center justify-center p-8"
            style={{ backgroundColor: asset.imageUrl ? undefined : bg }}
          >
            {asset.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={asset.imageUrl}
                alt={asset.title}
                className="max-h-[240px] max-w-full object-contain"
              />
            ) : (
              <span className="text-foreground/70 px-4 text-center text-lg font-medium">
                {asset.title}
              </span>
            )}
          </div>

          <div className="space-y-4 p-5 text-start">
            <DialogHeader>
              <DialogTitle>{asset.title}</DialogTitle>
              {asset.note && (
                <DialogDescription className="text-start leading-relaxed">
                  {asset.note}
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="flex flex-wrap gap-2">
              <Badge>{kindLabel}</Badge>
              <Badge>{typeLabel(asset.type, isRTL)}</Badge>
              {asset.brand && <Badge>{asset.brand}</Badge>}
              <Badge>{asset.source}</Badge>
              {asset.model && <Badge>{asset.model}</Badge>}
              {asset.ratio && <Badge>{asset.ratio}</Badge>}
              {asset.credits != null && (
                <Badge>
                  {asset.credits} {t.assetCredits}
                </Badge>
              )}
              {asset.createdAt && <Badge>{asset.createdAt}</Badge>}
            </div>

            {/* Primary Action: Use as reference in Media Studio */}
            <button
              onClick={useInStudio}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors cursor-pointer shadow-xs"
            >
              <Sparkles className="size-4" />
              {t.mediaUseInStudio}
            </button>

            <div className="flex gap-2">
              {asset.imageUrl && (
                <button
                  onClick={attach}
                  className="hover:bg-muted flex flex-1 items-center justify-center gap-2 border px-3 py-2 text-sm transition-colors"
                >
                  {attached ? (
                    <>
                      <Check className="h-4 w-4 text-green-600" />{" "}
                      {t.attachedAsset}
                    </>
                  ) : (
                    <>
                      <Paperclip className="h-4 w-4" /> {t.attachAsset}
                    </>
                  )}
                </button>
              )}
              <button
                onClick={copyUrl}
                className={
                  asset.imageUrl
                    ? "hover:bg-muted flex items-center justify-center gap-2 border px-3 py-2 text-sm transition-colors"
                    : "hover:bg-muted flex flex-1 items-center justify-center gap-2 border px-3 py-2 text-sm transition-colors"
                }
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-green-600" /> {t.copiedUrl}
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> {t.copyUrl}
                  </>
                )}
              </button>
              <a
                href={asset.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:bg-muted flex items-center justify-center gap-2 border px-3 py-2 text-sm transition-colors"
              >
                <ExternalLink className="h-4 w-4" /> {t.openAsset}
              </a>
              {asset.imageUrl && (
                <a
                  href={asset.imageUrl}
                  download
                  className="hover:bg-muted flex items-center justify-center gap-2 border px-3 py-2 text-sm transition-colors"
                >
                  <Download className="h-4 w-4" /> {t.saveAsset}
                </a>
              )}
            </div>

            {/* The attach → review round-trip, closed: the tray now holds the
                asset, and the Publish stage is where it gets used. */}
            {attached && (
              <button
                onClick={() => {
                  setOpen(false);
                  goToStage("publish");
                }}
                className="text-foreground text-xs font-medium underline underline-offset-4"
              >
                {t.attachOpenPublish}
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-muted px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase">
      {children}
    </span>
  );
}
