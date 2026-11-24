// Feature hero: announcement — /<lang>/features/announcement.
import { clickFirst, feature, press } from "./_feature.mjs"
export { initScript } from "./_feature.mjs"
export const route = "features/announcement"
export const block = "announcements"
export const paths = ["src/components/school-dashboard/listings/announcements"]
export const title = ["الإعلانات", "Announcement"]
export const alt = {
  list: ["الإعلانات", "Announcements"],
  grid: ["الإعلانات في عرض البطاقات", "Announcements as cards"],
  detail: ["إعلان", "An announcement"],
}
export default feature([
  ["list", "/ar/announcements"],
  ["grid", null, press(["التبديل إلى عرض الشبكة", "Switch to grid view"])],
  ["detail", "/ar/announcements", clickFirst('a[href*="/announcements/cm"]')],
])
