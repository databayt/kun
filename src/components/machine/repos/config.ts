import type { LossKind } from "./types"

type Copy = { en: string; ar: string }

export const copy = {
  title: { en: "Repos", ar: "المستودعات" },
  subtitle: {
    en: "The databayt repos on this computer. Pull only fast-forwards; remove never throws work away.",
    ar: "مستودعات databayt على هذا الجهاز. السحب يتقدم فقط؛ والحذف لا يرمي عملاً أبداً.",
  },
  loading: { en: "Loading…", ar: "جارٍ التحميل…" },
  empty: { en: "No repos yet.", ar: "لا توجد مستودعات بعد." },
  notCloned: { en: "Not on this computer", ar: "ليس على هذا الجهاز" },
  clone: { en: "Clone", ar: "استنساخ" },
  cloneFull: { en: "Clone full history", ar: "استنساخ كامل السجل" },
  pull: { en: "Pull", ar: "سحب" },
  open: { en: "Open on GitHub", ar: "افتح على GitHub" },
  keep: { en: "Keep", ar: "إبقاء" },
  sprint: { en: "Sprint only", ar: "للسبرنت فقط" },
  sprintName: { en: "Sprint", ar: "السبرنت" },
  remove: { en: "Remove", ar: "حذف" },
  confirmRemove: { en: "Remove this clone?", ar: "حذف هذه النسخة؟" },
  yes: { en: "Yes, remove", ar: "نعم، احذف" },
  cancel: { en: "Cancel", ar: "إلغاء" },
  refused: { en: "Not removed. It would lose:", ar: "لم يُحذف. سيضيع:" },
  remote: { en: "Set remote", ar: "تغيير الرابط" },
  remoteHint: { en: "https://github.com/databayt/…", ar: "https://github.com/databayt/…" },
  save: { en: "Save", ar: "حفظ" },
  working: { en: "Working…", ar: "جارٍ العمل…" },
  clean: { en: "clean", ar: "نظيف" },
  dirty: { en: "uncommitted changes", ar: "تغييرات غير محفوظة" },
  private: { en: "private", ar: "خاص" },
  getMachine: {
    en: "Open machine to manage repos on your computer.",
    ar: "افتح machine لإدارة المستودعات على جهازك.",
  },
} satisfies Record<string, Copy>

export const lossLabel: Record<LossKind, (n: number) => Copy> = {
  dirty: (n) => ({ en: `${n} file${n === 1 ? "" : "s"} with uncommitted changes`, ar: `${n} ملف بتغييرات غير محفوظة` }),
  untracked: (n) => ({ en: `${n} untracked file${n === 1 ? "" : "s"}`, ar: `${n} ملف غير متتبَّع` }),
  unpushed: (n) => ({ en: `${n} commit${n === 1 ? "" : "s"} no remote has`, ar: `${n} إيداع غير موجود على الخادم` }),
  stash: (n) => ({ en: `${n} stash${n === 1 ? "" : "es"}`, ar: `${n} مخبأ (stash)` }),
}

export function lossesText(losses: { kind: LossKind; count: number }[], isAr: boolean): string[] {
  return losses.map((l) => lossLabel[l.kind](l.count)).map((c) => (isAr ? c.ar : c.en))
}
