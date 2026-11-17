"use client";

import {
  FileTextIcon,
  GlobeIcon,
  LightbulbIcon,
  PenLineIcon,
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
 * The starters under the empty composer, as on chatgpt.com: a plain list, an outline icon and a muted
 * line each, no cards. They come from the department pack's quick actions; a tap sends.
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
    <ul className="flex w-full flex-col">
      {actions.map((q) => {
        const Icon = iconFor(q);
        return (
          <li key={q.prompt}>
            <button
              type="button"
              onClick={() => onPick(q.prompt)}
              disabled={disabled}
              className="flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-start text-[17px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
            >
              <Icon
                className="size-5 shrink-0 text-foreground/70"
                strokeWidth={1.5}
                aria-hidden
              />
              <span dir="auto">{isAr ? q.label_ar : q.label_en}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
