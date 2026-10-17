import type { Locale } from "@/components/local/config";

export interface SeekDict {
  eyebrow: string;
  title: string;
  description: string;
  primaryAction: string;
  secondaryAction: string;
  loopTitle: string;
  loopSubtitle: string;
  steps: { title: string; body: string }[];
  tracksTitle: string;
  tracksSubtitle: string;
  live: string;
  soon: string;
  documents: string;
  artifacts: Record<string, string>;
  installTitle: string;
  installSubtitle: string;
  install: { title: string; body: string; code?: string }[];
  privateNote: string;
  boardLink: string;
}

const ar: SeekDict = {
  eyebrow: "سيك · حلقة الفرص",
  title: "ابحث عن الفرصة، وقدّم، وتابع — تلقائيًا",
  description:
    "حلقة مفتوحة تعمل داخل Claude Code لديك: تجمع الفرص المفتوحة، وتكتب سيرة ذاتية وخطابًا مفصّلين لكل فرصة، وتقدّم، وتتابع، ثم تخبرك عندما يرد أحد — «لديك مقابلة».",
  primaryAction: "ابدأ الآن",
  secondaryAction: "التوثيق",
  loopTitle: "الحلقة",
  loopSubtitle: "خمس خطوات تتكرر كل يوم دون أن تفتح بريدك.",
  steps: [
    { title: "اكتشاف", body: "تمسح لوحات الوظائف وبوابات التقديم ونتائج البحث، وتحذف المكرر والمنتهي." },
    { title: "تفصيل", body: "سيرة ذاتية وخطاب تغطية أو عرض أو مقترح مكتوب لهذه الفرصة بالذات، من حقائقك فقط." },
    { title: "تقديم", body: "بالبريد أو البوابة أو النموذج — بحدود يومية ومهلة مراجعة قبل الإرسال." },
    { title: "متابعة", body: "رسالة متابعة في اليوم السابع والرابع عشر، ثم أرشفة هادئة." },
    { title: "إخطار", body: "تقرأ الردود وتصنّفها، وتنبهك فقط لما يهم: رد، مقابلة، عرض." },
  ],
  tracksTitle: "المسارات",
  tracksSubtitle: "الحلقة نفسها، فرص مختلفة. الوظائف تعمل اليوم، والبقية قادمة.",
  live: "يعمل",
  soon: "قريبًا",
  documents: "المستندات",
  artifacts: {
    cv: "سيرة ذاتية",
    "cover-letter": "خطاب تغطية",
    pitch: "عرض تقديمي",
    proposal: "مقترح",
    statement: "خطاب الغرض",
    "form-answers": "إجابات النماذج",
    "document-checklist": "قائمة المستندات",
  },
  installTitle: "شغّلها لنفسك",
  installSubtitle: "تعمل على جهازك وباشتراك Claude الخاص بك. لا حسابات ولا بيانات لدينا.",
  install: [
    { title: "انسخ المستودع", body: "الحلقة ومهارة seek مفتوحتا المصدر.", code: "git clone https://github.com/databayt/kun && cd kun && pnpm install" },
    { title: "املأ ملفك", body: "اسمك وبريدك ومنطقتك الزمنية وحقائق خبرتك — كل خطاب يُكتب منها فقط.", code: "mkdir -p seek && cp scripts/seek/profile.example.json seek/profile.json" },
    { title: "قل «seek»", body: "افتح Claude Code في المجلد واطلب: «seek — ابحث لي عن وظائف مطوّر عن بُعد»." },
  ],
  privateNote: "لوحة النسخة الخاصة بفريقنا محمية بتسجيل الدخول.",
  boardLink: "لوحتي",
};

const en: SeekDict = {
  eyebrow: "Seek · the opportunity loop",
  title: "Find the chance, apply, follow up — on autopilot",
  description:
    "An open loop that runs inside your own Claude Code: it gathers open opportunities, writes a CV and letter tailored to each one, applies, follows up, and tells you when someone answers — \"you got an interview\".",
  primaryAction: "Get started",
  secondaryAction: "Docs",
  loopTitle: "The loop",
  loopSubtitle: "Five beats that repeat every day without you opening your inbox.",
  steps: [
    { title: "Discover", body: "Sweeps job boards, application portals and search results; drops duplicates and expired calls." },
    { title: "Tailor", body: "A CV and cover letter, pitch or proposal written for this one chance — from your facts only." },
    { title: "Apply", body: "By email, portal or form — with daily caps and a review window before anything sends." },
    { title: "Follow up", body: "A nudge on day 7 and day 14, then a quiet archive." },
    { title: "Brief", body: "Reads and classifies replies, and pings you only for what matters: a response, an interview, an offer." },
  ],
  tracksTitle: "Tracks",
  tracksSubtitle: "One loop, different chances. Jobs run today; the rest are on the way.",
  live: "Live",
  soon: "Soon",
  documents: "Documents",
  artifacts: {
    cv: "CV",
    "cover-letter": "Cover letter",
    pitch: "Pitch deck",
    proposal: "Proposal",
    statement: "Personal statement",
    "form-answers": "Form answers",
    "document-checklist": "Document checklist",
  },
  installTitle: "Run it for yourself",
  installSubtitle: "It runs on your machine, on your own Claude subscription. No accounts, and none of your data with us.",
  install: [
    { title: "Clone the repo", body: "The loop and the seek skill are open source.", code: "git clone https://github.com/databayt/kun && cd kun && pnpm install" },
    { title: "Fill in your profile", body: "Your name, email, timezone and career facts — every letter is written from these alone.", code: "mkdir -p seek && cp scripts/seek/profile.example.json seek/profile.json" },
    { title: "Say \"seek\"", body: "Open Claude Code in the folder and ask: \"seek — find me remote developer roles\"." },
  ],
  privateNote: "Our own team's board is behind the login.",
  boardLink: "My board",
};

export function getSeekDict(lang: Locale): SeekDict {
  return lang === "ar" ? ar : en;
}
