"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { SeeMore } from "@/components/atom/see-more";
import type { Locale } from "@/components/local/config";

import HomeCards from "./all";
import { ENGINE_GROUPS, GROUP_OF, homeItems } from "./config";

type TabId = "all" | string;

interface HomeTabsProps {
  lang?: Locale;
}

const INITIAL_ROWS = 3;
const COLS_LG = 4;
const INITIAL_COUNT = INITIAL_ROWS * COLS_LG;

const tabs: { id: TabId; label: string }[] = [
  { id: "all", label: "All" },
  ...ENGINE_GROUPS.map((g) => ({ id: g.id, label: g.label })),
];

export default function HomeTabs({ lang = "en" }: HomeTabsProps) {
  const [active, setActive] = useState<TabId>("all");
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(
    () =>
      active === "all"
        ? homeItems
        : homeItems.filter((item) => GROUP_OF[item.id] === active),
    [active],
  );

  const visible = expanded ? filtered : filtered.slice(0, INITIAL_COUNT);
  const hasMore = filtered.length > INITIAL_COUNT;

  return (
    <>
      {/* Tabs */}
      <div className="border-b-[0.5px] py-3">
        <div className="relative">
          <ScrollArea className="max-w-[600px] lg:max-w-none">
            <nav className="flex items-center gap-2 rtl:flex-row-reverse">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActive(tab.id);
                    setExpanded(false);
                  }}
                  className={cn(
                    "hover:text-primary flex h-7 shrink-0 items-center justify-center rounded-full px-4 text-center text-sm transition-colors",
                    active === tab.id ? "bg-muted text-primary" : "",
                  )}
                >
                  <h6>{tab.label}</h6>
                </button>
              ))}
            </nav>
            <ScrollBar orientation="horizontal" className="invisible" />
          </ScrollArea>
        </div>
      </div>

      {/* Card grid */}
      <HomeCards items={visible} lang={lang} />

      {/* See more */}
      <SeeMore
        hasMore={hasMore && !expanded}
        onClick={() => setExpanded(true)}
        label="See more"
        className="pb-8"
      />
    </>
  );
}
