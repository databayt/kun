import type { ItemStatus } from "./types"

export const TYPES = ["pack", "skill", "agent", "rule", "hook"] as const
export type ItemType = (typeof TYPES)[number]

export const typeLabel: Record<ItemType, { en: string; ar: string }> = {
  pack: { en: "Departments", ar: "الأقسام" },
  skill: { en: "Skills", ar: "المهارات" },
  agent: { en: "Agents", ar: "الوكلاء" },
  rule: { en: "Rules", ar: "القواعد" },
  hook: { en: "Hooks", ar: "الخطافات" },
}

export const statusLabel: Record<ItemStatus, { en: string; ar: string }> = {
  installed: { en: "Installed", ar: "مثبّت" },
  available: { en: "Available", ar: "متاح" },
  outdated: { en: "Update available", ar: "يوجد تحديث" },
}

export const copy = {
  title: { en: "Catalog", ar: "الكتالوج" },
  subtitle: {
    en: "Skills, agents, rules, hooks and department packs for this computer.",
    ar: "المهارات والوكلاء والقواعد والخطافات وحزم الأقسام لهذا الجهاز.",
  },
  search: { en: "Search the catalog", ar: "ابحث في الكتالوج" },
  all: { en: "All", ar: "الكل" },
  loading: { en: "Loading…", ar: "جارٍ التحميل…" },
  empty: { en: "Nothing matches.", ar: "لا شيء يطابق البحث." },
  install: { en: "Install", ar: "تثبيت" },
  update: { en: "Update", ar: "تحديث" },
  uninstall: { en: "Uninstall", ar: "إزالة" },
  working: { en: "Working…", ar: "جارٍ العمل…" },
  getMachine: {
    en: "You are browsing read-only. Get machine to install items on your computer.",
    ar: "أنت تتصفح للقراءة فقط. حمّل machine لتثبيت العناصر على جهازك.",
  },
  getMachineButton: { en: "Get machine", ar: "حمّل machine" },
  back: { en: "Back to catalog", ar: "العودة إلى الكتالوج" },
  notFound: { en: "Item not found.", ar: "العنصر غير موجود." },
  dependencies: { en: "Needs", ar: "يحتاج" },
  keywords: { en: "Keywords", ar: "الكلمات المفتاحية" },
  files: { en: "Files", ar: "الملفات" },
  version: { en: "Version", ar: "الإصدار" },
} as const
