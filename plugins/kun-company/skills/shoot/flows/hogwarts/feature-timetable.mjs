// Feature hero: timetable — /<lang>/features/timetable.
import { feature, pick, scrollTo } from "./_feature.mjs"
export { initScript } from "./_feature.mjs"
export const route = "features/timetable"
export const block = "timetable"
export const paths = ["src/components/school-dashboard/timetable"]
export const title = ["الجدول الدراسي", "Timetable"]
export const alt = {
  week: ["أسبوع معلّمة كاملًا", "A teacher's full week"],
  teachers: ["جداول المعلمين", "Teachers' timetables"],
  analytics: ["تحليلات الجدول", "Timetable analytics"],
}
export default feature([
  ["week", "/ar/timetable", async (ctx) => {
    await pick(["اختر معلماً", "Select teacher"], ["عائشة أحمد", "Aisha Ahmed"])(ctx)
    await scrollTo(280)(ctx) // the grid sits low on the page: centre it for the desktop band
  }],
  ["teachers", "/ar/timetable/teachers"],
  ["analytics", "/ar/timetable/analytics"],
])
