// Teacher credentials — the admin hands a teacher their login: the teachers list → search →
// the row's ⋯ → «إنشاء بيانات الدخول» → the dialog (6-digit username + 4-digit PIN, copy,
// WhatsApp / SMS / email). Demo tenant, admin.
//
// Generating mints a login and sends it by email + WhatsApp, so the teacher is a throwaway:
// prepare inserts one with an example.com address and a fictional number (nothing can be
// delivered), cleanup deletes the teacher and the login it got — before and after.

import { execSync } from "node:child_process"

export const meta = {
  title: "إنشاء <mark>بيانات دخول</mark> المعلم",
  sub: "اسم المستخدم وكلمة المرور، جاهزة للإرسال",
  outro: "أرسلها للمعلم <mark>بضغطة</mark>",
  outroSub: "عند أول دخول يختار المعلم كلمة مرور خاصة به",
}

const GIVEN = "هدى"
const MIDDLE = "عثمان"
const SURNAME = "الأمين"
const NAME = `${GIVEN} ${MIDDLE}` // the list shows given + middle
const EMAIL = "huda.sim@example.com"
const PHONE = "+249900000077" // fictional, patterned

const sql = (q) => {
  const url = execSync("security find-generic-password -s cf-hogwarts-DATABASE_URL -w").toString().trim()
  return execSync(`psql "${url}" -At -F '\t'`, { input: q + ";\n" }).toString().trim()
}
const DEMO = `(select id from schools where domain='demo')`
const TEST = `"schoolId"=${DEMO} and "emailAddress"='${EMAIL}'`

export async function cleanup() {
  sql(`delete from "User" where id in (select "userId" from teachers where ${TEST} and "userId" is not null)`)
  sql(`delete from "User" where email='${EMAIL}' and "schoolId"=${DEMO}`)
  sql(`delete from teachers where ${TEST}`)
}

export async function prepare({ go }) {
  await cleanup()
  const id = `simcred${Date.now()}`
  sql(`insert into teachers (id, "schoolId", "givenName", "middleName", surname, gender, "emailAddress", "updatedAt")
       values ('${id}', ${DEMO}, '${GIVEN}', '${MIDDLE}', '${SURNAME}', 'female', '${EMAIL}', now())`)
  sql(`insert into teacher_phone_numbers (id, "schoolId", "teacherId", "phoneNumber", "isPrimary", "updatedAt")
       values ('${id}p', ${DEMO}, '${id}', '${PHONE}', true, now())`)
  await go("/ar/teachers")
}

export default async (sim) => {
  const { page } = sim

  // 1 — the teachers list: find the teacher
  await sim.wait(900)
  sim.caption(1, "من صفحة «المعلمين» ابحث عن اسم المعلم")
  const search = page.getByPlaceholder(/بحث|ابحث/).first()
  await sim.focus(search, { z: 2 })
  // the list search matches one name field: a full name finds nothing (2026-10-22)
  await sim.type(search, GIVEN)
  await sim.wait(1200)
  const row = page.locator("tbody tr").filter({ hasText: EMAIL }).first()
  await row.waitFor({ timeout: 30000 }); await sim.settle()
  await sim.focus(row, { z: 1.4 })
  await sim.wait(1800)

  // 2 — the row's actions menu
  sim.caption(2, "اضغط زر الإجراءات (⋯) في صف المعلم")
  const menu = row.locator('[data-slot="dropdown-menu-trigger"]')
  await sim.click(menu, { pause: 700 })
  const item = page.getByRole("menuitem", { name: "إنشاء بيانات الدخول" })
  await item.waitFor()
  await sim.focus([menu, item], { z: 1.6 })
  await sim.wait(1600)

  // 3 — generate
  sim.caption(3, "اختر «إنشاء بيانات الدخول»")
  await sim.wait(1400)
  await sim.click(item, { pause: 300 })
  const dialog = page.getByRole("dialog").filter({ hasText: "اسم المستخدم" })
  await dialog.waitFor({ timeout: 30000 })
  await dialog.getByText(/^\d{6}$/).first().waitFor({ timeout: 30000 }); await sim.settle()

  // 4 — the login: six digits + a four-digit password
  sim.caption(4, "اسم المستخدم ٦ أرقام، وكلمة المرور ٤ أرقام")
  await sim.focus(dialog, { z: 1.5 })
  await sim.wait(3600)

  // 5 — share it
  const wa = dialog.getByRole("link", { name: /واتساب|WhatsApp/ }).first()
  sim.caption(5, "انسخها أو أرسلها للمعلم عبر واتساب أو رسالة نصية أو البريد")
  if (await wa.isVisible().catch(() => false)) await sim.move(wa)
  await sim.wait(3600)
  sim.toast("عند أول دخول يُطلب من المعلم اختيار كلمة مرور جديدة")
  await sim.wait(3000)
}
