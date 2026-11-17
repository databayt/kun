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
  departments: { en: "Departments", ar: "الأقسام" },
  now: { en: "Now", ar: "الآن" },
  run: { en: "Run", ar: "تشغيل" },
  know: { en: "Know", ar: "معرفة" },
  sprint: { en: "Sprint", ar: "السبرنت" },
  myTasks: { en: "My tasks", ar: "مهامي" },
  board: { en: "Team board", ar: "لوحة الفريق" },
  noTasks: { en: "Nothing queued for you.", ar: "لا شيء في طابورك." },
  noBoard: { en: "No open tasks.", ar: "لا مهام مفتوحة." },
  noSprint: { en: "No sprint is running.", ar: "لا سبرنت جارٍ." },
  tasksOffline: { en: "Tasks load when the machine is connected.", ar: "تظهر المهام حين يتصل الجهاز." },
  start: { en: "Start", ar: "ابدأ" },
  ready: { en: "Ready to start", ar: "جاهزة للبدء" },
  missing: { en: "Missing context", ar: "ينقصها سياق" },
  blocked: { en: "Blocked", ar: "محجوبة" },
  unassigned: { en: "Unassigned", ar: "بلا مسؤول" },
  noSkills: { en: "No lanes for this department.", ar: "لا مسارات لهذا القسم." },
  repos: { en: "Repos", ar: "المستودعات" },
  docs: { en: "Docs", ar: "الوثائق" },
  people: { en: "People", ar: "الفريق" },
  local: { en: "On this machine", ar: "على هذا الجهاز" },
  remote: { en: "Not on this machine", ar: "ليس على هذا الجهاز" },
  seen: { en: "Last seen", ar: "آخر ظهور" },
  never: { en: "never", ar: "لم يظهر" },
  recent: { en: "Recent chats", ar: "آخر المحادثات" },
  language: { en: "Language", ar: "اللغة" },
  health: { en: "Machine health", ar: "صحة الجهاز" },
  healthOk: { en: "Healthy", ar: "سليم" },
  healthBad: { en: "Needs attention", ar: "يحتاج انتباهاً" },
  healthUnknown: { en: "Not checked yet", ar: "لم يُفحص بعد" },
  noDept: { en: "No department is set for this machine.", ar: "لا قسم لهذا الجهاز." },
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

export const DEPT_KEY = "kun.machine.dept"
