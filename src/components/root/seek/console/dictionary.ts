import type { Locale } from "@/components/local/config";
import type { StageGroup } from "@/lib/seek/tracks/types";

export interface ConsoleDict {
  announcement: string;
  title: string;
  description: string;
  primaryAction: string;
  secondaryAction: string;
  tabs: { board: string; needs: string; table: string; activity: string; loop: string; profile: string };
  tabsLabel: string;
  groups: Record<StageGroup, string>;
  lastTick: string;
  never: string;
  noData: string;
  sendOff: string;
  pending: string;
  pendingNote: string;
  // item sheet
  open: string;
  posting: string;
  notes: string;
  approve: string;
  hold: string;
  veto: string;
  move: string;
  moveTo: string;
  reason: string;
  reasonPlaceholder: string;
  queuedOk: string;
  score: string;
  lane: string;
  stage: string;
  country: string;
  channel: string;
  deadline: string;
  touch: string;
  updated: string;
  holdReason: string;
  // needs
  needsEmpty: string;
  sendsAfter: string;
  // table
  search: string;
  allLanes: string;
  allStages: string;
  title_: string;
  org: string;
  // activity
  activityEmpty: string;
  kinds: Record<string, string>;
  // loop
  sending: string;
  sendingOn: string;
  sendingOffLabel: string;
  turnOff: string;
  turnOn: string;
  dailyCap: string;
  save: string;
  lanes: string;
  paused: string;
  pause: string;
  resume: string;
  focus: string;
  focusUntil: string;
  week: string;
  learned: string;
  actions: string;
  needFromYou: string;
  addTitle: string;
  addUrl: string;
  addText: string;
  addSubmit: string;
  recent: string;
  status: Record<string, string>;
  tracks: Record<string, string>;
}

const en: ConsoleDict = {
  announcement: "Seek console · live from the loop",
  title: "Seek console",
  description:
    "Every card the loop is working, what waits on you, and the switches — mirrored from the CRM each tick. What you do here applies on the next tick.",
  primaryAction: "Needs me",
  secondaryAction: "Docs",
  tabs: { board: "Board", needs: "Needs me", table: "Table", activity: "Activity", loop: "Loop", profile: "Profile" },
  tabsLabel: "Console views",
  groups: { inbox: "Inbox", needs: "Needs you", in_play: "In play", won: "Won", lost: "Closed" },
  lastTick: "Last tick",
  never: "never",
  noData: "Nothing pushed yet — run `pnpm seek:push --apply` on the loop's machine.",
  sendOff: "Sending is off",
  pending: "pending",
  pendingNote: "Applies on the next tick (every 30 min).",
  open: "Open in CRM",
  posting: "Posting",
  notes: "History",
  approve: "Approve",
  hold: "Hold",
  veto: "Veto send",
  move: "Move",
  moveTo: "Move to…",
  reason: "Reason",
  reasonPlaceholder: "Why it waits",
  queuedOk: "Queued — applies on the next tick.",
  score: "Score",
  lane: "Lane",
  stage: "Stage",
  country: "Country",
  channel: "Channel",
  deadline: "Deadline",
  touch: "Touch",
  updated: "Updated",
  holdReason: "On hold because",
  needsEmpty: "Nothing waits on you.",
  sendsAfter: "sends after",
  search: "Search title or org",
  allLanes: "All lanes",
  allStages: "All stages",
  title_: "Title",
  org: "Organisation",
  activityEmpty: "No loop events in the last 30 days.",
  kinds: {
    sent: "Sent",
    followup: "Follow-up",
    reply: "Reply",
    hold: "Held",
    queued: "Queued",
    archive: "Archived",
    error: "Error",
    console: "Console",
  },
  sending: "Sending",
  sendingOn: "On — the loop sends in its weekday window.",
  sendingOffLabel: "Off — nothing sends until you turn it back on.",
  turnOff: "Turn off",
  turnOn: "Turn on",
  dailyCap: "Daily email cap",
  save: "Save",
  lanes: "Lanes",
  paused: "paused",
  pause: "Pause",
  resume: "Resume",
  focus: "Focus",
  focusUntil: "until",
  week: "This week's report",
  learned: "Learned",
  actions: "Changed",
  needFromYou: "Needs from you",
  addTitle: "Add an opportunity",
  addUrl: "Posting URL",
  addText: "…or paste the posting text",
  addSubmit: "Add to the inbox",
  recent: "Recent commands",
  status: { pending: "pending", applied: "applied", failed: "failed" },
  tracks: { job: "Jobs", funding: "Funding" },
};

const ar: ConsoleDict = {
  announcement: "لوحة سيك · مباشرة من الحلقة",
  title: "لوحة سيك",
  description:
    "كل بطاقة تعمل عليها الحلقة، وما ينتظرك، والمفاتيح — منسوخة من نظام العملاء كل دورة. ما تفعله هنا يُنفَّذ في الدورة التالية.",
  primaryAction: "ينتظرني",
  secondaryAction: "التوثيق",
  tabs: { board: "اللوحة", needs: "ينتظرني", table: "الجدول", activity: "النشاط", loop: "الحلقة", profile: "الملف" },
  tabsLabel: "عروض اللوحة",
  groups: { inbox: "الوارد", needs: "ينتظرك", in_play: "قيد العمل", won: "تحقق", lost: "مغلق" },
  lastTick: "آخر دورة",
  never: "لم تعمل بعد",
  noData: "لم يُرفع شيء بعد — شغّل `pnpm seek:push --apply` على جهاز الحلقة.",
  sendOff: "الإرسال متوقف",
  pending: "معلّق",
  pendingNote: "يُنفَّذ في الدورة التالية (كل ٣٠ دقيقة).",
  open: "افتح في نظام العملاء",
  posting: "الإعلان",
  notes: "السجل",
  approve: "اعتماد",
  hold: "تعليق",
  veto: "أوقف الإرسال",
  move: "نقل",
  moveTo: "انقل إلى…",
  reason: "السبب",
  reasonPlaceholder: "لماذا ينتظر",
  queuedOk: "في الطابور — يُنفَّذ في الدورة التالية.",
  score: "الدرجة",
  lane: "المسار",
  stage: "المرحلة",
  country: "الدولة",
  channel: "القناة",
  deadline: "الموعد النهائي",
  touch: "المحاولة",
  updated: "آخر تحديث",
  holdReason: "معلّق لأن",
  needsEmpty: "لا شيء ينتظرك.",
  sendsAfter: "يُرسل بعد",
  search: "ابحث بالعنوان أو الجهة",
  allLanes: "كل المسارات",
  allStages: "كل المراحل",
  title_: "العنوان",
  org: "الجهة",
  activityEmpty: "لا أحداث في آخر ٣٠ يومًا.",
  kinds: {
    sent: "أُرسل",
    followup: "متابعة",
    reply: "رد",
    hold: "عُلّق",
    queued: "في الطابور",
    archive: "أُرشف",
    error: "خطأ",
    console: "من اللوحة",
  },
  sending: "الإرسال",
  sendingOn: "يعمل — ترسل الحلقة في نافذة أيام العمل.",
  sendingOffLabel: "متوقف — لا يُرسل شيء حتى تعيد تشغيله.",
  turnOff: "أوقف",
  turnOn: "شغّل",
  dailyCap: "الحد اليومي للرسائل",
  save: "حفظ",
  lanes: "المسارات",
  paused: "متوقف",
  pause: "إيقاف",
  resume: "استئناف",
  focus: "التركيز",
  focusUntil: "حتى",
  week: "تقرير هذا الأسبوع",
  learned: "ما تعلمناه",
  actions: "ما تغيّر",
  needFromYou: "مطلوب منك",
  addTitle: "أضف فرصة",
  addUrl: "رابط الإعلان",
  addText: "…أو الصق نص الإعلان",
  addSubmit: "أضف إلى الوارد",
  recent: "آخر الأوامر",
  status: { pending: "معلّق", applied: "نُفّذ", failed: "فشل" },
  tracks: { job: "الوظائف", funding: "التمويل" },
};

export const getConsoleDict = (lang: Locale): ConsoleDict => (lang === "ar" ? ar : en);
