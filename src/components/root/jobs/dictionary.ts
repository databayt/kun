import { type Locale } from "@/components/local/config";

export interface JobsDict {
  title: string;
  description: string;
  announcementText: string;
  primaryAction: string;
  secondaryAction: string;
  analyzeNewJob: string;
  analyzeButton: string;
  analyzingText: string;
  inputPlaceholder: string;
  urlPlaceholder: string;
  profileTab: string;
  opportunitiesTab: string;
  filterAll: string;
  filterHighPriority: string;
  filterRemote: string;
  overallMatch: string;
  technicalMatch: string;
  capabilityMatch: string;
  domainMatch: string;
  experienceMatch: string;
  whyMatches: string;
  strongEvidence: string;
  criticalGaps: string;
  niceToHaveGaps: string;
  talkingPoints: string;
  pushToTwenty: string;
  pushedToCRM: string;
  evidenceTitle: string;
  evidenceSubtitle: string;
  verifiedRepos: string;
  capabilitiesCount: string;
  technologiesCount: string;
}

export const jobsDictionaries: Record<Locale, JobsDict> = {
  ar: {
    title: "محرك الوظائف | Databayt Job Engine",
    description:
      "مطابقة الفرص الوظيفية العالمية بناءً على الأدلة الهندسية الحقيقية المستخرجة من مستودعات ومشاريع Databayt بدلاً من الكلمات المفتاحية.",
    announcementText: "نظام التقييم القائم على الأدلة — محرك الوظائف",
    primaryAction: "استعراض ملف المعرفة الهندسية",
    secondaryAction: "توثيق المحرك",
    analyzeNewJob: "تحليل ومطابقة فرصة وظيفية جديدة",
    analyzeButton: "تحليل ومطابقة الفرصة",
    analyzingText: "جارٍ استخراج المتطلبات والمطابقة بالأدلة...",
    inputPlaceholder:
      "الصق نص الإعلان الوظيفي الكامل هنا (المتطلبات، الوصف، المسؤوليات)...",
    urlPlaceholder: "رابط الوظيفة (اختياري)...",
    profileTab: "ملف المعرفة والأدلة",
    opportunitiesTab: "الفرص المقيمة",
    filterAll: "جميع الفرص",
    filterHighPriority: "أولوية قصوى (85%+)",
    filterRemote: "عن بُعد فقط",
    overallMatch: "التوافق الإجمالي",
    technicalMatch: "التوافق التقني",
    capabilityMatch: "توافق القدرات والمعمارية",
    domainMatch: "توافق النطاق والمنتج",
    experienceMatch: "واقعية المنصب والخبرة",
    whyMatches: "لماذا تناسبك هذه الوظيفة؟ (التفسير)",
    strongEvidence: "أقوى الأدلة من مشاريعك",
    criticalGaps: "الفجوات الحرجة (إن وُجدت)",
    niceToHaveGaps: "مهارات إضافية ثانوية",
    talkingPoints: "نقاط الحديث للمقابلة والتقديم",
    pushToTwenty: "مزامنة إلى Twenty CRM",
    pushedToCRM: "تمت المزامنة إلى CRM",
    evidenceTitle: "ملف المعرفة الهندسية المستخرج من المستودعات",
    evidenceSubtitle:
      "تم تحليل كود ومشاريع Databayt محلياً لاستخراج القدرات الحقيقية المثبتة.",
    verifiedRepos: "مستودعات موثقة",
    capabilitiesCount: "قدرات معمارية مثبتة",
    technologiesCount: "تقنيات تم بناؤها فعلياً",
  },
  en: {
    title: "Job Engine | Databayt",
    description:
      "Evidence-based job matching comparing market opportunities against real architectural proof extracted from Databayt repositories.",
    announcementText: "Evidence-Based Matching System — Job Engine",
    primaryAction: "View Engineering Knowledge Profile",
    secondaryAction: "Documentation",
    analyzeNewJob: "Analyze & Match New Job Opportunity",
    analyzeButton: "Analyze & Evaluate Match",
    analyzingText: "Extracting requirements and verifying evidence...",
    inputPlaceholder:
      "Paste full job description here (requirements, responsibilities, tech stack)...",
    urlPlaceholder: "Job posting URL (optional)...",
    profileTab: "Evidence Knowledge Profile",
    opportunitiesTab: "Evaluated Opportunities",
    filterAll: "All Opportunities",
    filterHighPriority: "High Priority (85%+)",
    filterRemote: "Remote Only",
    overallMatch: "Overall Match",
    technicalMatch: "Technical Match",
    capabilityMatch: "Capability & Architecture",
    domainMatch: "Product Domain Fit",
    experienceMatch: "Seniority Realism",
    whyMatches: "Why This Job Matches (Explainable Assessment)",
    strongEvidence: "Strongest Repository Evidence",
    criticalGaps: "Critical Blocker Gaps",
    niceToHaveGaps: "Secondary / Learnable Skills",
    talkingPoints: "Evidence-Grounded Talking Points",
    pushToTwenty: "Push to Twenty CRM",
    pushedToCRM: "Synced to CRM",
    evidenceTitle: "Databayt Engineering Knowledge Profile",
    evidenceSubtitle:
      "Directly verified capabilities extracted from active repositories on disk.",
    verifiedRepos: "Verified Repositories",
    capabilitiesCount: "Proven Capabilities",
    technologiesCount: "Verified Technologies",
  },
};

export function getJobsDict(locale: Locale): JobsDict {
  return jobsDictionaries[locale] || jobsDictionaries.en;
}
