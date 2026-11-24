// View timetable — the week grid, the school-day settings, the generator and the conflict scan.
import { tour } from "./_tour.mjs"
export { initScript } from "./_tour.mjs"

// the app route it films → cdn.databayt.org/hogwarts/<lang>/timetable/week.avif
export const route = "timetable"
export const block = "timetable"
export const paths = ["src/components/school-dashboard/timetable"]
export const title = ["الجدول الدراسي", "The timetable"]
export const alt = {
  week: ["جدول الأسبوع للمدرسة كلها", "The whole school's week grid"],
  settings: ["إعدادات اليوم الدراسي والحصص والاستراحة", "School-day settings: days, periods and breaks"],
  generate: ["توليد الجدول تلقائيًا مع القيود", "Generating the timetable with its constraints"],
  conflicts: ["فحص التعارضات في الجدول", "Scanning the timetable for conflicts"],
}
export default tour([
  ["week", "/ar/timetable"],
  ["settings", "/ar/timetable/settings"],
  ["generate", "/ar/timetable/generate"],
  ["conflicts", "/ar/timetable/conflicts"],
])
