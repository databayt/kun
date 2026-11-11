// Live join · notification — the class started: the bell holds «الحصة المباشرة بدأت الآن», and the
// notice opens the class. Needs a timetable class that its teacher has started. Joining is real.
import { intoRoom } from "./_live-join.mjs"

export const route = "notifications/live"
export const block = "live"
export const paths = ["src/components/school-dashboard/notifications", "src/components/school-dashboard/live"]
export const title = ["الانضمام للحصة من الإشعار", "Join a live class from a notification"]
export const alt = {
  bell: ["الجرس: «الحصة المباشرة بدأت الآن — انضم الآن»", "The bell: the live class has started, join now"],
  card: ["بطاقة الحصة قبل الدخول", "The class card before entering"],
  room: ["داخل الحصة المباشرة", "Inside the live class"],
}
export const role = "student"
export { initScript } from "./_tour.mjs"
export default async ({ page, go, shot }) => {
  await page.addInitScript(() => {
    // headless reports notifications as blocked, and the class-alerts offer would read as a fault:
    // show what a person sees on a first visit — the offer itself
    try { Object.defineProperty(Notification, "permission", { get: () => "default" }) } catch {}
  })
  await go("/ar/dashboard")
  const bell = page.locator('button[aria-haspopup="dialog"][aria-label]').filter({ has: page.locator("svg") }).first()
  await bell.click()
  const notice = page.getByText("الحصة المباشرة بدأت الآن").first()
  await notice.waitFor({ timeout: 30000 })
  await page.waitForTimeout(1200)
  await shot("bell")
  await intoRoom({ page, shot }, notice)
}
