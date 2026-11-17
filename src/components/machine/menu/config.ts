// menu — every string and starter of the mega menu, ar + en.
import type { Copy } from "../chat/config"

export const copy = {
  open: { en: "Open menu", ar: "افتح القائمة" },
  close: { en: "Close menu", ar: "أغلق القائمة" },
  title: { en: "Menu", ar: "القائمة" },
  newChat: { en: "New chat", ar: "محادثة جديدة" },
  chats: { en: "Chats", ar: "المحادثات" },
  noChats: { en: "No chats yet. Ask something and it is kept here.", ar: "لا محادثات بعد. اسأل شيئاً وستُحفظ هنا." },
  deleteChat: { en: "Delete chat", ar: "حذف المحادثة" },
  deleteConfirm: { en: "Delete this chat?", ar: "حذف هذه المحادثة؟" },
  delete: { en: "Delete", ar: "حذف" },
  cancel: { en: "Cancel", ar: "إلغاء" },
  lanes: { en: "Lanes", ar: "المسارات" },
  how: { en: "How it works", ar: "كيف تعمل؟" },
  knowledge: { en: "Knowledge", ar: "المعرفة" },
  settings: { en: "Settings", ar: "الإعدادات" },
  allSettings: { en: "All settings", ar: "كل الإعدادات" },
  readAloud: { en: "Read replies aloud", ar: "قراءة الردود بصوت" },
  agent: { en: "Agent", ar: "الوكيل" },
  catalog: { en: "Catalog", ar: "الكتالوج" },
  catalogHint: { en: "Browse and install Kun, item by item", ar: "تصفّح كن وثبّته عنصراً عنصراً" },
  engine: { en: "Engine", ar: "المحرك" },
  engineHint: { en: "Version, updates and health", ar: "الإصدار والتحديثات والصحة" },
  appOnly: { en: "Chats and lanes run inside the Kun app.", ar: "المحادثات والمسارات تعمل داخل تطبيق كن." },
  groups: {
    today: { en: "Today", ar: "اليوم" },
    yesterday: { en: "Yesterday", ar: "أمس" },
    week: { en: "Previous 7 days", ar: "آخر 7 أيام" },
    older: { en: "Older", ar: "أقدم" },
  },
} satisfies Record<string, Copy | Record<string, Copy>>

/** The repos a person can learn from, with the names shown for them. */
export const repoNames: Record<string, Copy> = {
  kun: { en: "Kun", ar: "كن" },
  hogwarts: { en: "Hogwarts", ar: "هوغورتس" },
  mkan: { en: "Mkan", ar: "مكان" },
}

export const defaultRepos = ["kun", "hogwarts", "mkan"]

export function repoName(repo: string, isAr: boolean): string {
  const n = repoNames[repo]
  return n ? (isAr ? n.ar : n.en) : repo
}

/** The three learn starters per repo: the label shown, and the prompt that fills the composer. */
export function repoStarters(repo: string, isAr: boolean): { label: string; prompt: string }[] {
  const r = repoName(repo, isAr)
  return isAr
    ? [
        { label: "اشرح ميزة …", prompt: `اشرح ميزة في ${r} خطوة بخطوة: ` },
        { label: `لخّص ${r} في دقيقتين`, prompt: `لخص ${r} في دقيقتين لاجتماع` },
        { label: "سكربت فيديو ٦٠ ثانية", prompt: `اكتب سكربت فيديو ٦٠ ثانية عن ` },
      ]
    : [
        { label: "Explain a feature …", prompt: `Explain a feature of ${r} step by step: ` },
        { label: `Summarise ${r} in two minutes`, prompt: `Summarise ${r} in two minutes for a meeting` },
        { label: "60-second video script", prompt: `Write a 60-second video script about ` },
      ]
}

/** Starter for one skill, and the "how does it work" question about it. */
export const skillStarter = (title: string, isAr: boolean) => (isAr ? `أريد استخدام مهارة ${title}: ` : `Use the ${title} skill to `)
export const skillHow = (name: string) => `اشرح كيف تعمل مهارة ${name} خطوة بخطوة`

export const promptHref = (lang: string, prompt: string) => `/${lang}/machine?prompt=${encodeURIComponent(prompt)}`

/** Window events that tie the menu to the open chat. */
export const NEW_CHAT_EVENT = "kun:new-chat"
export const CHAT_DELETED_EVENT = "kun:chat-deleted"
