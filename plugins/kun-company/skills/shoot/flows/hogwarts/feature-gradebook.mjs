// Feature hero: gradebook — /<lang>/features/gradebook.
import { feature } from "./_feature.mjs"
export { initScript } from "./_feature.mjs"
export const route = "features/gradebook"
export const block = "grades"
export const paths = ["src/components/school-dashboard/listings/grades"]
export const title = ["سجل الدرجات", "Gradebook"]
export const alt = {
  overview: ["الدرجات", "Grades"],
  book: ["سجل الدرجات", "The gradebook"],
  reports: ["تقارير الدرجات", "Grade reports"],
}
export default feature([
  ["overview", "/ar/grades"],
  ["book", "/ar/grades/book", null, "tbody tr:visible"],
  ["reports", "/ar/grades/reports"],
])
