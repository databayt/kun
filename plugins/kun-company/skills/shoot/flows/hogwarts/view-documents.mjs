// View documents — the exam and grade templates a school prints from, opened and shot, nothing saved.
import { tour } from "./_tour.mjs"
export { initScript } from "./_tour.mjs"

// the app route it films → cdn.databayt.org/hogwarts/<lang>/grades/templates/grade-templates.avif
export const route = "grades/templates"
export const block = "documents"
export const paths = ["src/components/school-dashboard/documents"]
export const title = ["قوالب المستندات", "Document templates"]
export const alt = {
  "exam-templates": ["قوالب أوراق الامتحانات", "Exam paper templates"],
  "grade-templates": ["قوالب الشهادات وكشوف الدرجات", "Certificate and grade sheet templates"],
}
export default tour([
  ["exam-templates", "/ar/exams/templates"],
  ["grade-templates", "/ar/grades/templates"],
])
