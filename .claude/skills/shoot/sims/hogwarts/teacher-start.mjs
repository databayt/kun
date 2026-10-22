// Teacher start — a teacher's first evening, as alabidae's teachers lived it (2026-10-21): the
// school's login form → the 6-digit username, not a name → the password → the school's public
// page → «المنصة» → the first-login «اختر كلمة المرور» dialog → the dashboard → «الجدول» → today's
// periods → the week. Clips: `--steps 1-3 --name login` and `--steps 4-8 --name platform`.
//
// The demo's login opens on a password-less role picker no school shows, so prepare opens the
// real form («الدخول بالبريد الإلكتروني») before filming. The teacher is demo's عائشة أحمد
// (teacher87, 17 periods): prepare gives her a 6-digit code, a known PIN and the first-login
// flag; cleanup puts back the username and password hash it saved. Demo tenant only.

import { execSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export const meta = {
  title: "أول دخول <mark>للمعلم</mark>",
  sub: "من رسالة بيانات الدخول إلى جدول حصصك",
  outro: "جدولك <mark>أمامك</mark>",
  outroSub: "اضغط الحصة في موعدها لتبدأ الحصة المباشرة",
}

const EMAIL = "teacher87@balqalam.com"
const CODE = "250087"
const PIN = "4821" // the school's PIN; its bcrypt hash below
const PIN_HASH = "$2b$10$yVTKk/ymTPcC9hZaZ0VhwecB7OfckZprFEjb8fpZZhWYXAsSXM8TC"
const NEW_PIN = "7391"
const SAVED = join(homedir(), ".cache/shoot-sim/teacher87.orig.tsv")

// The query goes in on stdin: bcrypt hashes are full of `$`, which a shell-quoted -c expands.
const sql = (q) => {
  const url = execSync("security find-generic-password -s cf-hogwarts-DATABASE_URL -w").toString().trim()
  return execSync(`psql "${url}" -At -F '\t'`, { input: q + ";\n" }).toString().trim()
}
const DEMO_USER = `email='${EMAIL}' and "schoolId"=(select id from schools where domain='demo')`

export async function cleanup() {
  if (!existsSync(SAVED)) return
  const [id, username, hash, must] = readFileSync(SAVED, "utf8").trim().split("\t")
  sql(`update "User" set username='${username.replace(/'/g, "''")}', password='${hash}', "mustChangePassword"=${must === "t"} where id='${id}'`)
}

export async function prepare({ page, host }) {
  if (!existsSync(SAVED)) writeFileSync(SAVED, sql(`select id, username, password, "mustChangePassword" from "User" where ${DEMO_USER}`) + "\n")
  sql(`update "User" set username='${CODE}', password='${PIN_HASH}', "mustChangePassword"=true where ${DEMO_USER}`)
  await page.context().clearCookies()
  await page.goto(`${host || "https://demo.balqalam.com"}/ar/login`, { waitUntil: "load", timeout: 90000 })
  await page.getByText("الدخول بالبريد الإلكتروني").click()
  await page.locator('input[name="identifier"]').waitFor()
  await page.waitForTimeout(600)
}

export default async (sim) => {
  const { page } = sim
  const code = page.locator('input[name="identifier"]')
  const password = page.locator('input[name="password"]')
  const login = page.getByRole("button", { name: "دخول", exact: true })

  // 1 — the school's own login page
  await sim.wait(900)
  sim.caption(1, "افتح رابط مدرستك الذي أرسلته لك الإدارة")
  await sim.focus([code, password, login], { z: 1.6 })
  await sim.wait(3000)

  // 2 — the username is six digits, never a name
  sim.caption(2, "في الخانة الأولى اكتب اسم المستخدم: ٦ أرقام، لا اسمك")
  await sim.focus(code, { z: 2 })
  await sim.type(code, CODE)
  await sim.wait(1400)
  sim.toast("رسالة «الحساب غير موجود» تعني غالبًا أنك كتبت اسمك بدل الأرقام")
  await sim.wait(2600)

  // 3 — the PIN, then in
  sim.caption(3, "اكتب كلمة المرور واضغط «دخول»")
  await sim.focus([password, login], { z: 2 })
  await sim.type(password, PIN)
  await sim.wait(700)
  await sim.click(login, { pause: 300 })
  await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 60000 }); await sim.settle()

  // 4 — the school's public page: «المنصة» (☰ on a phone) leads in
  const platform = page.getByRole("link", { name: "المنصة" }).first()
  if (!/\/dashboard/.test(page.url())) {
    sim.caption(4, "تظهر صفحة المدرسة؟ اضغط «المنصة» (أو ☰ ثم «المنصة» على الجوال)")
    await sim.focus(platform, { z: 2.2 })
    await sim.wait(3200)
    await sim.click(platform, { pause: 250 })
    await page.waitForURL(/\/dashboard/, { timeout: 60000 }); await sim.settle()
  } else {
    sim.caption(4, "تفتح لوحة التحكم مباشرة بعد الدخول")
    await sim.wait(2400)
  }

  // 5 — first login: choose your own password
  const dialog = page.getByRole("dialog").filter({ hasText: "اختر كلمة المرور" })
  await dialog.waitFor({ timeout: 30000 })
  const pins = dialog.locator('input[type="password"]')
  sim.caption(5, "أول مرة: اختر كلمة مرور جديدة، اكتبها مرتين، واضغط «احفظ وتابع»")
  await sim.focus(dialog, { z: 1.4 })
  await sim.type(pins.nth(0), NEW_PIN)
  await sim.type(pins.nth(1), NEW_PIN)
  await sim.wait(600)
  await sim.click(dialog.getByRole("button", { name: "احفظ وتابع" }), { pause: 300 })
  await dialog.waitFor({ state: "hidden", timeout: 30000 }); await sim.settle()

  // 6 — the dashboard → «الجدول»
  const timetable = page.getByRole("link", { name: "الجدول" }).first()
  sim.caption(6, "هذه لوحة التحكم. اضغط «الجدول» لترى حصصك")
  await sim.focus(timetable, { z: 2.2 })
  await sim.wait(3000)
  await sim.click(timetable, { pause: 250 })
  await page.waitForURL(/\/timetable/, { timeout: 60000 })
  await page.getByText("حصة فارغة").first().waitFor({ timeout: 60000 }).catch(() => {}); await sim.settle()

  // 7 — today's periods
  sim.caption(7, "حصص اليوم: المادة والفصل والوقت")
  await sim.focus(page.locator("main").first(), { z: 1.1 })
  await sim.wait(3200)
  sim.toast("اضغط الحصة في موعدها لتبدأ الحصة المباشرة ويدخل طلابك")
  await sim.wait(2800)

  // 8 — the week
  const week = page.getByText("عرض الأسبوع", { exact: true })
  sim.caption(8, "«عرض الأسبوع» يعرض حصصك في الأسبوع كله")
  await sim.click(week, { pause: 250 })
  await page.waitForURL(/timetable\/full/, { timeout: 60000 }); await sim.settle()
  await sim.wait(1500)
  await sim.focus(null)
  await sim.wait(3500)
}
