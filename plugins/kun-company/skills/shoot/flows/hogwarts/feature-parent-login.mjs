// Feature hero: parent login — /<lang>/features/parent-login, signed in as the demo guardian.
import { feature } from "./_feature.mjs"
export { initScript } from "./_feature.mjs"
export const route = "features/parent-login"
export const block = "parent-portal"
export const paths = ["src/components/school-dashboard/parent"]
export const title = ["بوابة ولي الأمر", "Parent Login"]
export const role = "guardian"
export const alt = {
  home: ["الصفحة الرئيسية لولي الأمر", "A parent's home"],
  announcements: ["إعلانات المدرسة لولي الأمر", "School announcements for parents"],
  fees: ["رسوم الأبناء", "The children's fees"],
}
export default feature([
  ["home", "/ar/dashboard"],
  ["announcements", "/ar/parent/announcements"],
  ["fees", "/ar/parent/fees"],
])
