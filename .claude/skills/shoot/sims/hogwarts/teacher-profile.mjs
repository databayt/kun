// Teacher profile — a teacher updates their own details: «الملف الشخصي» → «معلومات الاتصال» →
// the contact form (email, phone 1, phone 2) → a new second phone → «حفظ». Demo tenant, signed in
// as the demo teacher (teacher@balqalam.com). prepare saves her phone numbers; cleanup puts them back.

import { execSync } from "node:child_process"
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export const meta = {
  title: "المعلم <mark>يعدّل بياناته</mark>",
  sub: "تحديث رقم الهاتف والبريد من الملف الشخصي",
  outro: "بياناتك <mark>محدّثة</mark>",
  outroSub: "وتراها الإدارة فورًا في قائمة المعلمين",
}

const NEW_PHONE = "+249912345678"
const SAVED = join(homedir(), ".cache/shoot-sim/demo-teacher-phones.tsv")

const sql = (q) => {
  const url = execSync("security find-generic-password -s cf-hogwarts-DATABASE_URL -w").toString().trim()
  return execSync(`psql "${url}" -At -F '\t'`, { input: q + ";\n" }).toString().trim()
}
const TEACHER = `(select t.id from teachers t join "User" u on u.id=t."userId" where u.email='teacher@balqalam.com')`

export async function cleanup() {
  if (!existsSync(SAVED)) return
  const rows = readFileSync(SAVED, "utf8").trim().split("\n").filter(Boolean).map((l) => l.split("\t"))
  sql(`delete from teacher_phone_numbers where "teacherId"=${TEACHER}`)
  for (const [id, schoolId, teacherId, phone, type, primary] of rows)
    sql(`insert into teacher_phone_numbers (id, "schoolId", "teacherId", "phoneNumber", "phoneType", "isPrimary", "updatedAt") values ('${id}', '${schoolId}', '${teacherId}', '${phone}', '${type}', ${primary === "t"}, now())`)
  rmSync(SAVED)
}

export async function prepare({ page, go }) {
  if (!existsSync(SAVED)) writeFileSync(SAVED, sql(`select id, "schoolId", "teacherId", "phoneNumber", "phoneType", "isPrimary" from teacher_phone_numbers where "teacherId"=${TEACHER}`) + "\n")
  await go("/ar/profile")
  await page.getByRole("tab", { name: /الفصول/ }).waitFor({ timeout: 60000 })
  await page.waitForTimeout(600)
}

export default async (sim) => {
  const { page } = sim

  // 1 — your profile
  await sim.wait(900)
  sim.caption(1, "من قائمة حسابك افتح «الملف الشخصي»")
  await sim.focus(null)
  await sim.wait(2800)

  // 2 — the edit buttons sit on the role tab (profile/teacher.tsx), not the overview
  const tab = page.getByRole("tab", { name: /الفصول/ })
  sim.caption(2, "افتح تبويب «الفصول»")
  await sim.focus(tab, { z: 2 })
  await sim.wait(1200)
  await sim.click(tab, { pause: 400 })
  const contact = page.getByRole("button", { name: "معلومات الاتصال" })
  await contact.waitFor({ timeout: 30000 }); await sim.settle()
  sim.caption(3, "اضغط «معلومات الاتصال» لتعديل بياناتك")
  await sim.focus(contact, { z: 2 })
  await sim.wait(1600)
  await sim.click(contact, { pause: 400 })
  const dialog = page.getByRole("dialog")
  // the phone fields are a country-code input with no name attribute: the first tel input is «الهاتف ١»
  const phone = dialog.locator('input[type="tel"]').first()
  await phone.waitFor({ timeout: 30000 }); await sim.settle()

  // 4 — the form: email and two phones
  sim.caption(4, "عدّل بريدك أو اكتب رقم هاتفك")
  await sim.focus(dialog, { z: 1.4 })
  await sim.wait(2000)
  await sim.type(phone, NEW_PHONE)
  await sim.wait(900)

  // 5 — save
  const save = dialog.getByRole("button", { name: "حفظ" })
  sim.caption(5, "اضغط «حفظ»")
  await sim.focus(save, { z: 2 })
  await sim.wait(1000)
  await sim.lapse(async () => {
    await sim.click(save, { pause: 300 })
    await dialog.waitFor({ state: "hidden", timeout: 30000 })
    await sim.settle()
  }, { keep: 1 })

  // 6 — done
  sim.caption(6, "تم الحفظ! بياناتك محدّثة")
  await sim.focus(null)
  await sim.wait(2600)
  sim.toast("تظهر بياناتك الجديدة للإدارة مباشرة")
  await sim.wait(3000)
}
