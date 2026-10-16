"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Cpu,
  HardDrive,
  RadioTower,
  Router,
  SunDim,
  type LucideIcon,
} from "lucide-react";
import { BlurImage } from "@/components/atom/blur-image";
import { cn } from "@/lib/utils";
import {
  SETUP_ITEMS,
  MACHINE,
  SETUP,
  DEFAULT_SELECTION,
  computeSetup,
  itemWh,
  machineWh,
  usd,
  type ItemGroup,
  type ProductImage,
} from "./config";

interface CostModelProps {
  isAr: boolean;
}

/** Rows without a product photo get a glyph, so every row has a thumbnail. */
const ICONS: Record<string, LucideIcon> = {
  "upgrade-128": Cpu,
  nano: SunDim,
  ssd: HardDrive,
  fibre: Router,
  lte: RadioTower,
};

function fmt(n: number, digits = 1): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * The live cost model. Toggling a line item re-derives capex, the monthly
 * bill, daily energy and UPS runtime from the same formulas the doc prints —
 * the point of this page over the doc is that the cost of a choice is visible
 * rather than asserted. The 128 GB upgrade is the one that matters: +$2,600,
 * and Apple only sells it at checkout.
 */
export function CostModel({ isAr }: CostModelProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(DEFAULT_SELECTION),
  );

  const setup = useMemo(() => computeSetup(selected), [selected]);

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const groups: { key: ItemGroup; title: string; titleAr: string }[] = [
    { key: "box", title: "The box", titleAr: "الجهاز" },
    { key: "desk", title: "The desk", titleAr: "المكتب" },
    { key: "link", title: "The link", titleAr: "الاتصال" },
    { key: "power", title: "Power", titleAr: "الطاقة" },
  ];

  const overUps = setup.hasUps && setup.peakW > SETUP.upsMaxW;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-8">
        {groups.map((group) => {
          const rows = SETUP_ITEMS.filter((r) => r.group === group.key);
          const subtotal =
            (group.key === "box" ? MACHINE.priceUSD : 0) +
            rows
              .filter((r) => selected.has(r.id))
              .reduce((sum, r) => sum + r.capexUSD, 0);

          return (
            <section key={group.key}>
              <div className="mb-3 flex items-baseline justify-between">
                <h3 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
                  {isAr ? group.titleAr : group.title}
                </h3>
                <span
                  dir="ltr"
                  className="text-muted-foreground font-mono text-xs tabular-nums"
                >
                  {usd(subtotal)}
                </span>
              </div>

              <div className="border-border divide-border divide-y overflow-hidden rounded-2xl border">
                {/* The base machine is not optional — it is the page. */}
                {group.key === "box" && (
                  <div className="flex items-center gap-4 p-3">
                    <Thumb image={MACHINE.image} alt="Mac Studio" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">
                        {isAr ? MACHINE.nameAr : MACHINE.name}
                      </div>
                      <div
                        dir="ltr"
                        className="text-muted-foreground mt-0.5 font-mono text-xs rtl:text-end"
                      >
                        {MACHINE.memory} · {MACHINE.bandwidth} · ~
                        {MACHINE.loadW} W load · {MACHINE.idleW} W idle ·{" "}
                        {(machineWh(MACHINE) / 1000).toFixed(2)} kWh/day
                      </div>
                    </div>
                    <span
                      dir="ltr"
                      className="shrink-0 font-mono text-sm tabular-nums"
                    >
                      {usd(MACHINE.priceUSD)}
                    </span>
                  </div>
                )}

                {rows.map((row) => {
                  const on = selected.has(row.id);
                  const Icon = ICONS[row.id];
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => toggle(row.id)}
                      aria-pressed={on}
                      className="hover:bg-muted/50 flex w-full items-center gap-4 p-3 text-start transition-colors"
                    >
                      <span
                        className={cn(
                          "transition-opacity",
                          on ? "opacity-100" : "opacity-40",
                        )}
                      >
                        {row.image ? (
                          <Thumb image={row.image} alt={row.label} />
                        ) : (
                          <span className="bg-muted flex size-14 items-center justify-center rounded-xl">
                            {Icon && (
                              <Icon
                                aria-hidden
                                className="size-5"
                                strokeWidth={1.5}
                              />
                            )}
                          </span>
                        )}
                      </span>

                      <span
                        className={cn(
                          "min-w-0 flex-1 transition-opacity",
                          on ? "opacity-100" : "opacity-50",
                        )}
                      >
                        <span className="block text-sm font-medium">
                          {isAr ? row.labelAr : row.label}
                        </span>
                        {row.watts > 0 && (
                          <span
                            dir="ltr"
                            className="text-muted-foreground mt-0.5 block font-mono text-xs rtl:text-end"
                          >
                            {row.watts} W × {row.hours} h ={" "}
                            {itemWh(row).toLocaleString("en-US")} Wh
                          </span>
                        )}
                        {(isAr ? row.detailAr : row.detail) && (
                          <span className="text-muted-foreground mt-1 block text-xs">
                            {isAr ? row.detailAr : row.detail}
                          </span>
                        )}
                      </span>

                      <span className="flex shrink-0 flex-col items-end gap-1.5">
                        <span
                          dir="ltr"
                          className="font-mono text-sm tabular-nums"
                        >
                          {row.capexUSD > 0 ? usd(row.capexUSD) : "—"}
                        </span>
                        {row.monthlyUSD > 0 && (
                          <span
                            dir="ltr"
                            className="text-muted-foreground font-mono text-xs"
                          >
                            +{usd(row.monthlyUSD)}/mo
                          </span>
                        )}
                        <span
                          aria-hidden
                          className={cn(
                            "flex size-5 items-center justify-center rounded-full border transition-colors",
                            on
                              ? "border-foreground bg-foreground text-background"
                              : "border-muted-foreground/50",
                          )}
                        >
                          {on && <Check className="size-3" strokeWidth={3} />}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* ── Derived totals ──────────────────────────────────────────── */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="bg-muted/50 space-y-5 rounded-2xl p-5">
          <div>
            <div className="text-muted-foreground text-xs tracking-widest uppercase">
              {isAr ? "التكلفة لمرة واحدة" : "One-time"}
            </div>
            <div
              dir="ltr"
              className="mt-1 font-mono text-3xl tabular-nums rtl:text-end"
            >
              {usd(setup.capexUSD)}
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              {isAr
                ? "أسعار أبل الأمريكية — أضف الشحن والجمارك"
                : "Apple US list — add freight and duty"}
            </div>
          </div>

          <div className="border-border border-t pt-4">
            <div className="text-muted-foreground text-xs tracking-widest uppercase">
              {isAr ? "شهريًا" : "Monthly"}
            </div>
            <div
              dir="ltr"
              className="mt-1 font-mono text-2xl tabular-nums rtl:text-end"
            >
              {usd(setup.monthlyUSD)}
              <span className="text-muted-foreground text-sm">
                {" "}
                ≈ {Math.round((setup.monthlyUSD * SETUP.usdRwf) / 1000)}K RWF
              </span>
            </div>
            <div
              dir="ltr"
              className="text-muted-foreground mt-1 font-mono text-[10px] rtl:text-end"
            >
              {usd(setup.serviceMonthlyUSD)} link + {usd(setup.powerMonthlyUSD)}{" "}
              power
            </div>
          </div>

          <div className="border-border space-y-4 border-t pt-4">
            <Spec
              label={isAr ? "الطاقة اليومية" : "Daily energy"}
              value={`${fmt(setup.dailyKWh, 2)} kWh`}
              formula={`box ${fmt(setup.machineKWh, 2)} + rest · × 30 × $${SETUP.kwhUSD}`}
            />
            <Spec
              label={isAr ? "ذروة السحب" : "Peak draw"}
              value={`${Math.round(setup.peakW)} W`}
              formula={`UPS limit ${SETUP.upsMaxW} W`}
            />
            <Spec
              label={isAr ? "زمن البطارية" : "UPS runtime"}
              value={setup.hasUps ? `${Math.round(setup.upsMinutes)} min` : "—"}
              formula={
                setup.hasUps
                  ? `(${SETUP.upsBatteryWh} Wh × ${SETUP.upsEff}) / ${Math.round(setup.peakW)} W`
                  : isAr
                    ? "بلا مزوّد طاقة — أي انقطاع يطفئ الجهاز"
                    : "No UPS — every blip is a hard power-off"
              }
              emphasis
            />
          </div>

          <p className="text-muted-foreground border-border border-t pt-4 text-xs leading-relaxed">
            {overUps
              ? isAr
                ? "الذروة تتجاوز حد المزوّد — اختر فئة ٣٠٠٠ فولت أمبير."
                : "Peak exceeds the UPS rating — step up to the 3000 VA class."
              : isAr
                ? "الجهاز يسحب أقل من مصباح مكتب في الخمول. الكهرباء أصغر بند شهري؛ الاتصال هو الأكبر."
                : "At idle the box draws less than a desk lamp. Power is the smallest monthly line; the link is the largest."}
          </p>
        </div>
      </aside>
    </div>
  );
}

function Thumb({ image, alt }: { image: ProductImage; alt: string }) {
  return (
    <span className="bg-muted relative block size-14 shrink-0 overflow-hidden rounded-xl">
      <BlurImage
        src={image.src}
        alt={alt}
        fill
        unoptimized
        sizes="56px"
        className={cn(
          image.cutout
            ? "object-contain p-1.5"
            : "object-cover mix-blend-multiply dark:mix-blend-normal",
        )}
      />
    </span>
  );
}

function Spec({
  label,
  value,
  formula,
  emphasis = false,
}: {
  label: string;
  value: string;
  formula: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-muted-foreground text-xs">{label}</span>
        <span
          dir="ltr"
          className={`font-mono tabular-nums ${emphasis ? "text-lg font-semibold" : "text-sm"}`}
        >
          {value}
        </span>
      </div>
      {/* dir=ltr is load-bearing: without it the bidi algorithm reorders the
          parenthesised groups and the formula reads as a different equation. */}
      <div
        dir="ltr"
        className="text-muted-foreground/70 mt-0.5 font-mono text-[10px] rtl:text-end"
      >
        {formula}
      </div>
    </div>
  );
}
