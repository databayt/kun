// Live setup — an admin readies the school for live classes: «طريقة التدريس» (in person, live or
// both) → «جاهزية اليوم» under the cards → «إعدادات الحصص المباشرة». Read only: no card is pressed
// and no setting is changed (every one saves on its own). Demo tenant, the demo admin.

export const meta = {
  title: "جهّز المدرسة <mark>للحصص المباشرة</mark>",
  sub: "اختر طريقة التدريس وتأكد من جاهزية اليوم",
  outro: "الحصة <mark>تُفتح من الجدول</mark>",
  outroSub: "يضغط المعلم والطالب الحصة في موعدها، دون روابط",
}

export async function prepare({ page, go }) {
  await go("/ar/school/configuration/teaching-mode")
  await page.getByText("جاهزية اليوم").first().waitFor({ timeout: 60000 })
  await page.waitForTimeout(1200)
}

export default async (sim) => {
  const { page } = sim
  const card = (name) => page.getByRole("radio", { name: new RegExp(name) }).or(page.getByText(name, { exact: true })).first()

  // 1 — the three ways to teach
  await sim.wait(900)
  sim.caption(1, "من «الإعدادات» افتح «طريقة التدريس»: حضوري أو مباشر أو كلاهما")
  await sim.focus([card("حضوري"), card("كلاهما")], { z: 1.25 })
  await sim.wait(3600)

  // 2 — live
  sim.caption(2, "«مباشر»: كل حصة في الجدول تُقدَّم مباشرة أيضًا — يُحفظ الاختيار فور الضغط")
  await sim.focus(card("مباشر"), { z: 1.7 })
  await sim.wait(3600)
  sim.toast("«كلاهما» لمدرسة تجمع الحضوري والمباشر: اختر الصفوف المباشرة أو افتح فترة مؤقتة")
  await sim.wait(3400)

  // 3 — today's readiness
  const ready = page.getByText("جاهزية اليوم").first()
  await ready.scrollIntoViewIfNeeded()
  await sim.wait(600)
  sim.caption(3, "«جاهزية اليوم»: الفصل المرئي، حصص اليوم، حسابات المعلمين، التذكير والحضور")
  await sim.focus([ready, page.getByText(/يُسجَّل الحضور|لا يُسجَّل الحضور/).first()], { z: 1.3 })
  await sim.wait(4200)
  sim.toast("البند البرتقالي فيه زر «إصلاح» يأخذك إلى مكان الحل")
  await sim.wait(3000)

  // 4 — the live-class settings
  const more = page.getByRole("link", { name: "إعدادات الحصص المباشرة" }).first()
  await more.scrollIntoViewIfNeeded()
  sim.caption(4, "اضغط «إعدادات الحصص المباشرة» لضبط التذكير والحضور وأدوات الغرفة")
  await sim.focus(more, { z: 1.8 })
  await sim.wait(2000)
  await sim.lapse(async () => {
    await sim.click(more, { pause: 300 })
    await page.waitForURL(/live-classes/, { timeout: 60000 }); await sim.settle()
  }, { keep: 1.2 })
  await sim.focus(null)
  await sim.wait(2400)

  // 5 — every setting saves itself
  sim.caption(5, "كل إعداد يُحفظ وحده — لا يوجد زر «حفظ»")
  await page.mouse.wheel(0, 520); await sim.wait(2600)
  await page.mouse.wheel(0, 520); await sim.wait(2600)
  sim.toast("التسجيل والخيارات المتقدمة مطويّة: افتحها عند الحاجة")
  await sim.wait(3200)
}
