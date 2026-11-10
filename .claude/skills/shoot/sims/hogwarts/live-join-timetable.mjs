// Live join · timetable — a student joins today's live class from «الجدول»: the class's cell
// carries «انضمام» inside its window → the class card → the room. Demo tenant, the demo student;
// needs a timetable class on now. The room is there at the class's time: the student may be the
// first one in (2026-11-10 model — nobody starts a timetable class).
import { joinFromCard, openCard } from "./_live-room.mjs"

export const meta = {
  title: "انضم للحصة <mark>من الجدول</mark>",
  sub: "في موعد الحصة يظهر زر «انضمام» على خانتها",
  outro: "حضورك <mark>يُسجَّل وحده</mark>",
  outroSub: "من مدة وجودك في الحصة، دون أن تضغط شيئًا",
}

export async function prepare({ page, go }) {
  await page.context().grantPermissions(["camera", "microphone"], { origin: "https://demo.balqalam.com" })
  await go("/ar/timetable")
  await page.locator('a[href*="/live/join/"]').first().waitFor({ timeout: 60000 })
  await page.waitForTimeout(1200)
}

export default async (sim) => {
  const { page } = sim
  const pill = page.locator('a[href*="/live/join/"]').first()

  // 1 — today's class in the week
  await sim.wait(900)
  sim.caption(1, "افتح «الجدول»: حصة اليوم المباشرة عليها زر «انضمام»")
  await pill.scrollIntoViewIfNeeded()
  await sim.focus(pill, { z: 1.5 })
  await sim.wait(3400)
  sim.toast("يظهر الزر قبل الحصة بعشر دقائق ويبقى حتى نهايتها")
  await sim.wait(3000)

  // 2 — the class card
  sim.caption(2, "اضغط «انضمام» لتفتح بطاقة الحصة")
  await openCard(sim, pill)

  // 3 — in
  await joinFromCard(sim, { n: 3, text: "اضغط «انضمام» — تدخل والميكروفون والكاميرا مغلقان" })
  sim.toast("وصلت قبل المعلم؟ ادخل مباشرة — الغرفة مفتوحة في موعد الحصة")
  await sim.wait(3400)
}
