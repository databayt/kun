// Shared by the live-* sims: from the class card into the room. A leading _ marks a helper.

/** The card is open (its «انضمام» showing): join, settle in the room, dismiss the headless camera error. */
export async function joinFromCard(sim, { n, text }) {
  const { page } = sim
  const join = page.getByRole("button", { name: /^انضمام/ }).first()
  await join.waitFor({ timeout: 60000 })
  await sim.focus(join, { z: 1.6 })
  await sim.wait(2200)
  sim.caption(n, text)
  await sim.wait(1000)
  await sim.lapse(async () => {
    await sim.click(join, { pause: 300 })
    await page.getByRole("button", { name: "مغادرة" }).first().waitFor({ timeout: 60000 }); await sim.settle()
    // headless has no camera: dismiss «تعذّر تشغيل الكاميرا» before it reads as a fault
    await page.getByRole("button", { name: "إغلاق" }).first().click({ timeout: 4000 }).catch(() => {})
  }, { keep: 1.2 })
  await sim.focus(null)
  await sim.wait(2600)
}

/** Click an entry that leads to /live/…/room (a pill, the banner's «انضم», a notice). */
export async function openCard(sim, entry) {
  const { page } = sim
  await sim.lapse(async () => {
    await sim.click(entry, { pause: 300 })
    await page.waitForURL(/\/live\/[^/]+\/room/, { timeout: 60000 })
    await page.getByRole("button", { name: /^انضمام/ }).first().waitFor({ timeout: 60000 }); await sim.settle()
  }, { keep: 1 })
}
