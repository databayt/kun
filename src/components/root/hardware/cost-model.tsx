"use client";

import { useMemo, useState } from "react";
import {
  SETUP_ITEMS,
  MACHINES,
  SETUP,
  computeSetup,
  itemWh,
  machineWh,
  type ItemGroup,
} from "./config";

interface CostModelProps {
  isAr: boolean;
}

function fmt(n: number, digits = 1): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/**
 * The live cost model. Picking the box or toggling a line item re-derives
 * capex, the monthly bill, daily energy and UPS runtime from the same formulas
 * the doc prints — the point of this page over the doc is that the cost of a
 * choice is visible rather than asserted. Choosing the M5 Ultra over the
 * M5 Max adds $4,100 up front and roughly doubles the box's energy; that delta
 * is the argument, and here it is live.
 */
export function CostModel({ isAr }: CostModelProps) {
  const [machineId, setMachineId] = useState<string>(MACHINES[0].id);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(SETUP_ITEMS.filter((r) => r.defaultOn).map((r) => r.id)),
  );

  const machine = MACHINES.find((m) => m.id === machineId) ?? MACHINES[0];
  const setup = useMemo(
    () => computeSetup(selected, machine),
    [selected, machine],
  );

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const groups: { key: ItemGroup; title: string; titleAr: string }[] = [
    { key: "desk", title: "The desk", titleAr: "المكتب" },
    { key: "link", title: "The link", titleAr: "الاتصال" },
    { key: "power", title: "Power", titleAr: "الطاقة" },
  ];

  const overUps = setup.hasUps && setup.peakW > SETUP.upsMaxW;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-8">
        {/* ── The one box ───────────────────────────────────────────── */}
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
              {isAr ? "الجهاز" : "The one box"}
            </h2>
            <span
              dir="ltr"
              className="text-muted-foreground font-mono text-xs tabular-nums"
            >
              {usd(machine.priceUSD)}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {MACHINES.map((m) => {
              const on = m.id === machineId;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMachineId(m.id)}
                  aria-pressed={on}
                  className={`rounded-lg border p-4 text-start transition-colors ${
                    on
                      ? "border-foreground"
                      : "border-border hover:bg-muted/50 opacity-60"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold">
                      {isAr ? m.nameAr : m.name}
                    </span>
                    <span
                      dir="ltr"
                      className="font-mono text-xs whitespace-nowrap tabular-nums"
                    >
                      {usd(m.priceUSD)}
                    </span>
                  </div>
                  <div
                    dir="ltr"
                    className="text-muted-foreground mt-2 space-y-0.5 font-mono text-[11px] tabular-nums rtl:text-end"
                  >
                    <div>
                      {m.memory} · {m.config.split(" · ")[1]} SSD
                    </div>
                    <div>
                      {m.bandwidth} · {m.compute}
                    </div>
                    <div>
                      ~{m.loadW} W load · {m.idleW} W idle ·{" "}
                      {(machineWh(m) / 1000).toFixed(1)} kWh/day
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-2 text-xs">
                    {isAr ? m.verdictAr : m.verdict}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Line items ────────────────────────────────────────────── */}
        {groups.map((group) => {
          const rows = SETUP_ITEMS.filter((r) => r.group === group.key);
          const subtotal = rows
            .filter((r) => selected.has(r.id))
            .reduce((sum, r) => sum + r.capexUSD, 0);

          return (
            <section key={group.key}>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
                  {isAr ? group.titleAr : group.title}
                </h2>
                <span
                  dir="ltr"
                  className="text-muted-foreground font-mono text-xs tabular-nums"
                >
                  {usd(subtotal)}
                </span>
              </div>

              <div className="border-border divide-border divide-y rounded-lg border">
                {rows.map((row) => {
                  const on = selected.has(row.id);
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => toggle(row.id)}
                      aria-pressed={on}
                      className={`flex w-full items-start gap-3 p-3 text-start transition-colors ${
                        on ? "" : "opacity-40"
                      } hover:bg-muted/50`}
                    >
                      <span
                        aria-hidden
                        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border text-[10px] ${
                          on
                            ? "border-foreground bg-foreground text-background"
                            : "border-muted-foreground"
                        }`}
                      >
                        {on ? "✓" : ""}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="text-sm font-medium">
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

                      <span
                        dir="ltr"
                        className="shrink-0 text-end font-mono text-sm tabular-nums"
                      >
                        {usd(row.capexUSD)}
                        {row.monthlyUSD > 0 && (
                          <span className="text-muted-foreground block text-xs">
                            +{usd(row.monthlyUSD)}/mo
                          </span>
                        )}
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
        <div className="border-border space-y-5 rounded-lg border p-5">
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
