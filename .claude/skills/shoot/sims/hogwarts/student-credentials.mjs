// Student credentials — the admin hands a student their login: the students list → search →
// the row's ⋯ → «إنشاء بيانات الدخول» → the dialog (6-digit username + 4-digit PIN, copy, share).
// Demo tenant, admin.
//
// Generating mints a login and sends it out, so the student is a throwaway: prepare inserts one
// with an example.com address (nothing can be delivered), cleanup deletes the student and the
// login it got — before and after.

import { execSync } from "node:child_process"

export const meta = {
  title: "إنشاء <mark>بيانات دخول</mark> الطالب",
  sub: "اسم المستخدم وكلمة المرور، جاهزة للإرسال",
  outro: "أرسلها للطالب أو وليّ أمره <mark>بضغطة</mark>",
  outroSub: "عند أول دخول يختار الطالب كلمة مرور خاصة به",
}

const GIVEN = "تسنيم"
const SURNAME = "الفاتح"
const EMAIL = "tasneem.sim@example.com"

const sql = (q) => {
  const url = execSync("security find-generic-password -s cf-hogwarts-DATABASE_URL -w").toString().trim()
  return execSync(`psql "${url}" -At -F '\t'`, { input: q + ";\n" }).toString().trim()
}
const DEMO = `(select id from schools where domain='demo')`
const TEST = `"schoolId"=${DEMO} and email='${EMAIL}'`

export async function cleanup() {
  sql(`delete from "User" where id in (select "userId" from students where ${TEST} and "userId" is not null)`)
  sql(`delete from "User" where email='${EMAIL}' and "schoolId"=${DEMO}`)
  sql(`delete from students where ${TEST}`)
}

export async function prepare({ go }) {
  await cleanup()
  sql(`insert into students (id, "schoolId", "givenName", surname, "dateOfBirth", gender, email, "updatedAt")
       values ('simstu${Date.now()}', ${DEMO}, '${GIVEN}', '${SURNAME}', '2014-03-12', 'female', '${EMAIL}', now())`)
  await go("/ar/students")
}

export default async (sim) => {
  const { page } = sim

  // 1 — the students list: find the student
  await sim.wait(900)
  sim.caption(1, "من صفحة «الطلاب» ابحث عن اسم الطالب")
  const search = page.getByPlaceholder(/بحث|ابحث/).first()
  await sim.focus(search, { z: 2 })
  // the list search matches one name field: search the given name (2026-10-22)
  await sim.type(search, GIVEN)
  await sim.wait(1200)
  const row = page.locator("tbody tr").filter({ hasText: GIVEN }).first()
  await row.waitFor({ timeout: 30000 }); await sim.settle()
  await sim.focus(row, { z: 1.4 })
  await sim.wait(1800)

  // 2 — the row's actions menu
  sim.caption(2, "اضغط زر الإجراءات (⋯) في صف الطالب")
  const menu = row.locator('[data-slot="dropdown-menu-trigger"]')
  await sim.click(menu, { pause: 700 })
  const item = page.locator("[data-slot=dropdown-menu-content]").getByText("إنشاء بيانات الدخول", { exact: true })
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

  // 4 — the login
  sim.caption(4, "اسم المستخدم ٦ أرقام، وكلمة المرور ٤ أرقام")
  await sim.focus(dialog, { z: 1.5 })
  await sim.wait(3600)

  // 5 — share it
  sim.caption(5, "انسخها أو أرسلها للطالب أو وليّ أمره عبر واتساب أو الرسائل أو البريد")
  await sim.wait(3600)
  sim.toast("عند أول دخول يُطلب من الطالب اختيار كلمة مرور جديدة")
  await sim.wait(3000)
}
