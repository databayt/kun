// Live join · timetable — a student joins today's live class from «الجدول»: the class's cell carries
// «انضمام» inside its window → the class card → the room. Needs a timetable class that is on now
// (demo: a real period, or the temporary combined class of the 2026-11-09 capture). Joining is real.
import { intoRoom } from "./_live-join.mjs"

export const route = "timetable/live"
export const block = "live"
export const paths = ["src/components/school-dashboard/timetable", "src/components/school-dashboard/live"]
export const title = ["الانضمام للحصة من الجدول", "Join a live class from the timetable"]
export const alt = {
  timetable: ["حصة اليوم في «الجدول» وعليها زر «انضمام»", "Today's class in the timetable, with its Join button"],
  card: ["بطاقة الحصة قبل الدخول: الكاميرا والميكروفون مغلقان", "The class card before entering, camera and mic off"],
  room: ["داخل الحصة المباشرة", "Inside the live class"],
}
export const role = "student"
export { initScript } from "./_tour.mjs"
export default async ({ page, go, shot }) => {
  await go("/ar/timetable")
  const pill = page.locator('a[href*="/live/join/"]').first()
  await pill.waitFor({ timeout: 60000 })
  await pill.scrollIntoViewIfNeeded()
  await shot("timetable")
  await intoRoom({ page, shot }, pill)
}
