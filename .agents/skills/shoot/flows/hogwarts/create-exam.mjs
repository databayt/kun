// Create exam — the exams overview, a new exam, the manage list and marking.
import { tour } from "./_tour.mjs"
export { initScript } from "./_tour.mjs"

// the app route it films → cdn.databayt.org/hogwarts/<lang>/exams/overview.avif
export const route = "exams"
export const block = "exams"
export const paths = ["src/components/school-dashboard/exams"]
export const title = ["الاختبارات", "Exams"]
export const alt = {
  overview: ["نظرة عامة على الاختبارات", "The exams overview"],
  new: ["إنشاء اختبار: من قالب أو بالذكاء الاصطناعي أو فارغ", "Creating an exam: template, AI or blank"],
  manage: ["إدارة الاختبارات المجدولة", "Managing scheduled exams"],
  mark: ["رصد الدرجات بعد الاختبار", "Marking after the exam"],
}
export default tour([
  ["overview", "/ar/exams"],
  ["new", "/ar/exams/new"],
  ["manage", "/ar/exams/manage"],
  ["mark", "/ar/exams/mark"],
])
