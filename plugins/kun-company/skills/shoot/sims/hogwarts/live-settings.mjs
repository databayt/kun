// Live settings — how a school gets the most out of live classes: «مباشر» → «الإعدادات»: how the
// school teaches (in person · online · hybrid), automatic attendance and its minute thresholds,
// the room tools, the reminder before class. Demo tenant, admin; a tour — nothing is saved.

export const meta = {
  title: "استخدم <mark>الحصص المباشرة</mark> بفعالية",
  sub: "أربعة إعدادات تجعل الحصص تعمل وحدها",
  outro: "اضبطها مرة <mark>وتعمل كل يوم</mark>",
  outroSub: "الحصص والتذكير والحضور، من الجدول تلقائيًا",
}

export async function prepare({ page, go }) {
  await go("/ar/live/settings")
  await page.getByText("كيف تُدرِّس المدرسة").first().waitFor({ timeout: 60000 })
  await page.waitForTimeout(800)
}

async function show(sim, loc, z) {
  await loc.evaluate((e) => e.scrollIntoView({ behavior: "smooth", block: "center" }))
  await sim.wait(1100)
  await sim.focus(loc, { z })
}
// a setting's heading, framed with its row: centred on screen at a zoom that keeps the row's switch in view
const block = (page, text) => page.getByText(text, { exact: true }).first()

export default async (sim) => {
  const { page } = sim

  // 1 — how the school teaches
  await sim.wait(900)
  sim.caption(1, "من «مباشر» ← «الإعدادات» اختر كيف تُدرِّس المدرسة")
  await show(sim, block(page, "كيف تُدرِّس المدرسة"), 1.2)
  await sim.wait(3400)
  sim.toast("«عبر الإنترنت» أو «مختلط»: تتحول كل حصة في الجدول إلى حصة مباشرة تلقائيًا")
  await sim.wait(3200)

  // 2 — automatic attendance + its thresholds
  sim.caption(2, "فعّل «تسجيل الحضور تلقائيًا» وحدد دقائق التأخير والحضور")
  await show(sim, block(page, "تسجيل الحضور تلقائياً"), 1.2)
  await sim.wait(3600)

  // 3 — the room tools
  sim.caption(3, "اختر أدوات الغرفة: الدردشة ورفع اليد والاستطلاعات والسبورة")
  await show(sim, block(page, "أدوات الغرفة"), 1.2)
  await sim.wait(3400)

  // 4 — the reminder
  sim.caption(4, "حدد متى يصل التذكير قبل الحصة")
  await show(sim, block(page, "التذكير قبل الحصة (دقائق)"), 1.3)
  await sim.wait(3000)
  sim.toast("اضغط «حفظ» أسفل الصفحة بعد أي تغيير")
  await sim.wait(3000)
}
