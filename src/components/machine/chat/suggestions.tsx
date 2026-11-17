"use client";

import { useState } from "react";

import {
  FileTextIcon,
  GlobeIcon,
  LightbulbIcon,
  PenLineIcon,
  VideoIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";

import type { QuickAction } from "../pack/types";

/** One icon per starter, by what it asks for; a neutral bulb otherwise. */
const ICONS: [RegExp, LucideIcon][] = [
  [/فيديو|ريلز|video|reel|لقطات|screenshot/i, VideoIcon],
  [/منشور|اكتب|post|write|draft|سكربت|script/i, PenLineIcon],
  [/عرض|سعر|quote|proposal|pric/i, FileTextIcon],
  [/عملاء|مدارس|leads|find|search|ابحث/i, GlobeIcon],
];
const iconFor = (q: QuickAction): LucideIcon =>
  ICONS.find(([re]) =>
    re.test(`${q.label_en} ${q.label_ar} ${q.prompt}`),
  )?.[1] ?? LightbulbIcon;

/**
 * The starters under the empty composer: a plain list, no borders, no dividers, no hover fill. The
 * end of a row is empty until it is hovered; then a ✕ appears that clears that starter. A tap on the
 * starter sends it. They come from the department pack's quick actions.
 */
export function Suggestions({
  actions,
  isAr,
  onPick,
  disabled,
}: {
  actions: QuickAction[];
  isAr: boolean;
  onPick: (prompt: string) => void;
  disabled?: boolean;
}) {
  // Starters the person cleared with ✕ — gone for this visit.
  const [cleared, setCleared] = useState<string[]>([]);
  const shown = actions.filter((q) => !cleared.includes(q.prompt));
  if (shown.length === 0) return null;
  return (
    <ul className="flex w-full flex-col">
      {shown.map((q) => {
        const Icon = iconFor(q);
        const label = isAr ? q.label_ar : q.label_en;
        return (
          <li
            key={q.prompt}
            className="group flex items-center justify-between gap-2"
          >
            <button
              type="button"
              onClick={() => onPick(q.prompt)}
              disabled={disabled}
              className="flex min-w-0 flex-1 items-center gap-4 px-2 py-3.5 text-start text-[17px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <Icon className="size-5 shrink-0" strokeWidth={1.5} aria-hidden />
              <span dir="auto" className="truncate">
                {label}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setCleared((c) => [...c, q.prompt])}
              aria-label={isAr ? `إخفاء: ${label}` : `Clear: ${label}`}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            >
              <XIcon className="size-4" aria-hidden />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
