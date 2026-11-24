// Mark attendance — the teacher takes the register from the class list (the teacher's own
// attendance page opens on it).
import { tour } from "./_tour.mjs"
export { initScript } from "./_tour.mjs"
// the app route it films → cdn.databayt.org/hogwarts/<lang>/attendance/mark/manual.avif
export const route = "attendance/mark"
export const block = "attendance"
export const paths = ["src/components/school-dashboard/attendance"]
export const title = ["تسجيل الحضور", "Taking attendance"]
export const alt = {
  manual: ["التحضير من قائمة الفصل", "Taking attendance from the class list"],
}
export const role = "teacher"
export default tour([["manual", "/ar/attendance"]])
