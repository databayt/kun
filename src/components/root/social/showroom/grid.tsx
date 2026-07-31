"use client";

// The filterable showroom grid — the /anthropic content pattern (pill filters
// over a dense square grid) on three axes: collection, brand, type. State is
// local; the card list arrives serialized from the server component.

import { useMemo, useState } from "react";
import { useSocial } from "@/components/root/social/provider";
import { ASSET_TYPES, OTHER_TYPE, typeLabel } from "./taxonomy";
import { ShowroomCard } from "./asset-card";
import type { ShowroomAsset } from "./data";

type Collection = "all" | "generated" | "reference";

export function ShowroomGrid({ assets }: { assets: ShowroomAsset[] }) {
  const { isRTL, t } = useSocial();
  const [collection, setCollection] = useState<Collection>("all");
  const [brand, setBrand] = useState<string>("all");
  const [type, setType] = useState<string>("all");

  const brands = useMemo(
    () =>
      [
        ...new Set(assets.map((a) => a.brand).filter(Boolean)),
      ].sort() as string[],
    [assets],
  );

  // Only offer type pills that exist in the data — 13 canonical + other would
  // be a wall of dead filters at today's library size.
  const presentTypes = useMemo(() => {
    const present = new Set(assets.map((a) => a.type));
    return [...ASSET_TYPES, OTHER_TYPE].filter((tp) => present.has(tp));
  }, [assets]);

  const filtered = useMemo(
    () =>
      assets.filter((a) => {
        if (collection !== "all" && a.kind !== collection) return false;
        if (brand !== "all" && a.brand !== brand) return false;
        if (type !== "all" && a.type !== type) return false;
        return true;
      }),
    [assets, collection, brand, type],
  );

  const pill = (active: boolean) =>
    `px-3 py-1.5 text-xs font-medium transition-colors ${
      active
        ? "bg-primary text-primary-foreground"
        : "bg-muted hover:bg-muted/80"
    }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["all", t.collectionAll],
            ["generated", t.collectionGenerated],
            ["reference", t.collectionReference],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setCollection(id)}
            className={pill(collection === id)}
          >
            {label}
          </button>
        ))}

        <span className="bg-border mx-1 h-4 w-px" />

        {brands.map((b) => (
          <button
            key={b}
            onClick={() => setBrand(brand === b ? "all" : b)}
            className={pill(brand === b)}
          >
            {b}
          </button>
        ))}

        <span className="bg-border mx-1 h-4 w-px" />

        {presentTypes.map((tp) => (
          <button
            key={tp}
            onClick={() => setType(type === tp ? "all" : tp)}
            className={pill(type === tp)}
          >
            {typeLabel(tp, isRTL)}
          </button>
        ))}

        <span className="text-muted-foreground ms-auto text-xs" dir="ltr">
          {filtered.length} / {assets.length}
        </span>
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-0 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((asset, i) => (
            <ShowroomCard key={asset.id} asset={asset} index={i} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground py-16 text-center text-sm">
          {t.showroomEmpty}
        </p>
      )}
    </div>
  );
}
