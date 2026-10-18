"use client";

// The bar under the console header: views as pathname tabs, the loop's pulse
// (last tick, send switch) at the end.

import { TabsNav, type TabItem } from "@/components/atom/tabs";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/components/local/config";

import type { ConsoleDict } from "./dictionary";

const VIEWS = ["board", "needs", "table", "activity", "loop", "profile"] as const;

export function ConsoleShell({
  lang,
  t,
  lastTick,
  sendOff,
  needs,
}: {
  lang: Locale;
  t: ConsoleDict;
  lastTick: string;
  sendOff: boolean;
  needs: number;
}) {
  const tabs: TabItem[] = VIEWS.map((v) => ({
    name: v === "needs" && needs ? `${t.tabs.needs} · ${needs}` : t.tabs[v],
    href: `/${lang}/seek/${v}`,
  }));
  return (
    <div className="flex flex-wrap items-center gap-3 border-b-[0.5px] py-3">
      <TabsNav tabs={tabs} aria-label={t.tabsLabel} />
      <div className="text-muted-foreground ms-auto flex items-center gap-2 text-xs">
        {sendOff && <Badge variant="destructive">{t.sendOff}</Badge>}
        <span>
          {t.lastTick}: {lastTick}
        </span>
      </div>
    </div>
  );
}
