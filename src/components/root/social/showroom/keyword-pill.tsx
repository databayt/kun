"use client";

// The StageNote keyword idiom, quoting the live brand — only the provider
// knows which one is selected, so this leaf is the client boundary.

import { useSocial } from "@/components/root/social/provider";

export function ShowroomKeyword() {
  const { t, product } = useSocial();
  return (
    <div className="text-center">
      <p className="text-muted-foreground/70 text-xs">{t.stageNoteKeyword}</p>
      <p className="bg-muted text-foreground mt-2 inline-block rounded-lg px-3 py-1.5 font-mono text-sm">
        higgs an image for {product}
      </p>
    </div>
  );
}
