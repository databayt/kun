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
    // buttons, so they are one tab. Plan still has no in-app state — the calendar
    // produces a table — so its tab says where the stage runs. Media gained state
    // with the seat lane: its renderer is a person, and a person needs a queue.
    tabCalendar: "Calendar",
    tabDraft: "Draft",
    tabMedia: "Media",
    tabPublish: "Publish",
    tabMeasure: "Measure",
    tabsLabel: "Pipeline stage",
    // The calendar panel — pillars.json rendered as the recurring plan.
    calendarTitle: "The calendar",
    calendarIntro:
      "The recurring plan: each brand's briefs rotate into the draft queue by ISO week. Editing content/social/pillars.json IS editing the calendar.",
    calendarWeek: "Week {week}",
    calendarSeedNote:
      "Seeds Mondays 07:00 — {count} briefs a week, rotation is stateless.",
    calendarThisWeek: "This week",
    calendarQueueNow: "Queue now",
    calendarQueueing: "Queueing...",
    calendarAskedRecently: "asked within 14 days",
    calendarStatePending: "In the draft queue",
    calendarStateAnswered: "Answered — in review",
    calendarStateConsumed: "Approved",
    calendarStateDismissed: "Dismissed",
    calendarStateFailed: "Failed",
    calendarNoPillars:
      "No briefs for this brand yet — add them to content/social/pillars.json and the rotation picks them up.",
    // The showroom — the Media stage's gallery of generated assets and kept
    // references. Copy is never rendered into AI images (typography breaks,
    // Arabic doubly so); text-bearing formats render on the template lane.
    showroomTitle: "The showroom",
    showroomIntro:
      "What we generated and what we keep as reference. Text-free visuals come from Higgsfield or a ChatGPT seat working the brief queue below; text-bearing formats render from HTML templates in the house type. Attach an asset here and it rides the Publish stage's tray.",
    collectionAll: "All",
    collectionGenerated: "Generated",
    collectionReference: "References",
    decksTitle: "Rendered decks",
    // The brief queue — the seat lane's whole surface. A person holding a
    // ChatGPT seat cannot be called by a server, so the work comes to them as
    // a list and the render comes back as an upload.
    briefQueueTitle: "Briefs waiting",
    briefQueueIntro:
      "Compiled prompts waiting for a render. Copy one, paste it into the Hogwarts Media project in ChatGPT, then bring the image back here — it lands in the showroom and the Publish tray.",
    briefQueueEmpty: "Nothing waiting. File a brief below.",
    briefCopyPrompt: "Copy prompt",
    briefCopied: "Copied",
    briefUpload: "Upload render",
    briefUploading: "Uploading…",
    briefDismiss: "Dismiss",
    briefFileTitle: "File a brief",
    briefFileSubject: "The scene, in one line",
    briefFileSubmit: "File it",
    briefFiling: "Filing…",
    briefTypeLabel: "Type",
    briefRendered: "Rendered",
    showroomEmpty: "Nothing matches these filters.",
    assetCredits: "credits",
    copyUrl: "Copy URL",
    copiedUrl: "Copied",
    openAsset: "Open",
    saveAsset: "Save",
    stageNoteKeyword: "Say this in a Claude Code session:",
    stageNoteDocs: "Read the stage docs",
    hermesRow: "Hermes Gateway",
    slackRow: "Slack Review",
    facebookRow: "Facebook Page",
    instagramRow: "Instagram Account",
    connected: "Connected",
    disconnected: "Disconnected",
    // Deliberately unconfigured (Hermes parked) — a choice,
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
    // The queue's search bar. One box, two row kinds: find a draft, or send
    // what you just typed.
    spotlightPlaceholder: "Search the queue, or type a post and press Enter",
    spotlightSend: "Send to {brand}",
    spotlightSendTooShort: "Type a little more to send it",
    spotlightSentTo: "Sent to {brand}.",
    spotlightNoDrafts: "No drafts match — Enter still sends what you typed.",
    spotlightQueueEmpty: "Nothing in the queue for this brand.",
    spotlightOtherBrands: "Other brands — opening one switches the brand",
    spotlightBrandCount: "{count} for {brand}",
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
    // The craft gate (content/docs/social/copy.mdx). A reviewer reads the whole
    // post at once and mentally supplies context a scroller never has, so the
    // first line is shown alone — that is check 1 made physically visible.
    hookStripLabel: "What a scroller sees",
    hookStripEmpty: "The first line lands here.",
    craftCheck1: "Read only the line above. Would you keep reading?",
    craftCheck2: "Say the post's one claim in five words. Can you?",
    craftCheck4: "Point at the sentence where you recognise your own week.",
    craftCheck6: "One thing to do at the end — one verb, one destination.",
    // The mechanical half (src/lib/craft.ts). `craftCheckShort` prefixes a check
    // number inside an LTR run, so it stays a bare word rather than a sentence.
    craftCheckShort: "check ",
    craftMore: "+{count} more",
    // Dismiss reasons ride the note field that already exists. Naming the failed
    // check is the only feedback the writing side ever gets.
    dismissReasonTitle: "Why is it not shipping?",
    dismissReasonHook: "No hook",
    dismissReasonTwoPosts: "Two posts in one",
    dismissReasonUntrue: "Not true",
    dismissReasonRegister: "Wrong register",
    dismissReasonCta: "The ask is wrong",
    dismissReasonLength: "Wrong length",
    dismissReasonOther: "Something else",
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
    // The knobs — the direction a contributor gives without writing prose about
    // it. Vocabulary is copy.mdx's, so a reviewer and a writer name the same
    // things (see components/root/social/knobs.ts).
    agentAngleLabel: "Angle",
    agentAngleAuto: "Let the writer pick",
    agentRegisterLabel: "Register",
    agentRegisterAuto: "The brand's usual rung",
    agentReferenceLabel: "Like this one",
    agentReferenceNone: "No reference",
    agentReferenceEmpty: "Nothing published for this brand yet.",
    agentReferenceShipped: "shipped",
    // Turn 2 and beyond: the same box, now a reply box.
    agentRefinePlaceholder: "What should change? — sharper hook, half as long…",
    agentTurnBadge: "v{turn}",
    agentRefinedFor: "Asked for: {instruction}",
    agentRefineHint:
      "Type what to change and it rewrites this draft — the rest stays as it is. Start new begins a different post.",
    // The reasoning panel — the real queue, not invented thinking.
    agentThinking: "Waiting on the draft queue…",
    agentThought: "Waited {seconds} seconds",
    agentReasoning:
      "1. **Queued** — your brief is saved to the draft queue under {brand}.\n2. **Claimed** — a Claude Code session on the team subscription takes the oldest pending ask.\n3. **Written** — Arabic is crafted first, English mirrored beside it.\n4. **Delivered** — the answer lands here; this window polls every few seconds.\n\nThis is not an API call. Drafting runs on the subscription, so it lands in minutes rather than seconds.",
    agentPipStreaming: "Streaming…",
    agentPipDone: "Ready",
    agentPipFailed: "Failed",
    agentPipRejected: "Rejected",
    agentDraftMedia: "Suggested media",
    agentTrayHint: "{count} media in tray — will ride the next ask.",
    // Media Studio — prompt area on /social/media
    mediaStudioTitle: "Media Studio",
    mediaStudioLead: "Compile a prompt for the renderer lanes, or",
    mediaStudioScroll: "browse the showroom gallery",
    mediaStudioPlaceholder:
      "Describe the visual scene, video action, or listing showcase for {brand}…",
    mediaStudioPlaceholderMore: "Direct another scene…",
    mediaPromptPillTitle: "Direct media generation",
    mediaLaneLabel: "Lane / Model",
    mediaLaneVideo: "Video Reel (Seedance / Veo)",
    mediaLaneImage: "4K Photo Plate (Gemini / ChatGPT)",
    mediaLaneTemplate: "Card Template (HTML / Canvas)",
    mediaRatioLabel: "Ratio",
    mediaSpineLabel: "Style Spine",
    mediaPresetMadePossible: "Made possible by Hosts · Port Sudan",
    mediaPresetCoastalBalcony: "Coastal Balcony overlooking Red Sea",
    mediaPresetBreezyFlat: "Breezy 2-Bedroom Family Flat",
    mediaPresetLibraryStudy: "Student studying in modern library",
    mediaPresetDeskMockup: "Minimalist desk & dashboard mockup",
    mediaCompiledTitle: "Compiled Prompt Directive",
    mediaCopyPrompt: "Copy prompt",
    mediaCopiedPrompt: "Copied",
    mediaFileQueue: "File to Brief Queue",
    mediaFilingQueue: "Filing…",
    mediaFiledQueue: "Filed to queue",
    mediaAttachDraft: "Attach to social draft",
    mediaDraftCopy: "Draft copy",
    mediaVisualPreview: "Live Visual Card Preview",
    mediaGenerateImage: "Generate Image",
    mediaGeneratingImage: "Generating…",
    mediaRunIn: "Run in",
    mediaRenderNote:
      "The studio compiles a prompt — it does not render. Pick where you will run it; the preview below is a library still or a template plate, never this model's output.",
    mediaGeneratedTitle: "Studio result",
    mediaDownloadImage: "Download",
    mediaSaveShowroom: "Save to Showroom",
    mediaSavedShowroom: "Saved to Showroom",
    mediaUseInStudio: "Use in Studio",
    mediaLoadedRef: "Loaded into Media Studio",
    mediaStartNew: "Start new",
    // The compiled-brief surface — one prompt, one copy, and the files a human
    // has to attach by hand because a model cannot fetch a URL.
    mediaPlanLabel: "From the plan",
    mediaPlanNone: "No plan for this brand yet",
    mediaPlanLastWeek: "Last week",
    mediaPlanThisWeek: "This week",
    mediaPlanNextWeek: "Next week",
    mediaPlanFree: "No pillar — describe it yourself",
    mediaTypeLabel: "Asset type",
    mediaPlatformLabel: "Platform",
    mediaPlatformAny: "Any platform",
    mediaCompile: "Compile brief",
    mediaBriefTitle: "Brief",
    mediaAttachTitle: "Attach before sending",
    mediaAttachHint:
      "A model cannot fetch a URL — download each file and attach it to the chat.",
    mediaNoAttachments: "Nothing to attach.",
    mediaDeckNotice:
      "This type carries copy, so it renders on the template lane — not an image model.",
    mediaWarnings: "Worth knowing",
    mediaDirecting: "Compiling visual directives for {brand}…",
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
    calendarTitle: "التقويم",
    calendarIntro:
      "الخطة الدورية: موجزات كل علامة تدور إلى طابور الصياغة بأسبوع السنة. تعديل content/social/pillars.json هو تعديل التقويم نفسه.",
    calendarWeek: "الأسبوع {week}",
    calendarSeedNote:
      "يُبذر كل اثنين 07:00 — {count} موجزات أسبوعياً، والدوران بلا حالة.",
    calendarThisWeek: "هذا الأسبوع",
    calendarQueueNow: "قيّده الآن",
    calendarQueueing: "جاري التقييد...",
    calendarAskedRecently: "طُلب خلال 14 يوماً",
    calendarStatePending: "في طابور الصياغة",
    calendarStateAnswered: "أُجيب — في المراجعة",
    calendarStateConsumed: "اعتُمد",
    calendarStateDismissed: "استُبعد",
    calendarStateFailed: "فشل",
    calendarNoPillars:
      "لا موجزات لهذه العلامة بعد — أضفها إلى content/social/pillars.json ليلتقطها الدوران.",
    showroomTitle: "المعرض",
    showroomIntro:
      "ما ولّدناه وما نحتفظ به كمرجع. الصور بلا نصوص تأتي من Higgsfield أو من مقعد ChatGPT عبر طابور الموجزات بالأسفل؛ والقوالب النصية تُصاغ من HTML بخط الدار. أرفق أصلاً من هنا يهبط في حافظة مرحلة النشر.",
    collectionAll: "الكل",
    collectionGenerated: "المولَّد",
    collectionReference: "المراجع",
    decksTitle: "الكاروسيلات المُصيَّرة",
    briefQueueTitle: "موجزات بانتظار التنفيذ",
    briefQueueIntro:
      "أوامر جاهزة تنتظر من يصيّرها. انسخ واحداً والصقه في مشروع Hogwarts Media داخل ChatGPT، ثم أعد الصورة إلى هنا — تهبط في المعرض وفي حافظة النشر.",
    briefQueueEmpty: "لا شيء بالانتظار. سجّل موجزاً بالأسفل.",
    briefCopyPrompt: "نسخ الأمر",
    briefCopied: "نُسخ",
    briefUpload: "رفع الصورة",
    briefUploading: "جارٍ الرفع…",
    briefDismiss: "تجاهل",
    briefFileTitle: "تسجيل موجز",
    briefFileSubject: "المشهد في سطر واحد",
    briefFileSubmit: "سجّله",
    briefFiling: "جارٍ التسجيل…",
    briefTypeLabel: "النوع",
    briefRendered: "مُصيَّر",
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
    slackRow: "مراجعة سلاك",
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
    spotlightPlaceholder: "ابحث في الطابور، أو اكتب منشوراً واضغط Enter",
    spotlightSend: "أرسل إلى {brand}",
    spotlightSendTooShort: "اكتب أكثر قليلاً لإرساله",
    spotlightSentTo: "أُرسل إلى {brand}.",
    spotlightNoDrafts: "لا مسودة تطابق — وEnter يرسل ما كتبته.",
    spotlightQueueEmpty: "لا شيء في طابور هذه العلامة.",
    spotlightOtherBrands: "علامات أخرى — فتح إحداها يبدّل العلامة",
    spotlightBrandCount: "{count} لـ {brand}",
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
    hookStripLabel: "ما يراه المتصفّح العابر",
    hookStripEmpty: "السطر الأول يظهر هنا.",
    craftCheck1: "اقرأ السطر أعلاه وحده. هل تكمل القراءة؟",
    craftCheck2: "قل دعوى المنشور الواحدة في خمس كلمات. هل تستطيع؟",
    craftCheck4: "أشِر إلى الجملة التي تعرف فيها أسبوعك أنت.",
    craftCheck6: "شيء واحد يُفعل في النهاية — فعل واحد ووجهة واحدة.",
    craftCheckShort: "فحص ",
    craftMore: "و{count} أخرى",
    dismissReasonTitle: "لماذا لا يُنشر؟",
    dismissReasonHook: "لا خُطّاف",
    dismissReasonTwoPosts: "منشوران في واحد",
    dismissReasonUntrue: "غير صحيح",
    dismissReasonRegister: "مستوى لغوي خاطئ",
    dismissReasonCta: "الدعوة غير صحيحة",
    dismissReasonLength: "الطول غير مناسب",
    dismissReasonOther: "سبب آخر",
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
    agentAngleLabel: "الزاوية",
    agentAngleAuto: "اترك الاختيار للكاتب",
    agentRegisterLabel: "الدرجة اللغوية",
    agentRegisterAuto: "درجة العلامة المعتادة",
    agentReferenceLabel: "على غرار هذا",
    agentReferenceNone: "بدون مرجع",
    agentReferenceEmpty: "لا يوجد منشور سابق لهذه العلامة بعد.",
    agentReferenceShipped: "نُشر",
    agentRefinePlaceholder: "ما الذي تريد تغييره؟ — خُطّاف أقوى، نصف الطول…",
    agentTurnBadge: "نسخة {turn}",
    agentRefinedFor: "طُلب: {instruction}",
    agentRefineHint:
      "اكتب ما تريد تغييره فتُعاد صياغة هذه المسودة وحدها، ويبقى الباقي كما هو. «ابدأ من جديد» يفتح منشورًا آخر.",
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

    // Media Studio — prompt area on /social/media
    mediaStudioTitle: "استوديو الوسائط",
    mediaStudioLead: "اكتب موجّهًا جاهزًا لمسارات التوليد، أو",
    mediaStudioScroll: "استعرض المعرض والمكتبة",
    mediaStudioPlaceholder:
      "صف المشهد البصري أو حركة الفيديو أو إبراز العقار لـ {brand}…",
    mediaStudioPlaceholderMore: "وجّه مشهدًا آخر…",
    mediaPromptPillTitle: "توجيه توليد الوسائط",
    mediaLaneLabel: "المسار / النموذج",
    mediaLaneVideo: "فيديو ريل (Seedance / Veo)",
    mediaLaneImage: "صورة 4K نقية (Gemini / ChatGPT)",
    mediaLaneTemplate: "قالب بطاقة (HTML / Canvas)",
    mediaRatioLabel: "الأبعاد",
    mediaSpineLabel: "النمط البصري",
    mediaPresetMadePossible: "أصبح ممكنًا بفضل المضيف · بورتسودان",
    mediaPresetCoastalBalcony: "شرفة ساحلية تطل على البحر الأحمر",
    mediaPresetBreezyFlat: "شقة عائلية مشرقة بغرفتين وصالة",
    mediaPresetLibraryStudy: "طالب يدرس في مكتبة حديثة",
    mediaPresetDeskMockup: "مكتب بتصميم أنيق ولوحة بيانات",
    mediaCompiledTitle: "التوجيه البصري المُجمّع",
    mediaCopyPrompt: "نسخ الأمر",
    mediaCopiedPrompt: "تم النسخ",
    mediaFileQueue: "إرسال لطابور الإنتاج",
    mediaFilingQueue: "جارٍ الإرسال…",
    mediaFiledQueue: "تمت الإضافة للطابور",
    mediaAttachDraft: "إرفاق بالمسودة الاجتماعية",
    mediaDraftCopy: "صياغة منشور",
    mediaVisualPreview: "معاينة بصرية حية للبطاقة",
    mediaGenerateImage: "توليد الصورة",
    mediaGeneratingImage: "جارٍ التوليد…",
    mediaRunIn: "شغّل في",
    mediaRenderNote:
      "الاستوديو يجمّع الوصف ولا يولّد الصورة. اختر أين ستشغّله؛ ما يظهر أدناه صورة من المكتبة أو لوح قالب، وليس ناتج هذا النموذج.",
    mediaGeneratedTitle: "نتيجة الاستوديو",
    mediaDownloadImage: "تنزيل",
    mediaSaveShowroom: "حفظ في المعرض",
    mediaSavedShowroom: "تم الحفظ في المعرض",
    mediaUseInStudio: "استخدم كمرجع في الاستوديو",
    mediaLoadedRef: "تم التحميل في استوديو الوسائط",
    mediaStartNew: "مشهد جديد",
    mediaPlanLabel: "من الخطة",
    mediaPlanNone: "لا خطة لهذه العلامة بعد",
    mediaPlanLastWeek: "الأسبوع الماضي",
    mediaPlanThisWeek: "هذا الأسبوع",
    mediaPlanNextWeek: "الأسبوع القادم",
    mediaPlanFree: "بلا محور — صِف المشهد بنفسك",
    mediaTypeLabel: "نوع الأصل",
    mediaPlatformLabel: "المنصة",
    mediaPlatformAny: "أي منصة",
    mediaCompile: "جهّز الموجز",
    mediaBriefTitle: "الموجز",
    mediaAttachTitle: "أرفق قبل الإرسال",
    mediaAttachHint:
      "النموذج لا يستطيع جلب رابط — نزّل كل ملف وأرفقه بالمحادثة.",
    mediaNoAttachments: "لا مرفقات.",
    mediaDeckNotice:
      "هذا النوع يحمل نصًا، لذا يُنتَج على مسار القوالب — لا على نموذج صور.",
    mediaWarnings: "ملاحظات",
    mediaDirecting: "جارٍ تجميع التوجيهات البصرية لـ {brand}…",
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
