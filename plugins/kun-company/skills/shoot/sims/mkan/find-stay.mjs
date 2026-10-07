// Find a stay — the guest's path on mkan.sd, filmed as a person would do it: pick Port Sudan,
// browse the homes on the map, open one, look through its photos, check the price and the host
// contact. Read-only on production: the take stops on «اتصل بالمضيف» and never presses it.

export const meta = {
  title: "ابحث عن <mark>إقامتك</mark>",
  sub: "دليل خطوة بخطوة للحجز في منصة مكان",
  outro: "إقامتك <mark>في دقائق</mark>",
  outroSub: "بورتسودان وساحل البحر الأحمر — على mkan.sd",
}

export default async (sim) => {
  const { page } = sim
  await sim.go("/ar")
  await sim.wait(900)

  sim.caption(1, "اختر وجهتك: بورتسودان")
  const where = page.getByRole("button", { name: "أي مكان" })
  await sim.focus(where, { z: 1.6 })
  await sim.click(where, { pause: 700 })
  await sim.click(page.getByRole("option", { name: /بورتسودان/ }), { pause: 600 })
  await sim.click(page.getByRole("button", { name: "بحث", exact: true }), { pause: 300 })
  await sim.focus(null)

  // results can take most of a minute on a cold container — the director trims the wait
  const card = page.locator("div.group.cursor-pointer h3").first()
  await card.waitFor({ timeout: 90000 })
  await sim.settle()
  sim.caption(2, "تصفّح المنازل المتاحة على الخريطة")
  await sim.wait(1800)
  sim.toast("الأسعار شاملة جميع الرسوم — بالجنيه السوداني لكل ليلة")
  await sim.wait(2600)

  sim.caption(3, "افتح المنزل الذي يناسبك")
  await sim.focus(card, { z: 1.5 })
  await sim.click(card, { pause: 300 })
  await page.waitForURL(/\/listings\//, { timeout: 60000 })
  await sim.settle()
  await sim.focus(null)
  await sim.wait(1600)

  sim.caption(4, "شاهد صور المكان")
  await sim.click(page.getByRole("button", { name: "عرض جميع صور العقار" }).first(), { pause: 1500 })
  await page.locator(".animate-spin").first().waitFor({ state: "hidden", timeout: 30000 }).catch(() => {})
  await sim.wait(900)
  await page.mouse.wheel(0, 700); await sim.wait(1400)
  await page.mouse.wheel(0, 700); await sim.wait(1400)
  await page.goBack(); await sim.settle(); await sim.wait(600)

  sim.caption(5, "راجع المرافق والسعر")
  // the price card renders as you scroll; its call to action is a tel: link, not a button
  await page.mouse.wheel(0, 900); await sim.wait(700)
  const contact = page.getByText("اتصل بالمضيف").first()
  await contact.scrollIntoViewIfNeeded()
  await sim.wait(600)
  await sim.focus(page.getByText("ما يقدمه هذا المكان").first(), { z: 1.4 })
  await sim.wait(2400)

  sim.caption(6, "تواصل مع المضيف للتحقق من التوفر والحجز")
  await sim.focus(contact, { z: 1.6 })
  await sim.move(contact)
  await sim.wait(2600)
  await sim.focus(null)
}
