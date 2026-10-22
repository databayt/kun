// Admin login — into the demo as the school's admin: balqalam.com → «جرّب المنصة الآن» →
// demo.balqalam.com's login → the role picker on «مدير» → «دخول» → the admin dashboard.
// Signed out first; the demo's role picker needs no password, so nothing is changed.

export const meta = {
  title: "الدخول <mark>كمدير المدرسة</mark>",
  sub: "من balqalam.com إلى لوحة تحكم الإدارة",
  outro: "لوحة الإدارة <mark>أمامك</mark>",
  outroSub: "من هنا تضيف المعلمين وتنشئ بيانات دخولهم",
}

export async function prepare({ page }) {
  await page.context().clearCookies()
  await page.goto("https://balqalam.com/ar", { waitUntil: "load", timeout: 90000 })
  const tryIt = page.getByRole("link", { name: "جرّب المنصة الآن" })
  await tryIt.waitFor()
  // it opens a new tab; the take films one tab
  await tryIt.evaluate((a) => a.removeAttribute("target"))
  await page.waitForTimeout(800)
}

export default async (sim) => {
  const { page } = sim

  // 1 — balqalam.com
  await sim.wait(900)
  const tryIt = page.getByRole("link", { name: "جرّب المنصة الآن" })
  sim.caption(1, "افتح balqalam.com واضغط «جرّب المنصة الآن»")
  await sim.focus(tryIt, { z: 1.8 })
  await sim.wait(3000)
  await sim.lapse(async () => {
    await sim.click(tryIt, { pause: 300 })
    await page.waitForURL(/demo\.balqalam\.com/, { timeout: 60000 })
    await page.locator("#demo-role").waitFor({ timeout: 60000 }); await sim.settle()
  }, { keep: 1 })

  // 2 — demo.balqalam.com: pick the admin role
  const role = page.locator("#demo-role")
  const enter = page.locator("#demo-role ~ button, button:has-text('دخول')").first()
  sim.caption(2, "في demo.balqalam.com اختر دور «مدير المدرسة»")
  await sim.focus([role, enter], { z: 1.8 })
  await sim.wait(1400)
  await sim.click(role, { pause: 900 })
  const admin = page.getByRole("option").first()
  await admin.waitFor()
  await sim.click(admin, { pause: 700 })

  // 3 — in
  sim.caption(3, "اضغط «دخول»")
  await sim.wait(900)
  await sim.lapse(async () => {
    await sim.click(enter, { pause: 300 })
    await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 60000 })
    if (!/\/dashboard/.test(page.url())) await page.goto(page.url().replace(/\/ar\/?.*$/, "/ar/dashboard"), { waitUntil: "load" })
    await sim.settle()
  }, { keep: 1 })

  // 4 — the admin dashboard; the teachers page is one click away
  sim.caption(4, "هذه لوحة تحكم الإدارة")
  await sim.focus(null)
  await sim.wait(3400)
  const teachers = page.getByRole("link", { name: "المعلمين" }).first()
  if (await teachers.isVisible().catch(() => false)) {
    sim.toast("من «المعلمين» تضيف المعلمين وتنشئ بيانات دخولهم")
    await sim.move(teachers)
    await sim.wait(3200)
  }
}
