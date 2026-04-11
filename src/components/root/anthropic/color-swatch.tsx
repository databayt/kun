"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type ColorToken } from "./data";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={copy}
      className="flex w-full items-center justify-between border px-3 py-2 text-start font-mono text-sm transition-colors hover:bg-muted"
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        {value}
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </span>
    </button>
  );
}

export function ColorSwatch({ color, index }: { color: ColorToken; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.02, duration: 0.25 }}
        onClick={() => setOpen(true)}
        className="aspect-square w-full cursor-pointer"
        style={{ backgroundColor: color.hex }}
        title={color.name}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm gap-0 overflow-hidden rounded-none p-0">
          <div
            className="h-40 w-full"
            style={{ backgroundColor: color.hex }}
          />
          <div className="space-y-4 p-5">
            <DialogHeader>
              <DialogTitle>{color.name}</DialogTitle>
              <div className="flex gap-2">
                <span className="bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                  {color.role}
                </span>
                <span className="bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                  {color.group}
                </span>
              </div>
            </DialogHeader>
            <div className="space-y-2">
              <CopyButton label="HEX" value={color.hex} />
              <CopyButton label="OKLCH" value={color.oklch} />
              <CopyButton label="CSS" value={`var(--color-${color.name.toLowerCase().replace(/\s+/g, "-")})`} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
