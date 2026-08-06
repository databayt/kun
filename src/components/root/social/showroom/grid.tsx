"use client";

// The filterable showroom grid — the /anthropic content pattern (pill filters
// over a dense square grid) on four axes: kind, collection, brand, type. State
// is local; the card list arrives serialized from the server component.
//
// `kind` (generated vs reference) was called "collection" until references
// gained a real `collection` field. Two meanings of one word in one file is how
// a filter starts filtering the wrong thing, so the older one took the name it
// actually reads off the data.

import { useMemo, useState } from "react";
import { useSocial } from "@/components/root/social/provider";
import { ASSET_TYPES, OTHER_TYPE, typeLabel } from "./taxonomy";
import { ShowroomCard } from "./asset-card";
import type { ShowroomAsset } from "./data";

type Kind = "all" | "generated" | "reference";

export function ShowroomGrid({ assets }: { assets: ShowroomAsset[] }) {
  const { isRTL, t } = useSocial();
  const [kind, setKind] = useState<Kind>("all");
  const [collection, setCollection] = useState<string>("all");
  const [brand, setBrand] = useState<string>("all");
  const [type, setType] = useState<string>("all");

  const brands = useMemo(
    () =>
      [
        ...new Set(assets.map((a) => a.brand).filter(Boolean)),
      ].sort() as string[],
    [assets],
  );

  // Reference shelves, only those actually present — and only while references
  // are in view, since every generated asset has a null collection and the row
  // would be a set of pills that filter everything away.
  const collections = useMemo(() => {
    if (kind === "generated") return [];
    return [
      ...new Set(assets.map((a) => a.collection).filter(Boolean)),
    ].sort() as string[];
  }, [assets, kind]);

  // Only offer type pills that exist in the data — 13 canonical + other would
  // be a wall of dead filters at today's library size.
  const presentTypes = useMemo(() => {
    const present = new Set(assets.map((a) => a.type));
    return [...ASSET_TYPES, OTHER_TYPE].filter((tp) => present.has(tp));
  }, [assets]);

  const filtered = useMemo(
    () =>
      assets.filter((a) => {
        if (kind !== "all" && a.kind !== kind) return false;
        if (collection !== "all" && a.collection !== collection) return false;
        if (brand !== "all" && a.brand !== brand) return false;
        if (type !== "all" && a.type !== type) return false;
        return true;
      }),
    [assets, kind, collection, brand, type],
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
            onClick={() => {
              setKind(id);
              // Generated assets all have a null collection, so leaving a shelf
              // selected here would hide its pills AND filter the grid to
              // nothing — a dead screen with no visible cause.
              if (id === "generated") setCollection("all");
            }}
            className={pill(kind === id)}
          >
            {label}
          </button>
        ))}

        {collections.length > 0 && <span className="bg-border mx-1 h-4 w-px" />}

        {collections.map((c) => (
          <button
            key={c}
            onClick={() => setCollection(collection === c ? "all" : c)}
            className={pill(collection === c)}
          >
            {c}
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
