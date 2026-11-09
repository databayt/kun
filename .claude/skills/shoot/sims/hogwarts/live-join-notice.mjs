// Live join · notification — the teacher started the class: the bell holds «الحصة المباشرة بدأت
// الآن», and the notice opens the class. Demo tenant, the demo student; needs a timetable class its
// teacher has started.
import { joinFromCard, openCard } from "./_live-room.mjs"

export const meta = {
  title: "انضم للحصة <mark>من الإشعار</mark>",
  sub: "حين يبدأ المعلم الحصة يصلك إشعار",
  outro: "إشعار واحد <mark>يدخلك الحصة</mark>",
  outroSub: "قبلها بعشر دقائق تنبيه، وعند البدء إشعار «بدأت الآن»",
}

const bellOf = (page) => page.locator('button[aria-haspopup="dialog"][aria-label]').first()

export async function prepare({ page, go }) {
  await page.context().grantPermissions(["camera", "microphone"], { origin: "https://demo.balqalam.com" })
  await go("/ar/dashboard")
  await bellOf(page).waitFor({ timeout: 60000 })
  await page.waitForTimeout(1200)
}

export default async (sim) => {
  const { page } = sim
  const bell = bellOf(page)

  // 1 — the bell
  await sim.wait(900)
  sim.caption(1, "بدأ المعلم الحصة: يظهر رقم على الجرس")
  await sim.focus(bell, { z: 1.9 })
  await sim.wait(2600)
  await sim.click(bell, { pause: 900 })
  const notice = page.getByText("الحصة المباشرة بدأت الآن").first()
  await notice.waitFor({ timeout: 30000 })

  // 2 — the notice
  sim.caption(2, "«الحصة المباشرة بدأت الآن» — اضغط الإشعار")
  await sim.focus(notice, { z: 1.6 })
  await sim.wait(3200)
  sim.toast("قبل الحصة بعشر دقائق يصلك أيضًا «حصة مباشرة تبدأ قريبًا»")
  await sim.wait(3000)
  await openCard(sim, notice)

  // 3 — in
  await joinFromCard(sim, { n: 3, text: "اضغط «انضمام» — تدخل والميكروفون والكاميرا مغلقان" })
}
