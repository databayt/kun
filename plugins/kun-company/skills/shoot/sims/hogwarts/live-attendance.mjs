// Live attendance — after a live class: the session page → «الحضور», written from the room by
// itself: each student's join, leave, minutes and status (حاضر · متأخر · غائب), with a status
// select to correct one. Demo tenant, admin; read-only (the select is opened, nothing is saved).
// The session is a seeded, ended class with 23 participants (2026-09-08, التربية الإسلامية).

export const meta = {
  title: "الحضور في <mark>الحصة المباشرة</mark>",
  sub: "يُرصد وحده من مدة وجود كل طالب في الحصة",
  outro: "لا كشف حضور <mark>يدويًا</mark>",
  outroSub: "راجع وصحّح عند الحاجة فقط",
}

const SESSION = "cmtty5q1m008j8ocgo8j2o7oe"

export async function prepare({ page, go }) {
  await go(`/ar/live/${SESSION}`)
  await page.getByText("الحضور", { exact: true }).first().waitFor({ timeout: 60000 })
  await page.waitForTimeout(800)
}

async function show(sim, loc, z) {
  await loc.evaluate((e) => e.scrollIntoView({ behavior: "smooth", block: "center" }))
  await sim.wait(1100)
  await sim.focus(loc, { z })
}

export default async (sim) => {
  const { page } = sim

  // 1 — the ended session
  await sim.wait(900)
  sim.caption(1, "بعد انتهاء الحصة افتحها من «مباشر» ← «الجلسات»")
  await sim.focus(page.locator("h1").first(), { z: 1.6 })
  await sim.wait(3000)

  // 2 — the attendance card
  const card = page.getByText("الحضور", { exact: true }).first().locator("xpath=ancestor::*[.//table][1]")
  sim.caption(2, "قسم «الحضور» يُكتب وحده عند انتهاء الحصة")
  await show(sim, card, 1.15)
  await sim.wait(3200)

  // 3 — the columns
  const head = card.locator("thead").first()
  sim.caption(3, "لكل طالب: وقت الانضمام والمغادرة وعدد الدقائق")
  await show(sim, head, 1.6)
  await sim.wait(3200)

  // 4 — late / absent
  const late = card.locator("tbody tr").filter({ hasText: "متأخر" }).first()
  sim.caption(4, "من انضم متأخرًا يُرصد «متأخر»، ومن بقي دقيقة واحدة «غائب»")
  await show(sim, late, 1.6)
  await sim.wait(3400)

  // 5 — correct a status
  const select = late.getByRole("combobox").first()
  sim.caption(5, "وتستطيع تصحيح أي حالة من القائمة")
  await sim.click(select, { pause: 1800 })
  await page.keyboard.press("Escape")
  await sim.wait(1200)
  sim.toast("الحضور يصل أيضًا إلى صفحة «الحضور» في المدرسة")
  await sim.wait(3000)
}
