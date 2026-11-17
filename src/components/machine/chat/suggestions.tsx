"use client";

import {
  FileTextIcon,
  GlobeIcon,
  LightbulbIcon,
  PenLineIcon,
  PlusIcon,
  VideoIcon,
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
 * The starters under the empty composer, apple.com-style: each row spreads end to end, the starter at
 * the start and a round + at the end (Apple's card button). No hover fill: the + darkens instead.
 * They come from the department pack's quick actions; a tap sends.
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
  if (actions.length === 0) return null;
  return (
    <ul className="flex w-full flex-col divide-y divide-border/70">
      {actions.map((q) => {
        const Icon = iconFor(q);
        return (
          <li key={q.prompt}>
            <button
              type="button"
              onClick={() => onPick(q.prompt)}
              disabled={disabled}
              className="group flex w-full items-center justify-between gap-4 px-2 py-4 text-start text-[17px] text-foreground disabled:opacity-50"
            >
              <span className="flex min-w-0 items-center gap-4">
                <Icon
                  className="size-5 shrink-0 text-muted-foreground"
                  strokeWidth={1.5}
                  aria-hidden
                />
                <span dir="auto" className="truncate">
                  {isAr ? q.label_ar : q.label_en}
                </span>
              </span>
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/80 text-background transition-colors group-hover:bg-foreground"
              >
                <PlusIcon className="size-4" strokeWidth={2.5} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
