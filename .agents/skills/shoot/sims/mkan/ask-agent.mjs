// Ask the Mkan agent — part 1 of the end-to-end chatbot film (part 2 is a real WhatsApp
// recording, joined in the edit). On mkan.sd: open the robot panel on /listings, ask in plain
// Arabic, watch the steps, get the home cards and the refine chips, open the chat full screen and
// reach «أكمل على واتساب». It sends one real message (an anonymous chat, as any visitor's) and
// never presses the WhatsApp link or a card, so nothing reaches a broker.

export const meta = {
  title: "وكيل <mark>مكان</mark>",
  sub: "ابحث عن منزلك في كيغالي بكلماتك — في الموقع وعلى واتساب",
  outro: "منزلك <mark>برسالة</mark>",
  outroSub: "mkan.sd — أو واتساب ‎+250 780 984 777",
}

const ASK = "شقة مفروشة بغرفتين في كيتشوكيرو، حتى ٤٠٠ ألف شهرياً"

export default async (sim) => {
  const { page } = sim
  await sim.go("/ar/listings")
  await sim.wait(900)

  sim.caption(1, "افتح وكيل مكان من أي صفحة بحث")
  const launcher = page.getByRole("button", { name: "اسأل وكيل الإيجار" })
  await sim.focus(launcher, { z: 1.6 })
  await sim.click(launcher, { pause: 900 })
  await sim.focus(null)
  await sim.wait(2200) // line 1 of the voice is ~4 s

  sim.caption(2, "اكتب ما تحتاجه بكلماتك")
  const input = page.getByPlaceholder("اسأل أي شيء").first()
  await sim.focus(input, { z: 1.5 })
  await sim.type(input, ASK, { cps: 14 })
  await sim.wait(400)
  await input.press("Enter")
  await sim.focus(null)

  // the turn takes ~5-12 s; the director trims the wait
  sim.caption(3, "يقرأ طلبك، ويبحث في المنازل، ويرتبها أمامك")
  const best = page.getByText("الأنسب لك").first()
  await best.waitFor({ timeout: 60000 })
  await sim.settle()
  await sim.wait(2800) // line 3 of the voice is ~6.5 s

  sim.caption(4, "منازل حقيقية، مع سبب الاختيار والسعر الشهري")
  await sim.focus(best, { z: 1.5 })
  await sim.wait(2600)
  sim.toast("الوكيل لا يقول «متاح» قبل أن يتأكد من الوسيط")
  await sim.wait(2200)
  const refine = page.getByRole("button", { name: "أرخص" }).first()
  await sim.focus(refine, { z: 1.5 })
  await sim.wait(1800)
  await sim.focus(null)

  sim.caption(5, "أكمل المحادثة نفسها على واتساب")
  await sim.click(page.locator(`[aria-label="فتح في صفحة كاملة"]`).first(), { pause: 300 })
  await page.waitForURL(/\/find\?c=/, { timeout: 30000 })
  await sim.settle()
  await sim.wait(1200)
  await sim.click(page.getByRole("button", { name: "المزيد" }).first(), { pause: 600 })
  const wa = page.getByText("أكمل على واتساب").first()
  await sim.focus(wa, { z: 1.8 })
  await sim.wait(2800)
  await page.keyboard.press("Escape")
  await sim.focus(null)
}
