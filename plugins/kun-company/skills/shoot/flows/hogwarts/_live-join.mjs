// Shared by the live-join-* flows: from a page that offers today's class, into the room.
// A leading _ marks a helper, not a flow.

/** Click `entry`, land on the class's room page, shoot the card, join, shoot the room, leave. */
export async function intoRoom({ page, shot }, entry) {
  await entry.click()
  await page.waitForURL(/\/live\/[^/]+\/room/, { timeout: 60000 })
  const join = page.getByRole("button", { name: /^انضمام/ }).first()
  await join.waitFor({ timeout: 60000 })
  await page.waitForTimeout(1200)
  await shot("card")
  await join.click()
  const leave = page.getByRole("button", { name: "مغادرة" }).first()
  await leave.waitFor({ timeout: 60000 })
  // headless has no camera: dismiss «تعذّر تشغيل الكاميرا» before it reads as a fault
  await page.getByRole("button", { name: "إغلاق" }).first().click({ timeout: 4000 }).catch(() => {})
  await page.waitForTimeout(3500)
  await shot("room")
  await leave.click().catch(() => {})
  await page.waitForTimeout(1500)
}
