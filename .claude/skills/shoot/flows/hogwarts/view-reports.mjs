// View reports — the term's report cards, opened and shot, nothing generated.
// /ar/exams/report-cards and /ar/grades/reports land on the same report-cards tab, so one still.
import { tour } from "./_tour.mjs"
export { initScript } from "./_tour.mjs"

// the app route it films → cdn.databayt.org/hogwarts/<lang>/grades/reports/report-cards.avif
export const route = "grades/reports"
export const block = "reports"
export const paths = ["src/components/school-dashboard/reports"]
export const title = ["الشهادات والتقارير", "Report cards and reports"]
export const alt = {
  "report-cards": ["شهادات الطلاب للفصل الدراسي جاهزة للنشر والتنزيل", "The term's report cards, ready to publish and download"],
}
export default tour([["report-cards", "/ar/grades/reports"]])
