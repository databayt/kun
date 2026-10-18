// Enter grades — the gradebook, report cards, transcripts and year-end promotion.
import { tour } from "./_tour.mjs"
export { initScript } from "./_tour.mjs"

// the app route it films → cdn.databayt.org/hogwarts/<lang>/grades/gradebook.avif
export const route = "grades"
export const block = "grades"
export const paths = ["src/components/school-dashboard/listings/grades"]
export const title = ["الدرجات والشهادات", "Grades and report cards"]
export const alt = {
  gradebook: ["سجل الدرجات من الاختبارات والواجبات", "The gradebook: every exam and homework mark"],
  reports: ["إصدار الشهادات ونشرها", "Generating and publishing report cards"],
  transcripts: ["السجلات الأكاديمية برمز تحقق", "Transcripts with a verification code"],
  promotion: ["قواعد الترفيع آخر العام", "Year-end promotion rules"],
}
export default tour([
  ["gradebook", "/ar/grades"],
  ["reports", "/ar/grades/reports"],
  ["transcripts", "/ar/grades/transcripts"],
  ["promotion", "/ar/grades/promotion"],
])
