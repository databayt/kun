// Live teacher — a teacher starts the class running now: «مباشر» → their class at the top → the
// title card → «انضمام» (the room opens for the class) → the room, the whiteboard → «إنهاء الحصة»,
// pointed at, not pressed (ending writes the class's attendance).
//
// The teacher is demo's teacher10 (سارة صالح), whose class the demo clock keeps live
// (live/demo-clock.ts). prepare signs her in through the real form with a 6-digit code and a known
// PIN; cleanup puts back the username and password hash it saved (the same file prepare-lesson
// keeps, so the two never disagree about her original login). Demo tenant only.

import { execSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export const meta = {
  title: "المعلم <mark>يبدأ الحصة المباشرة</mark>",
  sub: "من صفحة «مباشر» أو من الجدول، في موعد الحصة",
  outro: "حصتك <mark>مفتوحة لطلابك</mark>",
  outroSub: "وحين تنهيها يُسجَّل الحضور وحده",
}

const EMAIL = "teacher10@balqalam.com"
const CODE = "250010"
const PIN = "4821"
const PIN_HASH = "$2b$10$yVTKk/ymTPcC9hZaZ0VhwecB7OfckZprFEjb8fpZZhWYXAsSXM8TC"
const SAVED = join(homedir(), ".cache/shoot-sim/teacher10.orig.tsv")
const HOST = "https://demo.balqalam.com"

const sql = (q) => {
  const url = execSync("security find-generic-password -s cf-hogwarts-DATABASE_URL -w").toString().trim()
  return execSync(`psql "${url}" -At -F '\t'`, { input: q + ";\n" }).toString().trim()
}
const DEMO = `(select id from schools where domain='demo')`

export async function cleanup() {
  if (!existsSync(SAVED)) return
  const [id, username, hash, must] = readFileSync(SAVED, "utf8").trim().split("\t")
  sql(`update "User" set username='${username.replace(/'/g, "''")}', password='${hash}', "mustChangePassword"=${must === "t"} where id='${id}'`)
}

export async function prepare({ page }) {
  if (!existsSync(SAVED)) writeFileSync(SAVED, sql(`select id, username, password, "mustChangePassword" from "User" where email='${EMAIL}' and "schoolId"=${DEMO}`) + "\n")
  sql(`update "User" set username='${CODE}', password='${PIN_HASH}', "mustChangePassword"=false where email='${EMAIL}' and "schoolId"=${DEMO}`)
  await page.context().grantPermissions(["camera", "microphone"], { origin: HOST })
  await page.context().clearCookies()
  await page.goto(`${HOST}/ar/login`, { waitUntil: "load", timeout: 90000 })
  await page.getByText("الدخول بالبريد الإلكتروني").click()
  await page.locator('input[name="identifier"]').fill(CODE)
  await page.locator('input[name="password"]').fill(PIN)
  await page.getByRole("button", { name: "دخول", exact: true }).click()
  await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 60000 })
  await page.goto(`${HOST}/ar/live`, { waitUntil: "load", timeout: 90000 })
  await page.locator('a[href*="/room"]').first().waitFor({ timeout: 60000 })
  await page.waitForTimeout(1200)
}

export default async (sim) => {
  const { page } = sim

  // 1 — «مباشر»: the teacher's running class
  await sim.wait(900)
  const card = page.locator('a[href*="clockshow1"][href*="/room"]').or(page.locator('a[href*="/room"]')).first()
  sim.caption(1, "في موعد الحصة افتح «مباشر»: حصتك الجارية في الأعلى")
  await sim.focus(card, { z: 1.4 })
  await sim.wait(3000)
  sim.toast("الحصص تُنشأ وحدها من الجدول كل صباح — لا تحتاج لإنشائها")
  await sim.wait(3000)

  // 2 — the title card
  sim.caption(2, "اضغط الحصة لتفتح بطاقتها")
  await sim.lapse(async () => {
    await sim.click(card, { pause: 300 })
    await page.getByRole("button", { name: /^انضمام/ }).first().waitFor({ timeout: 60000 }); await sim.settle()
  }, { keep: 1 })
  const join_ = page.getByRole("button", { name: /^انضمام/ }).first()
  await sim.focus(join_, { z: 1.6 })
  await sim.wait(2400)

  // 3 — in: the room opens for the class
  sim.caption(3, "اضغط «انضمام» — دخولك يفتح الحصة لطلابك")
  await sim.wait(1000)
  await sim.lapse(async () => {
    await sim.click(join_, { pause: 300 })
    await page.getByRole("button", { name: "مغادرة" }).first().waitFor({ timeout: 60000 }); await sim.settle()
    // headless has no camera: dismiss «تعذّر تشغيل الكاميرا» before it reads as a fault
    await page.getByRole("button", { name: "إغلاق" }).first().click({ timeout: 4000 }).catch(() => {})
  }, { keep: 1.2 })
  await sim.focus(null)
  await sim.wait(2200)

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
