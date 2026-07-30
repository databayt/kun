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
    // Why Slack is absent from an audience picker — stated so it reads as
    // deliberate rather than missing.
    reviewHint: "Approvals and notices go to #social",
    postDirect: "Publish",
    posting: "Publishing...",
    scheduleLabel: "Schedule for",
    scheduleAction: "Schedule",
    scheduling: "Scheduling...",
    scheduledMsg: "Scheduled {count} channel(s) for {at}",
    scheduleHint:
      "Leave empty to publish now. Scheduled posts go out within ~15 minutes of the chosen time.",
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
    agentTitle: "Social Agent",
    agentHint:
      "Describe the post and Claude drafts it — Arabic first, English beside it. Pick a version and it lands in the composer below.",
    // The heading's second line: lead sentence, then the words of the scroll link.
    agentLead: "Describe the post, or",
    agentScrollText: "see what's already published",
    agentPlaceholder: "Describe the post — topic, news, angle…",
    agentPlaceholderMore: "Draft another…",
    agentDrafting: "Queued — Claude is writing it.",
    agentQueuedHint:
      "Drafting runs on the team's Claude subscription, so it lands within minutes rather than seconds. Leave this page open — it updates itself.",
    agentUseAr: "Use Arabic",
    agentUseEn: "Use English",
    agentUseBoth: "Use both",
    agentStartNew: "Start new",
    agentError: "Drafting failed:",
    // Prompt toolbar.
    agentAttach: "Attach",
    agentAttachItem: "Attach a brief, notes or a transcript",
    agentAttachHint: "Attached: {files}",
    agentVoiceTitle: "Dictation isn't wired yet",
    agentModelLabel: "Model",
    // The reasoning panel — the real queue, not invented thinking.
    agentThinking: "Waiting on the draft queue…",
    agentThought: "Waited {seconds} seconds",
    agentReasoning:
      "1. **Queued** — the brief is on the draft queue as {brand}.\n2. **Picked up** — a Claude Code session on the team's Max subscription takes the oldest pending ask.\n3. **Written** — Arabic crafted first, English mirrored beside it.\n4. **Returned** — the answer lands here; this window polls every few seconds.\n\nThis is not an API call. Drafting runs on the subscription, so it arrives in minutes rather than seconds.",
    agentPipStreaming: "Writing out…",
    agentPipDone: "Ready",
    agentPipFailed: "Failed",
    agentPipRejected: "Rejected",
    successMsg: "Successfully posted!",
    partialMsg: "Published with failures:",
    errorMsg: "Failed to process: ",
    noChannels: "No channel is wired for this product yet.",
    // Why the Publish button is disabled — shown so the block is never silent.
    blockedNoText: "Write or paste the post copy first.",
    blockedNoChannel: "Select at least one channel.",
    blockedTransport:
      "Waiting on a disconnected relay for the selected channels.",
    ledgerTitle: "Recent activity",
    ledgerEmpty:
      "Nothing recorded yet — publishes, schedules and approvals will appear here.",
    ledgerBrand: "Brand",
    ledgerChannel: "Channel",
    ledgerText: "Copy",
    ledgerStatus: "Status",
    ledgerWhen: "When",
    ledgerReach: "Reach / views",
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
    reviewHint: "الاعتمادات والإشعارات تذهب إلى ‎#social",
    postDirect: "نشر",
    posting: "جاري النشر...",
    scheduleLabel: "جدولة في",
    scheduleAction: "جدولة",
    scheduling: "جاري الجدولة...",
    scheduledMsg: "تمت جدولة {count} قناة في {at}",
    scheduleHint:
      "اتركه فارغاً للنشر الآن. المنشورات المجدولة تُنشر خلال ~15 دقيقة من الوقت المحدد.",
    stageForReview: "إرسال للمراجعة",
    staging: "جاري الإرسال...",
    stagedMsg: "تم الإرسال للاعتماد — رابط النشر في قناة المراجعة",
    mediaLabel: "رابط الوسائط",
    mediaPlaceholder: "https://cdn.databayt.org/… (اختياري، من ‎/higgs)",
    mediaHint: "يجب أن يكون رابط صورة عاماً — المنصات تجلبه بنفسها.",
    charCount: "{count} / {max}",
    overCaptionLimit:
      "تجاوز {max} حرفاً — طويل جداً للمراجعة؛ انشر مباشرة بدلاً من ذلك.",
    agentTitle: "وكيل التواصل",
    agentHint:
      "صِف المنشور ويكتبه Claude — بالعربية أولًا ومعها الإنجليزية. اختر نسخة وستهبط في المنشئ بالأسفل.",
    agentLead: "صِف المنشور، أو",
    agentScrollText: "اطّلع على ما نُشر بالفعل",
    agentPlaceholder: "صِف المنشور — الموضوع، الخبر، الزاوية…",
    agentPlaceholderMore: "صياغة أخرى…",
    agentDrafting: "في الانتظار — Claude يكتبه الآن.",
    agentQueuedHint:
      "الصياغة تعمل على اشتراك الفريق في Claude، فتصل في دقائق لا ثوانٍ. اترك الصفحة مفتوحة — تُحدّث نفسها.",
    agentUseAr: "استخدم العربية",
    agentUseEn: "استخدم الإنجليزية",
    agentUseBoth: "استخدم الاثنتين",
    agentStartNew: "ابدأ من جديد",
    agentError: "فشلت الصياغة:",
    agentAttach: "إرفاق",
    agentAttachItem: "أرفق موجزاً أو ملاحظات أو تفريغاً نصياً",
    agentAttachHint: "مُرفق: {files}",
    agentVoiceTitle: "الإدخال الصوتي غير موصول بعد",
    agentModelLabel: "النموذج",
    agentThinking: "في انتظار طابور الصياغة…",
    agentThought: "انتظرنا {seconds} ثانية",
    agentReasoning:
      "١. **في الطابور** — الموجز مُسجَّل في طابور الصياغة باسم {brand}.\n٢. **الاستلام** — جلسة Claude Code على اشتراك الفريق تأخذ أقدم طلب معلّق.\n٣. **الكتابة** — العربية تُصاغ أولاً، والإنجليزية بمحاذاتها.\n٤. **الإرجاع** — تهبط الإجابة هنا؛ هذه النافذة تستعلم كل ثوانٍ.\n\nهذا ليس نداءً لواجهة برمجية. الصياغة تعمل على الاشتراك، فتصل في دقائق لا ثوانٍ.",
    agentPipStreaming: "جاري العرض…",
    agentPipDone: "جاهز",
    agentPipFailed: "فشل",
    agentPipRejected: "مرفوض",
    successMsg: "تم النشر بنجاح!",
    partialMsg: "تم النشر مع إخفاقات:",
    errorMsg: "فشلت العملية: ",
    noChannels: "لا توجد قناة موصولة لهذا المنتج بعد.",
    blockedNoText: "اكتب أو الصق نص المنشور أولاً.",
    blockedNoChannel: "اختر قناة واحدة على الأقل.",
    blockedTransport: "في انتظار ناقل غير متصل للقنوات المختارة.",
    ledgerTitle: "النشاط الأخير",
    ledgerEmpty: "لا سجلات بعد — سيظهر هنا كل نشر وجدولة واعتماد.",
    ledgerBrand: "العلامة",
    ledgerChannel: "القناة",
    ledgerText: "النص",
    ledgerStatus: "الحالة",
    ledgerWhen: "الوقت",
    ledgerReach: "الوصول / المشاهدات",
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
