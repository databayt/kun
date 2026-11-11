// Live join · banner — the dashboard's green banner leads with today's live class all day; at the
// bell it pins «… مباشرة الآن — انضم إليها», and «انضم» opens the class. Demo tenant, the demo
// student; needs a timetable class inside its window.
import { joinFromCard, openCard } from "./_live-room.mjs"

export const meta = {
  title: "انضم للحصة <mark>من لوحة التحكم</mark>",
  sub: "الشريط الأخضر يعرض حصة اليوم المباشرة أولًا",
  outro: "حصتك <mark>في أول الصفحة</mark>",
  outroSub: "يعرضها الشريط طوال اليوم، ويثبّت زر «انضم» عند موعدها",
}

export async function prepare({ page, go }) {
  await page.context().grantPermissions(["camera", "microphone"], { origin: "https://demo.balqalam.com" })
  await page.addInitScript(() => {
    // headless reports notifications as blocked, and the class-alerts offer would read as a fault:
    // show what a person sees on a first visit — the offer itself
    try { Object.defineProperty(Notification, "permission", { get: () => "default" }) } catch {}
  })
  await go("/ar/dashboard")
  await page.getByRole("link", { name: /^انضم$/ }).first().waitFor({ timeout: 60000 })
  await page.waitForTimeout(1200)
}

export default async (sim) => {
  const { page } = sim
  const join = page.getByRole("link", { name: /^انضم$/ }).first()
  const line = page.getByText(/مباشرة الآن/).first()

  // 1 — the banner
  await sim.wait(900)
  sim.caption(1, "افتح لوحة التحكم: الشريط الأخضر يعرض حصتك المباشرة")
  await sim.focus([line, join], { z: 1.4 })
  await sim.wait(3600)
  sim.toast("قبل موعدها يقول الشريط: «مباشرة اليوم الساعة …»")
  await sim.wait(3000)

  // 2 — the class card
  sim.caption(2, "في موعد الحصة اضغط «انضم»")
  await openCard(sim, join)

  // 3 — in
  await joinFromCard(sim, { n: 3, text: "اضغط «انضمام» — تدخل والميكروفون والكاميرا مغلقان" })
  sim.toast("لم يدخل المعلم بعد؟ ابقَ في الغرفة — يصله إشعار بأن طلابه في انتظاره")
  await sim.wait(3400)
}
