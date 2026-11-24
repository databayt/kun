// Feature hero: admission — /<lang>/features/admission.
import { feature } from "./_feature.mjs"
export { initScript } from "./_feature.mjs"
export const route = "features/admission"
export const block = "admission"
export const paths = ["src/components/school-dashboard/admission"]
export const title = ["القبول", "Admission"]
export const alt = {
  campaigns: ["حملات القبول", "Admission campaigns"],
  enrollment: ["التسجيل", "Enrollment"],
  merit: ["قائمة الترتيب", "The merit list"],
}
export default feature([
  ["campaigns", "/ar/admission"],
  ["enrollment", "/ar/admission/enrollment"],
  ["merit", "/ar/admission/merit"],
])

// Animated hero (no stills): hero.mjs renders motion/hogwarts/feature-admission.html at the page
// band's ratio instead of shooting the screens above. Names are fictional; scores 50–100.
export const anim = {
  size: "2400x720",
  ar: {
    s: {
      campaign: "قبول 2026–2027", open: "مفتوح", meta: "من الروضة إلى الصف السادس · 120 مقعداً",
      total: "248", applications: "طلب التحاق", trend: "+12% هذا الأسبوع", newApp: "طلب جديد",
      cols: ["مُقدَّم", "قيد المراجعة", "مقبول"], accepted: "مقبول",
      merit: "قائمة الترتيب", meritSub: "حسب الدرجة",
    },
    people: [
      { name: "سارة أحمد", init: "س", grade: "الصف الأول", score: 94 },
      { name: "عمر خالد", init: "ع", grade: "روضة 2", score: 86 },
      { name: "لينا حسن", init: "ل", grade: "الصف الثالث", score: 91 },
      { name: "يوسف علي", init: "ي", grade: "الصف الأول", score: 78 },
      { name: "مايا إدريس", init: "م", grade: "الصف الخامس", score: 97 },
      { name: "آدم نور", init: "آ", grade: "الصف الثاني", score: 83 },
    ],
  },
  en: {
    s: {
      campaign: "Admission 2026–27", open: "Open", meta: "KG to Grade 6 · 120 seats",
      total: "248", applications: "applications", trend: "+12% this week", newApp: "New application",
      cols: ["Submitted", "In review", "Accepted"], accepted: "Accepted",
      merit: "Merit list", meritSub: "by score",
    },
    people: [
      { name: "Sara Ahmed", init: "SA", grade: "Grade 1", score: 94 },
      { name: "Omar Khalid", init: "OK", grade: "KG 2", score: 86 },
      { name: "Lina Hassan", init: "LH", grade: "Grade 3", score: 91 },
      { name: "Yusuf Ali", init: "YA", grade: "Grade 1", score: 78 },
      { name: "Maya Idris", init: "MI", grade: "Grade 5", score: 97 },
      { name: "Adam Nour", init: "AN", grade: "Grade 2", score: 83 },
    ],
  },
}
