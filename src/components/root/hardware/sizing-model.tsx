"use client";

import { useMemo, useState } from "react";
import { LOAD_ROWS, SIZING, computeSizing, type LoadRow } from "./config";

interface SizingModelProps {
  isAr: boolean;
}

function fmt(n: number, digits = 1): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * The live electrical model. Toggling a load re-derives battery, array and
 * inverter from the same formulas the doc prints — the point of this page over
 * the doc is that you can see what each load actually costs in silicon.
 */
export function SizingModel({ isAr }: SizingModelProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(LOAD_ROWS.filter((r) => r.defaultOn).map((r) => r.id)),
  );

  const sizing = useMemo(() => computeSizing(selected), [selected]);

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const groups: { key: LoadRow["group"]; title: string; titleAr: string }[] = [
    { key: "compute", title: "Compute and IT", titleAr: "الحوسبة والتقنية" },
    { key: "domestic", title: "Domestic", titleAr: "المنزلي" },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      {/* ── Load table ──────────────────────────────────────────────── */}
      <div className="space-y-8">
        {groups.map((group) => {
          const rows = LOAD_ROWS.filter((r) => r.group === group.key);
          const subtotal =
            rows
              .filter((r) => selected.has(r.id))
              .reduce((sum, r) => sum + r.wh, 0) / 1000;

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
                  {fmt(subtotal)} kWh
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
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-sm font-medium">
                            {isAr ? row.labelAr : row.label}
                          </span>
                          {row.firm && (
                            <span className="text-muted-foreground border-border rounded border px-1 text-[10px]">
                              {isAr ? "ثابت" : "firm"}
                            </span>
                          )}
                          {row.shiftable && (
                            <span className="text-muted-foreground border-border rounded border px-1 text-[10px]">
                              {isAr ? "قابل للجدولة" : "solar-shiftable"}
                            </span>
                          )}
                        </span>
                        <span
                          dir="ltr"
                          className="text-muted-foreground mt-0.5 block font-mono text-xs rtl:text-end"
                        >
                          {row.qty > 1 ? `${row.qty} × ` : ""}
                          {row.watts} W × {row.hours} h
                        </span>
                        {(isAr ? row.detailAr : row.detail) && (
                          <span className="text-muted-foreground mt-1 block text-xs">
                            {isAr ? row.detailAr : row.detail}
                          </span>
                        )}
                      </span>

                      <span
                        dir="ltr"
                        className="shrink-0 font-mono text-sm tabular-nums"
                      >
                        {row.wh.toLocaleString("en-US")}
                        <span className="text-muted-foreground text-xs">
                          {" "}
                          Wh
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

      {/* ── Derived sizing ──────────────────────────────────────────── */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="border-border space-y-5 rounded-lg border p-5">
          <div>
            <div className="text-muted-foreground text-xs tracking-widest uppercase">
              {isAr ? "الحمل اليومي" : "Daily load"}
            </div>
            <div
              dir="ltr"
              className="mt-1 font-mono text-3xl tabular-nums rtl:text-end"
            >
              {fmt(sizing.dailyKWh)}
              <span className="text-muted-foreground text-base"> kWh</span>
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              {isAr ? "نقطة التصميم" : "Design point"}{" "}
              <span dir="ltr" className="font-mono tabular-nums">
                ×{SIZING.designMargin} = {fmt(sizing.designKWh)} kWh
              </span>
            </div>
          </div>

          <div className="border-border grid grid-cols-2 gap-4 border-t pt-4 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">
                {isAr ? "ثابت" : "Firm"}
              </div>
              <div dir="ltr" className="font-mono tabular-nums rtl:text-end">
                {fmt(sizing.firmKWh)} kWh
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">
                {isAr ? "قابل للجدولة" : "Shiftable"}
              </div>
              <div dir="ltr" className="font-mono tabular-nums rtl:text-end">
                {fmt(sizing.shiftableKWh)} kWh
              </div>
            </div>
          </div>

          <div className="border-border space-y-4 border-t pt-4">
            <Spec
              label={isAr ? "البطارية" : "Battery"}
              value={`${fmt(sizing.batteryKWh)} kWh`}
              formula={`(${fmt(sizing.designKWh)} × ${SIZING.autonomyDays}) / (${SIZING.dod} × ${SIZING.inverterEff})`}
            />
            <Spec
              label={isAr ? "الألواح — الحد الأدنى" : "Array — minimum"}
              value={`${fmt(sizing.pvMinKWp)} kWp`}
              formula={`${fmt(sizing.designKWh)} / (${SIZING.pshWorstMonth} × ${SIZING.derate})`}
            />
            <Spec
              label={isAr ? "الألواح — الموصى به" : "Array — recommended"}
              value={`${fmt(sizing.pvRecKWp)} kWp`}
              formula={`× ${SIZING.pvHeadroom} · ≈ ${Math.round(sizing.arrayAreaM2)} m²`}
              emphasis
            />
          </div>

          <p className="text-muted-foreground border-border border-t pt-4 text-xs leading-relaxed">
            {isAr
              ? "الكيلوواط الشمسي النهاري يكلف نحو ثلث نظيره الليلي — لذا نوسّع الألواح ونضبط البطارية وننقل الأحمال المرنة إلى نافذة الشمس."
              : "A daytime kWh costs about a third of a night-time one — so oversize the array, right-size the battery, and move flexible loads into the sun."}
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
