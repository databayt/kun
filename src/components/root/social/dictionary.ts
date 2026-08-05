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
    // The Hub's tabs are the documented pipeline (docs/social), all seven stages
    // across five tabs: Approve · Schedule · Publish are one composer with three
    // buttons, so they are one tab. Plan and Media have no in-app state — the
    // calendar produces a table and /higgs writes to the CDN — so their tabs say
    // where the stage actually runs instead of faking a surface for it.
    tabCalendar: "Calendar",
    tabDraft: "Draft",
    tabMedia: "Media",
    tabPublish: "Publish",
    tabMeasure: "Measure",
    tabsLabel: "Pipeline stage",
    calendarNoteTitle: "Planning happens in the session, not here",
    calendarNoteBody:
      "The calendar decides which brand publishes what, on which day, against each brand's cadence and content pillars. It produces a dated table — brand, topic, channels, owner — and the Hub has nowhere to keep one, so it is not faked here.",
    // The showroom — the Media stage's gallery of generated assets and kept
    // references. Copy is never rendered into AI images (typography breaks,
    // Arabic doubly so); text-bearing formats render on the template lane.
    showroomTitle: "The showroom",
    showroomIntro:
      "What we generated and what we keep as reference. Higgsfield renders text-free visuals to the CDN; text-bearing formats render from HTML templates in the house type. Attach an asset here and it rides the Publish stage's tray.",
    collectionAll: "All",
    collectionGenerated: "Generated",
    collectionReference: "References",
    decksTitle: "Rendered decks",
    showroomEmpty: "Nothing matches these filters.",
    assetCredits: "credits",
    copyUrl: "Copy URL",
    copiedUrl: "Copied",
    openAsset: "Open",
    saveAsset: "Save",
    stageNoteKeyword: "Say this in a Claude Code session:",
    stageNoteDocs: "Read the stage docs",
    hermesRow: "Hermes Gateway",
    telegramRow: "Telegram Bot",
    facebookRow: "Facebook Page",
    instagramRow: "Instagram Account",
    connected: "Connected",
    disconnected: "Disconnected",
    // Deliberately unconfigured (Hermes parked, Telegram deferred) — a choice,
    // not a failure, so it must not read as red.
    parked: "Parked — not configured",
    checking: "Checking...",
    lastSeen: "last polled",
    drainRow: "Draft queue",
    drainLastCheck: "last checked",
    drainNever: "never checked",
    testConnection: "Test Connections",
    apiUrl: "Gateway URL",
    notConfigured: "not configured",
    textareaPlaceholder: "Paste the approved post copy here…",
    all: "All",
    channel: "Channel",
    selectChannel: "Select channels",
    channelCount: "{count} channels",
    comingSoon: "soon",
    // Why Slack is absent from an audience picker — stated so it reads as
    // deliberate rather than missing.
    reviewHint: "Approvals and notices go to #social",
    scheduleLabel: "Schedule for",
    scheduledMsg: "Scheduled {count} channel(s) for {at}",
    scheduleHint:
      "Leave empty to publish now. Scheduled posts go out within ~15 minutes of the chosen time.",
    stageForReview: "Send for review",
    staging: "Sending...",
    stagedMsg:
      "Staged for approval — the publish link is in the review channel",
    // The Hub-as-review-surface path: no relay carried the links, the stage
    // still stands, and the human hands them over.
    stagedLocalMsg:
      "Staged. No review relay is configured — hand these links to the approver yourself.",
    reviewLinksTitle:
      "Approval links — each publishes one channel, once; expires in 12h",
    copyLink: "Copy",
    copiedLink: "Copied",
    openLink: "Open",
    mediaLabel: "Media",
    mediaPlaceholder: "https://cdn.databayt.org/… (optional, from /higgs)",
    mediaHint:
      "Must be a public media URL — the platforms fetch it themselves. Images and/or one video, up to 10.",
    charCount: "{count} / {max}",
    // ——— The review queue (the Publish stage) ———
    reviewTitle: "Review & publish",
    reviewIntro:
      "Answered drafts queue here for a human decision — fine-tune, then approve. Writing happens in the Draft stage; media in the showroom.",
    reviewQueueCount: "{count} awaiting review",
    reviewNextUp: "Next up",
    reviewRefresh: "Refresh",
    reviewAgo: "{age} ago",
    reviewEmptyTitle: "Nothing awaiting review",
    reviewEmptyBody:
      "Answered drafts land here for approval. Ask the agent for one in the Draft stage — or let the Monday seed file the week's briefs.",
    reviewEmptyCta: "Go to Draft",
    reviewNextDraft: "Next draft",
    approveAction: "Approve & publish",
    approveScheduleAction: "Approve & schedule",
    approving: "Approving...",
    approvedNowMsg: "Approved and published.",
    dismissAction: "Dismiss",
    dismissing: "Dismissing...",
    dismissedMsg: "Dismissed — it will not publish.",
    // The settings popover: what Approve does.
    approveModeLabel: "When a draft is approved",
    approveModeNow: "Publish right away",
    approveModeNowHint:
      "Approve delivers to the selected channels immediately.",
    approveModeSchedule: "Schedule for a time",
    approveModeScheduleHint:
      "Approve queues the post; the cron drain delivers it within ~15 minutes of the chosen time.",
    // The attachment tray.
    attachAddUrl: "Add media by URL",
    attachAddAction: "Add",
    attachRemove: "Remove",
    attachBrowse: "Browse the showroom",
    mediaKindVideo: "video",
    mixedMediaWarning:
      "Images and video cannot ride one post — keep one kind, split the other into its own post.",
    // The showroom's attach affordance.
    attachAsset: "Attach",
    attachedAsset: "Attached",
    attachOpenPublish: "Open the Publish stage",
    agentTitle: "Social Agent",
    // Under the prompt, before the first ask. The only place a contributor is
    // told what a good brief contains — and the copy is only as good as the brief.
    agentHint:
      "The more concrete the brief, the better the copy: the fact, who it's for, what they should do, and any date, name or link that must appear. Claude writes it on the team's subscription, Arabic first with English beside it.",
    // The heading's second line: lead sentence, then the words of the scroll link.
    agentLead: "Describe the post, or",
    agentScrollText: "see what's already published",
    // {brand} is filled with whatever the product select is showing, so the
    // prompt always names the brand the ask will actually be filed under.
    agentPlaceholder: "draft a post for {brand} about ..",
    agentPlaceholderMore: "Draft another…",
    agentDrafting: "Queued — Claude is writing it.",
    agentQueuedHint:
      "Drafting runs on the team's Claude subscription, so it lands within minutes rather than seconds. Leave this page open — it updates itself.",
    // The queue's own truth, once the first poll returns. {minutes} since a
    // drafting session last listed the queue; {position} is 1-based.
    agentDrainFresh:
      "A drafting session checked the queue {minutes} min ago — you're position {position}.",
    agentDrainStale:
      "No drafting session is watching the queue right now — your ask stays saved.",
    agentStillQueued:
      "Still queued — no session picked this up. Your ask stays saved; unanswered asks expire after an hour.",
    agentCheckAgain: "Check again",
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
    agentDraftMedia: "Suggested media",
    agentTrayHint: "{count} media in the tray — they ride the next ask.",
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
    tabCalendar: "التقويم",
    tabDraft: "الصياغة",
    tabMedia: "الوسائط",
    tabPublish: "النشر",
    tabMeasure: "القياس",
    tabsLabel: "مرحلة المسار",
    calendarNoteTitle: "التخطيط يجري في الجلسة، لا هنا",
    calendarNoteBody:
      "التقويم يحدّد أي علامة تنشر ماذا وفي أي يوم، وفق وتيرة كل علامة ومحاور محتواها. ناتجه جدول مؤرَّخ — العلامة، الموضوع، القنوات، المسؤول — ولا مكان في اللوحة لحفظه، فلم نصطنع له واجهة.",
    showroomTitle: "المعرض",
    showroomIntro:
      "ما ولّدناه وما نحتفظ به كمرجع. Higgsfield يصنع صوراً بلا نصوص ويدفعها إلى الـCDN؛ والقوالب النصية تُصاغ من HTML بخط الدار. أرفق أصلاً من هنا يهبط في حافظة مرحلة النشر.",
    collectionAll: "الكل",
    collectionGenerated: "المولَّد",
    collectionReference: "المراجع",
    decksTitle: "الكاروسيلات المُصيَّرة",
    showroomEmpty: "لا شيء يطابق هذه المرشّحات.",
    assetCredits: "رصيد",
    copyUrl: "نسخ الرابط",
    copiedUrl: "تم النسخ",
    openAsset: "فتح",
    saveAsset: "حفظ",
    stageNoteKeyword: "قل هذا في جلسة Claude Code:",
    stageNoteDocs: "اقرأ توثيق المرحلة",
    channel: "القناة",
    selectChannel: "اختر القنوات",
    channelCount: "{count} قنوات",
    status: "الحالة",
    hermesRow: "بوابة Hermes",
    telegramRow: "بوت تيليجرام",
    facebookRow: "صفحة فيسبوك",
    instagramRow: "حساب إنستغرام",
    connected: "متصل",
    disconnected: "غير متصل",
    parked: "متوقف — غير مُهيّأ",
    checking: "جاري الفحص...",
    lastSeen: "آخر اتصال",
    drainRow: "طابور الصياغة",
    drainLastCheck: "آخر فحص",
    drainNever: "لم يُفحص بعد",
    testConnection: "فحص الاتصالات",
    apiUrl: "رابط البوابة",
    notConfigured: "غير مُهيّأ",
    textareaPlaceholder: "الصق نص المنشور المعتمد هنا…",
    all: "الكل",
    comingSoon: "قريباً",
    reviewHint: "الاعتمادات والإشعارات تذهب إلى ‎#social",
    scheduleLabel: "جدولة في",
    scheduledMsg: "تمت جدولة {count} قناة في {at}",
    scheduleHint:
      "اتركه فارغاً للنشر الآن. المنشورات المجدولة تُنشر خلال ~15 دقيقة من الوقت المحدد.",
    stageForReview: "إرسال للمراجعة",
    staging: "جاري الإرسال...",
    stagedMsg: "تم الإرسال للاعتماد — رابط النشر في قناة المراجعة",
    stagedLocalMsg:
      "تم التجهيز. لا توجد قناة مراجعة مُهيّأة — سلِّم هذه الروابط للمعتمِد بنفسك.",
    reviewLinksTitle:
      "روابط الاعتماد — كل رابط ينشر قناة واحدة، مرة واحدة؛ ينتهي خلال 12 ساعة",
    copyLink: "نسخ",
    copiedLink: "تم النسخ",
    openLink: "فتح",
    mediaLabel: "الوسائط",
    mediaPlaceholder: "https://cdn.databayt.org/… (اختياري، من ‎/higgs)",
    mediaHint:
      "روابط وسائط عامة — المنصات تجلبها بنفسها. صور و/أو فيديو واحد، حتى 10.",
    charCount: "{count} / {max}",
    reviewTitle: "المراجعة والنشر",
    reviewIntro:
      "المسودات المُجابة تصطف هنا لقرار بشري — نقّح ثم اعتمد. الكتابة تجري في مرحلة الصياغة، والوسائط في المعرض.",
    reviewQueueCount: "{count} بانتظار المراجعة",
    reviewNextUp: "التالي",
    reviewRefresh: "تحديث",
    reviewAgo: "قبل {age}",
    reviewEmptyTitle: "لا شيء بانتظار المراجعة",
    reviewEmptyBody:
      "المسودات المُجابة تهبط هنا للاعتماد. اطلب واحدة من الوكيل في مرحلة الصياغة — أو دع بذر الاثنين يقيّد موجزات الأسبوع.",
    reviewEmptyCta: "إلى الصياغة",
    reviewNextDraft: "المسودة التالية",
    approveAction: "اعتمد وانشر",
    approveScheduleAction: "اعتمد وجدول",
    approving: "جاري الاعتماد...",
    approvedNowMsg: "اعتُمد ونُشر.",
    dismissAction: "استبعاد",
    dismissing: "جاري الاستبعاد...",
    dismissedMsg: "استُبعد — لن يُنشر.",
    approveModeLabel: "عند اعتماد مسودة",
    approveModeNow: "انشر فوراً",
    approveModeNowHint: "الاعتماد يوصّل إلى القنوات المختارة في الحال.",
    approveModeSchedule: "جدولة لوقت لاحق",
    approveModeScheduleHint:
      "الاعتماد يضع المنشور في الطابور؛ مهمة الجدولة توصّله خلال ~15 دقيقة من الوقت المحدد.",
    attachAddUrl: "أضف وسائط برابط",
    attachAddAction: "إضافة",
    attachRemove: "إزالة",
    attachBrowse: "تصفّح المعرض",
    mediaKindVideo: "فيديو",
    mixedMediaWarning:
      "لا تجتمع الصور والفيديو في منشور واحد — أبقِ نوعاً واحداً واجعل الآخر منشوراً مستقلاً.",
    attachAsset: "إرفاق",
    attachedAsset: "أُرفق",
    attachOpenPublish: "افتح مرحلة النشر",
    agentTitle: "وكيل التواصل",
    agentHint:
      "كلما كان الموجز أدقّ، كان النص أفضل: الخبر، ولمن هو، وما المطلوب من القارئ، وأي تاريخ أو اسم أو رابط يجب أن يظهر. يكتبه Claude على اشتراك الفريق، بالعربية أولًا ومعها الإنجليزية.",
    agentLead: "صِف المنشور، أو",
    agentScrollText: "اطّلع على ما نُشر بالفعل",
    // The token stays ASCII — `fill` matches {\w+}, which Arabic letters are not.
    agentPlaceholder: "اكتب منشوراً لـ {brand} عن ..",
    agentPlaceholderMore: "صياغة أخرى…",
    agentDrafting: "في الانتظار — Claude يكتبه الآن.",
    agentQueuedHint:
      "الصياغة تعمل على اشتراك الفريق في Claude، فتصل في دقائق لا ثوانٍ. اترك الصفحة مفتوحة — تُحدّث نفسها.",
    agentDrainFresh:
      "تفقّدت جلسة صياغة الطابور قبل {minutes} دقيقة — ترتيبك {position}.",
    agentDrainStale: "لا توجد جلسة صياغة تراقب الطابور الآن — طلبك محفوظ.",
    agentStillQueued:
      "ما زال في الطابور — لم تلتقطه أي جلسة. طلبك محفوظ؛ الطلبات غير المُجابة تنتهي بعد ساعة.",
    agentCheckAgain: "تحقّق مجدداً",
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
    agentDraftMedia: "الوسائط المقترحة",
    agentTrayHint: "{count} وسائط في الحافظة — سترافق الطلب التالي.",
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
