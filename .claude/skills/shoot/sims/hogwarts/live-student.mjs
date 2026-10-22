// Live student — a student joins the class running now: «مباشر» → the running class at the top →
// the title card → «انضمام» → the room (mic and camera off on entry) → raise a hand.
// Demo tenant, the demo student; the demo clock keeps a class of their section running
// (live/demo-clock.ts). Joining is real, and marks presence like any join.

export const meta = {
  title: "الطالب <mark>ينضم للحصة المباشرة</mark>",
  sub: "من صفحة «مباشر» أو من الجدول، بضغطة واحدة",
  outro: "حضورك <mark>يُسجَّل وحده</mark>",
  outroSub: "من مدة وجودك في الحصة، دون أن تضغط شيئًا",
}

const HOST = "https://demo.balqalam.com"

export async function prepare({ page, go }) {
  await page.context().grantPermissions(["camera", "microphone"], { origin: HOST })
  await go("/ar/live")
  await page.locator('a[href*="/room"]').first().waitFor({ timeout: 60000 })
  await page.waitForTimeout(1200)
}

export default async (sim) => {
  const { page } = sim

  // 1 — «مباشر»: the running class leads
  await sim.wait(900)
  sim.caption(1, "افتح «مباشر»: الحصة الجارية الآن في الأعلى")
  const card = page.locator('a[href*="/room"]').first()
  await sim.focus(card, { z: 1.4 })
  await sim.wait(3000)
  sim.toast("أو اضغط الحصة في «الجدول» حين يحين موعدها")
  await sim.wait(2600)

  // 2 — the title card
  sim.caption(2, "اضغط الحصة لتفتح بطاقتها")
  await sim.lapse(async () => {
    await sim.click(card, { pause: 300 })
    await page.getByRole("button", { name: /^انضمام/ }).first().waitFor({ timeout: 60000 }); await sim.settle()
  }, { keep: 1 })
  const join = page.getByRole("button", { name: /^انضمام/ }).first()
  await sim.focus(join, { z: 1.6 })
  await sim.wait(2600)

  // 3 — in
  sim.caption(3, "اضغط «انضمام» — تدخل والميكروفون والكاميرا مغلقان")
  await sim.wait(1200)
  await sim.lapse(async () => {
    await sim.click(join, { pause: 300 })
    await page.getByRole("button", { name: "مغادرة" }).first().waitFor({ timeout: 60000 }); await sim.settle()
    // headless has no camera: dismiss «تعذّر تشغيل الكاميرا» before it reads as a fault
    await page.getByRole("button", { name: "إغلاق" }).first().click({ timeout: 4000 }).catch(() => {})
  }, { keep: 1.2 })
  await sim.focus(null)
  await sim.wait(2600)

  // 4 — raise a hand
  const hand = page.getByRole("button", { name: /رفع اليد|ارفع يدك/ }).first()
  if (await hand.isVisible().catch(() => false)) {
    sim.caption(4, "ارفع يدك لتطلب الكلمة، أو اكتب سؤالك في «النقاش»")
    await sim.focus(hand, { z: 1.8 })
    await sim.wait(1200)
    await sim.click(hand, { pause: 1800 })
    await sim.focus(null)
  } else {
    sim.caption(4, "اطرح سؤالك أو شارك في «النقاش» أسفل الشاشة")
  }
  await sim.wait(2600)
  sim.toast("يُسجَّل حضورك تلقائيًا من مدة بقائك في الحصة")
  await sim.wait(3200)
}
