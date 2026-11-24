// Feature hero: attendance — /<lang>/features/attendance.
import { clickFirst, clickText, feature } from "./_feature.mjs"
export { initScript } from "./_feature.mjs"
export const route = "features/attendance"
export const block = "attendance"
export const paths = ["src/components/school-dashboard/attendance"]
export const title = ["الحضور", "Attendance"]
export const alt = {
  mark: ["تسجيل حضور فصل", "Marking a class"],
  cards: ["بطاقات الطلاب للحضور", "Student ID cards for attendance"],
  reports: ["تقارير الحضور", "Attendance reports"],
}
export default feature([
  ["mark", "/ar/attendance", clickFirst('a[href*="/attendance/manual?sectionId="]'), "[role=group] [data-state=on], tbody tr:visible"],
  ["cards", null, clickText(["بطاقات الطلاب", "ID cards"])],
  ["reports", "/ar/attendance/reports"],
])
