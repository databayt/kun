/**
 * Bilingual strings for the Social Hub.
 * Co-located per the house convention (see components/report-issue/dictionary.ts).
 */

import type { Locale } from "@/components/local/config";

export const SOCIAL_DICTIONARY = {
  en: {
    title: "Kun for social media",
    description:
      "Stage and publish approved posts to social media channels through wired relays.",
    announcementText: "Hermes Remote Gateway v2.0",
    primaryAction: "Explore Features",
    secondaryAction: "Request a Feature",
    product: "Product",
    selectProduct: "Select a product",
    status: "Status",
    hermesRow: "Hermes Gateway",
    telegramRow: "Telegram Bot",
    facebookRow: "Facebook Page",
    connected: "Connected",
    disconnected: "Disconnected",
    checking: "Checking...",
    lastSeen: "last polled",
    testConnection: "Test Connections",
    apiUrl: "Gateway URL",
    notConfigured: "not configured",
    composerTitle: "Post Composer",
    composerDesc:
      "Paste approved copy, select channels, and publish to social media relays.",
    textareaPlaceholder: "Paste the approved post copy here…",
    all: "All",
    channel: "Channel",
    selectChannel: "Select channels",
    channelCount: "{count} channels",
    comingSoon: "soon",
    postDirect: "Publish",
    posting: "Publishing...",
    scheduleLabel: "Schedule for",
    scheduleAction: "Schedule",
    scheduling: "Scheduling...",
    scheduledMsg: "Scheduled {count} channel(s) for {at}",
    scheduleHint: "Leave empty to publish now. Scheduled posts go out within ~15 minutes of the chosen time.",
    stageForReview: "Send for review",
    staging: "Sending...",
    stagedMsg:
      "Staged for approval — the publish link is in the review channel",
    mediaLabel: "Media URL",
    mediaPlaceholder: "https://cdn.databayt.org/… (optional, from /higgs)",
    mediaHint:
      "Must be a public image URL — the platforms fetch it themselves.",
    charCount: "{count} / {max}",
    overCaptionLimit:
      "Over {max} characters — too long to stage for review; publish directly instead.",
    draftHintTitle: "Where do drafts come from?",
    draftHintBody:
      "Claude writes the copy — say “social post” in Claude Code (the /social skill) to draft Arabic-first variants per channel, generate media via /higgs, and get it approved. This composer is the last mile only.",
    successMsg: "Successfully posted!",
    partialMsg: "Published with failures:",
    errorMsg: "Failed to process: ",
    noChannels: "No channel is wired for this product yet.",
    // Why the Publish button is disabled — shown so the block is never silent.
    blockedNoText: "Write or paste the post copy first.",
    blockedNoChannel: "Select at least one channel.",
    blockedTransport:
      "Waiting on a disconnected relay for the selected channels.",
  },
  ar: {
    title: "كن للتواصل الاجتماعي",
    description:
      "جهّز وانشر المنشورات المعتمدة على قنوات التواصل الاجتماعي عبر النواقل الموصولة.",
    announcementText: "بوابة Hermes البعيدة v2.0",
    primaryAction: "استكشف المزايا",
    secondaryAction: "اطلب ميزة",
    product: "المنتج",
    selectProduct: "اختر منتجاً",
    channel: "القناة",
    selectChannel: "اختر القنوات",
    channelCount: "{count} قنوات",
    status: "الحالة",
    hermesRow: "بوابة Hermes",
    telegramRow: "بوت تيليجرام",
    facebookRow: "صفحة فيسبوك",
    connected: "متصل",
    disconnected: "غير متصل",
    checking: "جاري الفحص...",
    lastSeen: "آخر اتصال",
    testConnection: "فحص الاتصالات",
    apiUrl: "رابط البوابة",
    notConfigured: "غير مُهيّأ",
    composerTitle: "منشئ المنشورات",
    composerDesc:
      "الصق النص المعتمد، اختر القنوات، ثم انشر. النواقل توصّل فقط — لا تكتب.",
    textareaPlaceholder: "الصق نص المنشور المعتمد هنا…",
    all: "الكل",
    comingSoon: "قريباً",
    postDirect: "نشر",
    posting: "جاري النشر...",
    scheduleLabel: "جدولة في",
    scheduleAction: "جدولة",
    scheduling: "جاري الجدولة...",
    scheduledMsg: "تمت جدولة {count} قناة في {at}",
    scheduleHint: "اتركه فارغاً للنشر الآن. المنشورات المجدولة تُنشر خلال ~15 دقيقة من الوقت المحدد.",
    stageForReview: "إرسال للمراجعة",
    staging: "جاري الإرسال...",
    stagedMsg: "تم الإرسال للاعتماد — رابط النشر في قناة المراجعة",
    mediaLabel: "رابط الوسائط",
    mediaPlaceholder: "https://cdn.databayt.org/… (اختياري، من ‎/higgs)",
    mediaHint: "يجب أن يكون رابط صورة عاماً — المنصات تجلبه بنفسها.",
    charCount: "{count} / {max}",
    overCaptionLimit:
      "تجاوز {max} حرفاً — طويل جداً للمراجعة؛ انشر مباشرة بدلاً من ذلك.",
    draftHintTitle: "من أين تأتي المسودات؟",
    draftHintBody:
      "Claude يكتب النص — قل «منشور تواصل» في Claude Code (مهارة ‎/social) لصياغة نسخ عربية-أولاً لكل قناة، وتوليد الوسائط عبر ‎/higgs، ثم الاعتماد. هذا المنشئ هو الميل الأخير فقط.",
    successMsg: "تم النشر بنجاح!",
    partialMsg: "تم النشر مع إخفاقات:",
    errorMsg: "فشلت العملية: ",
    noChannels: "لا توجد قناة موصولة لهذا المنتج بعد.",
    blockedNoText: "اكتب أو الصق نص المنشور أولاً.",
    blockedNoChannel: "اختر قناة واحدة على الأقل.",
    blockedTransport: "في انتظار ناقل غير متصل للقنوات المختارة.",
  },
} as const;

// Values widen to `string` — `as const` would otherwise type each key as its own
// English literal, which no Arabic string can satisfy. Keeping the key set from
// `en` means a key missing from `ar` is a type error, not a runtime `undefined`.
export type SocialDict = {
  readonly [K in keyof (typeof SOCIAL_DICTIONARY)["en"]]: string;
};

export function getSocialDict(lang: Locale): SocialDict {
  return SOCIAL_DICTIONARY[lang as "en" | "ar"] ?? SOCIAL_DICTIONARY.en;
}

/** Fills {name} placeholders — the dictionary keeps the sentence, not the code. */
export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match,
  );
}
