// Track transport — the transport dashboard and the bus routes, opened and shot, nothing saved.
import { tour } from "./_tour.mjs"
export { initScript } from "./_tour.mjs"

// the app route it films → cdn.databayt.org/hogwarts/<lang>/transportation/overview.avif
export const route = "transportation"
export const block = "transportation"
export const paths = ["src/components/school-dashboard/transportation"]
export const title = ["النقل المدرسي", "School transport"]
export const alt = {
  overview: ["لوحة النقل المدرسي", "The school transport dashboard"],
  routes: ["خطوط الحافلات ومحطاتها", "Bus routes and their stops"],
}
export default tour([
  ["overview", "/ar/transportation"],
  ["routes", "/ar/transportation/routes"],
])
