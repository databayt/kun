// Feature hero: exam — /<lang>/features/exam.
import { feature } from "./_feature.mjs"
export { initScript } from "./_feature.mjs"
export const route = "features/exam"
export const block = "exams"
export const paths = ["src/components/school-dashboard/exams"]
export const title = ["الامتحانات", "Exam"]
export const alt = {
  results: ["تحليل النتائج", "Results analytics"],
  manage: ["إدارة الامتحانات", "Managing exams"],
  qbank: ["بنك الأسئلة", "The question bank"],
}
export default feature([
  ["results", "/ar/exams/result/analytics"],
  ["manage", "/ar/exams/manage", null, "tbody tr:visible"],
  ["qbank", "/ar/exams/qbank", null, "tbody tr:visible"],
])
