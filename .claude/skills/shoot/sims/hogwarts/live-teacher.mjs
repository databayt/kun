// Live teacher — a teacher starts today's class: the dashboard's green banner pins the class at its
// bell («… مباشرة الآن») → «انضم» → the class card → «انضمام», and the teacher's own join opens the
// class for the students (they get «الحصة المباشرة بدأت الآن») → the room, the whiteboard →
// «إنهاء الحصة», pointed at, not pressed (ending writes the class's attendance).
//
// Demo tenant, the demo teacher (teacher@, through the role picker): needs a timetable class of
// theirs inside its window — the 2026-11-09 capture used a temporary combined class (G12-A + G12-B).
// The previous take (teacher10 on a demo-clock room, signed in by rewriting her login) is kept in
// git history; this one needs no database edit.
import { joinFromCard, openCard } from "./_live-room.mjs"

export const meta = {
  title: "المعلم <mark>يبدأ الحصة المباشرة</mark>",
  sub: "من لوحة التحكم أو من الجدول، في موعد الحصة",
  outro: "حصتك <mark>مفتوحة لطلابك</mark>",
  outroSub: "وحين تنهيها يُسجَّل الحضور وحده",
}

export async function prepare({ page, go }) {
  await page.context().grantPermissions(["camera", "microphone"], { origin: "https://demo.balqalam.com" })
  await go("/ar/dashboard")
  await page.getByRole("link", { name: /^انضم$/ }).first().waitFor({ timeout: 60000 })
  await page.waitForTimeout(1200)
}

export default async (sim) => {
  const { page } = sim
  const start = page.getByRole("link", { name: /^انضم$/ }).first()
  const line = page.getByText(/مباشرة الآن/).first()

  // 1 — the class leads the dashboard
  await sim.wait(900)
  sim.caption(1, "في موعد الحصة يثبّت الشريط الأخضر حصتك في أول الصفحة")
  await sim.focus([line, start], { z: 1.4 })
  await sim.wait(3400)
  sim.toast("قبلها بعشر دقائق يصلك إشعار «اضغط لتبدأ الحصة»")
  await sim.wait(3000)

  // 2 — the class card
  sim.caption(2, "اضغط «انضم» لتفتح بطاقة الحصة")
  await openCard(sim, start)

  // 3 — the teacher's join opens the class
  await joinFromCard(sim, { n: 3, text: "اضغط «انضمام» — دخولك يفتح الحصة، ويصل طلابك إشعار بالبدء" })

  // 4 — the whiteboard
  const board = page.getByRole("button", { name: "السبورة" }).first()
  sim.caption(4, "استخدم السبورة والشرائح ومشاركة الشاشة من أسفل الشاشة")
  if (await board.isVisible().catch(() => false)) await sim.click(board, { pause: 600 })
  await sim.wait(3400)
  sim.toast("الطلاب المتأخرون يُرصدون «متأخر» تلقائيًا")
  await sim.wait(2800)

  // 5 — the end button, pointed at
  const end = page.getByRole("button", { name: /إنهاء الحصة/ }).first()
  sim.caption(5, "حين تنتهي اضغط «إنهاء الحصة» — فيُكتب الحضور وحده")
  if (await end.isVisible().catch(() => false)) {
    await sim.focus(end, { z: 1.8 })
    await sim.move(end)
  }
  await sim.wait(3400)
}
