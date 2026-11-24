// Switch language — the same dashboard in Arabic (right to left) and English (left to right);
// shot with --lang ar,en, one still per language.
import { tour } from "./_tour.mjs"
export { initScript } from "./_tour.mjs"

// the app route it films → cdn.databayt.org/hogwarts/<lang>/dashboard/language/dashboard.avif
export const route = "dashboard/language"
export const block = "dashboard"
export const paths = ["src/components/school-dashboard/dashboard"]
export const title = ["العربية والإنجليزية", "Arabic and English"]
export const alt = {
  dashboard: ["لوحة التحكم بلغة الواجهة واتجاهها", "The dashboard in its language and direction"],
}
export default tour([["dashboard", "/ar/dashboard"]])
