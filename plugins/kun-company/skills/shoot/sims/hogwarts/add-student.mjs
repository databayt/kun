// Add student — filmed as an admin would do it on the demo school: cursor, typing, picks,
// a real photo upload. Captions explain each move. Document tiles are NOT uploaded: they
// trigger a paid AI extraction on production; the photo circle does not.

import { cleanup as archiveTestStudent } from "../../flows/hogwarts/add-student.mjs"

const NAME = "أحمد الطيب"
const FATHER = "عمر الطيب"
const digits = () => String(Math.floor(10000000 + Math.random() * 89999999))

export async function cleanup({ page, go }) {
  await archiveTestStudent({ page, go })
}

export async function prepare({ go }) {
  await go("/ar/students")
}

export default async (sim) => {
  const { page } = sim
  const next = page.getByRole("button", { name: "التالي", exact: true })

  // 1 — the list
  await sim.wait(1200)
  await sim.caption(1, "من صفحة الطلاب، اضغط زر الإضافة")
  await sim.click(page.getByRole("button", { name: "إنشاء", exact: true }), { pause: 300 })
  await page.waitForURL(/students\/add\/.+\/attachments/, { timeout: 60000 }); await sim.settle()

  // 2 — documents: the photo
  await sim.caption(2, "ارفع صورة الطالب — والمستندات اختيارية")
  await sim.upload(page.locator("form").locator("[class*=rounded-full], [data-variant=avatar]").first(), sim.asset("student-avatar.png"))
  await sim.wait(1200)
  await sim.click(next, { pause: 300 })
  await page.waitForURL(/\/personal/); await sim.settle()

  // 3 — the student
  await sim.caption(3, "اكتب اسم الطالب — الحقل الوحيد المطلوب")
  await sim.type(page.locator('input[name="_fullName"]'), NAME)
  await sim.caption(3, "اختر الجنس وأضف رقم الهاتف")
  await sim.pick(page.getByRole("combobox").filter({ hasText: "اختر الجنس" }), "ذكر")
  await sim.type(page.locator('input[name="phone"]').first(), `+2499${digits()}`, { cps: 11 })
  await sim.wait(800)

  // 4 — the guardian
  await sim.caption(4, "أضف ولي الأمر: الأب أو الأم — يكفي واحد")
  await sim.click(page.getByRole("button", { name: "الأب" }))
  await sim.type(page.locator('input[name="fatherName"]'), FATHER)
  const fatherPhone = page.locator('input[name="fatherName"]')
    .locator('xpath=ancestor::div[contains(@class,"space-y-6")][1]').locator('input[type="tel"]').first()
  await sim.type(fatherPhone, `+2499${digits()}`, { cps: 11 })
  await sim.wait(700)
  await sim.click(next, { pause: 300 })
  await page.waitForURL(/\/location/); await sim.settle()

  // 5 — the address
  await sim.caption(5, "ابحث عن عنوان السكن واختره")
  const search = page.getByPlaceholder(/ابحث عن حي/)
  await sim.type(search, "الخرطوم")
  const hit = page.getByRole("option").first()
  if (await hit.waitFor({ timeout: 6000 }).then(() => true, () => false)) {
    await sim.click(hit, { pause: 1800 })
  } else await sim.wait(1200)
  await sim.click(next, { pause: 300 })
  await page.waitForURL(/\/academic/); await sim.settle()

  // 6 — grade and section
  await sim.caption(6, "اختر الصف ثم الفصل")
  await sim.pick(page.getByRole("combobox", { name: "الصف", exact: true }), 0)
  const section = page.getByRole("combobox", { name: "الفصل", exact: true })
  await section.and(page.locator(":enabled")).waitFor({ timeout: 15000 })
  // "الصف A-1" (first option) has no timetable and raises a warning toast; - أ has 17 periods.
  await sim.pick(section, "الصف الأول - أ")
  await sim.caption(6, "اضغط «إنشاء»")
  await sim.click(page.getByRole("button", { name: "إنشاء", exact: true }), { pause: 300 })
  await page.waitForURL((u) => !u.pathname.includes("/add/"), { timeout: 90000 }); await sim.settle()

  // 7 — done
  await sim.caption(7, "تم! الطالب في القائمة، وحسابه ورسوم صفّه جاهزة")
  await sim.move(page.getByText(NAME, { exact: true }).first())
  await sim.wait(3500)
}
