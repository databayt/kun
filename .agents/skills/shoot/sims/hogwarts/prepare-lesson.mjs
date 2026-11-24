// Prepare lesson — a teacher readies a live class and walks into the room, as alabidae's teachers
// asked (2026-10-22: «فيديو لكيفية إعداد الدروس والدخول للقاعات»): «مباشر» → «الجلسات» → «+» → the
// five-step wizard (period → time → in-platform room → «المراجع»: the curriculum lesson, a quiz,
// homework → who joins) → «إنشاء فصل مباشر» → «الجدول» → the period running now → «انضمام».
// Clips: `--steps 1-6 --name prepare` and `--steps 7-8 --name enter`.
//
// The teacher is demo's teacher10, whose class the demo clock keeps live (live/demo-clock.ts), so
// «الجدول» always has a period to walk into. prepare signs her in through the real form with a
// 6-digit code and a known PIN, before filming; cleanup deletes the class the take created (by its
// title) and puts back the username and password hash it saved. Demo tenant only.

import { execSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export const meta = {
  title: "تحضير الدرس <mark>والدخول للقاعة</mark>",
  sub: "جهّز حصتك المباشرة بمراجعها، ثم ادخل قاعتك من الجدول",
  outro: "درسك جاهز <mark>وقاعتك مفتوحة</mark>",
  outroSub: "الشرائح والاختبار والواجب تنتظرك داخل الحصة",
}

const EMAIL = "teacher10@balqalam.com"
const CODE = "250010"
const PIN = "4821"
const PIN_HASH = "$2b$10$yVTKk/ymTPcC9hZaZ0VhwecB7OfckZprFEjb8fpZZhWYXAsSXM8TC"
const TITLE = "مراجعة الوحدة الأولى"
const SAVED = join(homedir(), ".cache/shoot-sim/teacher10.orig.tsv")
const HOST = "https://demo.balqalam.com"

// The query goes in on stdin: bcrypt hashes are full of `$`, which a shell-quoted -c expands.
const sql = (q) => {
  const url = execSync("security find-generic-password -s cf-hogwarts-DATABASE_URL -w").toString().trim()
  return execSync(`psql "${url}" -At -F '\t'`, { input: q + ";\n" }).toString().trim()
}
const DEMO = `(select id from schools where domain='demo')`

export async function cleanup() {
  sql(`delete from live_class_sessions where "schoolId"=${DEMO} and title='${TITLE}'`)
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
  await page.goto(`${HOST}/ar/live/dashboard`, { waitUntil: "load", timeout: 90000 })
  await page.getByRole("button", { name: "إنشاء فصل مباشر" }).first().waitFor({ timeout: 60000 })
  await page.waitForTimeout(800)
}

export default async (sim) => {
  const { page } = sim
  const next = page.getByRole("button", { name: "التالي", exact: true })
  const pickFirst = async (trigger) => {
    if (!(await trigger.count())) return false
    await sim.click(trigger.first(), { pause: 500 })
    const opts = page.getByRole("option")
    await opts.first().waitFor({ timeout: 15000 }).catch(() => {})
    if ((await opts.count()) < 2) { await page.keyboard.press("Escape"); return false }
    await sim.click(opts.nth(1), { pause: 300 })
    return true
  }

  // 1 — «الجلسات» → «+» (an icon button; the labelled one only shows on an empty list)
  const add = page.getByRole("button", { name: "إنشاء فصل مباشر" }).first()
  await sim.wait(900)
  sim.caption(1, "من «مباشر» افتح «الجلسات» واضغط «+» لحصة جديدة")
  await sim.focus(add, { z: 2.2 })
  await sim.wait(2600)
  await sim.click(add, { pause: 250 })
  const period = page.getByRole("combobox").filter({ hasText: "غير مرتبطة بحصة" }).first()
  await period.waitFor({ timeout: 30000 }); await sim.settle()

  // 2 — the period fills subject, class, teacher and time
  sim.caption(2, "اختر الحصة من جدولك: تمتلئ المادة والفصل والوقت وحدها")
  const title = page.getByPlaceholder("مثال: جلسة مراجعة الجبر")
  await sim.focus([period, title], { z: 1.5 })
  await pickFirst(period)
  await sim.wait(900)
  await title.fill("")
  await sim.type(title, TITLE)
  await sim.wait(1200)
  await sim.click(next, { pause: 250 }); await sim.settle()

  // 3 — the time, from the timetable
  sim.caption(3, "راجع التاريخ والوقت، ثم «التالي»")
  await sim.focus(page.getByText("نطاق التاريخ").first(), { z: 1.6 })
  await sim.wait(2600)
  await sim.click(next, { pause: 250 }); await sim.settle()

  // 4 — the in-platform room
  sim.caption(4, "«غرفة داخل المنصة»: تسجيل وحضور تلقائي")
  await sim.focus(page.getByText("غرفة داخل المنصة").first(), { z: 1.8 })
  await sim.wait(2800)
  await sim.click(next, { pause: 250 }); await sim.settle()

  // 5 — the lesson itself: curriculum lesson (its files become the slides), quiz, homework, a link
  sim.caption(5, "جهّز درسك: اربط درس المنهج، واختبارًا، وواجبًا")
  const lesson = page.getByRole("combobox").filter({ hasText: "اربط درسًا من المنهج" })
  const quiz = page.getByRole("combobox").filter({ hasText: "أرفق اختبارًا" })
  const homework = page.getByRole("combobox").filter({ hasText: "أرفق واجبًا" })
  await sim.focus([lesson, quiz, homework], { z: 1.4 })
  await pickFirst(lesson)
  await sim.wait(500)
  await pickFirst(quiz)
  await sim.wait(500)
  await pickFirst(homework)
  sim.toast("ملفات درس المنهج تظهر لك «شرائح» داخل الحصة")
  await sim.wait(2600)
  await sim.click(next, { pause: 250 }); await sim.settle()

  // 6 — who joins → create
  const create = page.getByRole("button", { name: "إنشاء فصل مباشر" }).last()
  sim.caption(6, "حدد من يمكنه الانضمام واضغط «إنشاء فصل مباشر»")
  await sim.focus([page.getByText("من يمكنه الانضمام").first(), create], { z: 1.3 })
  await sim.wait(2600)
  await sim.lapse(async () => {
    await sim.click(create, { pause: 300 })
    await page.getByRole("cell", { name: TITLE }).first().waitFor({ timeout: 60000 }).catch(() => {})
    await sim.settle()
  }, { keep: 1.2 })
  await sim.focus(page.getByText(TITLE).first(), { z: 1.6 })
  await sim.wait(2200)

  // 7 — class time: «مباشر» shows the class running now; its card opens the room
  const live = page.getByRole("link", { name: "مباشر" }).first()
  sim.caption(7, "في موعد الحصة افتح «مباشر»: حصتك الجارية في الأعلى، اضغطها")
  await sim.focus(live, { z: 2.2 })
  await sim.wait(1400)
  await sim.lapse(async () => {
    await sim.click(live, { pause: 250 })
    await page.locator('a[href*="/room"]').first().waitFor({ timeout: 60000 }); await sim.settle()
  }, { keep: 1 })
  const card = page.locator('a[href*="/room"]').first()
  await sim.focus(card, { z: 1.5 })
  await sim.wait(2200)
  await sim.lapse(async () => {
    await sim.click(card, { pause: 300 })
    await page.getByRole("button", { name: /^انضمام/ }).first().waitFor({ timeout: 60000 }); await sim.settle()
  }, { keep: 1 })

  // 8 — the title card → «انضمام» → the room, its whiteboard
  const join_ = page.getByRole("button", { name: /^انضمام/ }).first()
  sim.caption(8, "اضغط «انضمام» لتدخل قاعتك: السبورة والشرائح ومشاركة الشاشة في الأسفل")
  await sim.focus(join_, { z: 1.8 })
  await sim.wait(2000)
  await sim.lapse(async () => {
    await sim.click(join_, { pause: 300 })
    await page.getByRole("button", { name: "مغادرة" }).first().waitFor({ timeout: 60000 }); await sim.settle()
    // headless has no camera: dismiss «تعذّر تشغيل الكاميرا» before it reads as a fault
    await page.getByRole("button", { name: "إغلاق" }).first().click({ timeout: 4000 }).catch(() => {})
  }, { keep: 1.2 })
  await sim.focus(null)
  await sim.wait(1500)
  const board = page.getByRole("button", { name: "السبورة" }).first()
  await sim.click(board, { pause: 300 }).catch(() => {})
  await sim.wait(3500)
}
