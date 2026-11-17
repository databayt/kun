// chat — every string the chat shows, ar + en (kun's inline-copy way, kept in one place).
export interface Copy {
  en: string
  ar: string
}

export const copy = {
  name: { en: "Kun", ar: "كن" },
  placeholder: { en: "Ask Kun", ar: "اسأل كن" },
  quick: { en: "Quick actions", ar: "إجراءات سريعة" },
  send: { en: "Send", ar: "إرسال" },
  stop: { en: "Stop", ar: "إيقاف" },
  scrollDown: { en: "Scroll to the latest message", ar: "انتقل إلى آخر رسالة" },
  copy: { en: "Copy", ar: "نسخ" },
  copied: { en: "Copied", ar: "تم النسخ" },
  good: { en: "Good answer", ar: "إجابة جيدة" },
  bad: { en: "Bad answer", ar: "إجابة سيئة" },
  retry: { en: "Retry", ar: "أعد المحاولة" },
  runError: { en: "The run ended with an error.", ar: "انتهى التنفيذ بخطأ." },
  working: { en: "Working", ar: "جارٍ العمل" },
  showSteps: { en: "Show steps", ar: "أظهر الخطوات" },
  hideSteps: { en: "Hide steps", ar: "أخفِ الخطوات" },
  continuing: { en: "Continuing", ar: "تتابع" },
  openTitle: { en: "Open this page in the Kun app", ar: "افتح هذه الصفحة في تطبيق كن" },
  openText: {
    en: "Chat, sessions and settings run on your computer, inside the app only.",
    ar: "المحادثة والجلسات والإعدادات تعمل على جهازك داخل التطبيق فقط.",
  },
  openButton: { en: "Browse the catalog", ar: "تصفّح الكتالوج" },
} satisfies Record<string, Copy | Record<string, Copy>>

/** Rotating words of the orange working line — they claim no action; the rows above name the step. */
export const words: { en: readonly string[]; ar: readonly string[] } = {
  en: ["Weighing it up…", "Thinking it through…", "Putting it together…", "Connecting the dots…", "Mulling it over…", "Working it out…"],
  ar: ["أوازن الأمر…", "أفكّر في الأمر…", "أجمع الخيوط…", "أربط الأفكار…", "أتأمّل الطلب…", "أعمل على الحل…"],
}

/** Greeting before the first message. */
export const greeting = (isAr: boolean, name?: string) =>
  isAr ? `أهلاً${name ? ` ${name}` : ""}، كيف أساعدك اليوم؟` : `Hello${name ? ` ${name}` : ""}, how can I help today?`

export const tr = (isAr: boolean) => (k: Copy) => (isAr ? k.ar : k.en)
