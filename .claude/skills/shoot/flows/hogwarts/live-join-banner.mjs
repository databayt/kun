// Live join · banner — the dashboard's green banner leads with today's live class all day; at the
// bell it pins «… مباشرة الآن — انضم إليها» and its «انضم» opens the class. Needs a timetable class
// inside its window. Joining is real.
import { intoRoom } from "./_live-join.mjs"

export const route = "dashboard/live"
export const block = "live"
export const paths = ["src/components/school-dashboard/dashboard", "src/components/school-dashboard/live"]
export const title = ["الانضمام للحصة من لوحة التحكم", "Join a live class from the dashboard"]
export const alt = {
  banner: ["الشريط الأخضر: «حصة … مباشرة الآن — انضم إليها»", "The green banner: the class is live now, join it"],
  card: ["بطاقة الحصة قبل الدخول", "The class card before entering"],
  room: ["داخل الحصة المباشرة", "Inside the live class"],
}
export const role = "student"
export { initScript } from "./_tour.mjs"
export default async ({ page, go, shot }) => {
  await go("/ar/dashboard")
  const join = page.getByRole("link", { name: /^انضم$/ }).first()
  await join.waitFor({ timeout: 60000 })
  await page.waitForTimeout(1500)
  await shot("banner")
  await intoRoom({ page, shot }, join)
}
