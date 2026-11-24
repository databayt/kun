// Feature hero: dashboard — /<lang>/features/dashboard, the admin's home, top and further down.
import { feature, scrollTo } from "./_feature.mjs"
export { initScript } from "./_feature.mjs"
export const route = "features/dashboard"
export const block = "dashboard"
export const paths = ["src/components/school-dashboard/dashboard"]
export const title = ["لوحة التحكم", "Dashboard"]
export const alt = {
  top: ["لوحة تحكم المدير", "The admin dashboard"],
  middle: ["مؤشرات المدرسة", "School indicators"],
}
export default feature([
  ["top", "/ar/dashboard"],
  ["middle", null, scrollTo(650)],
])
