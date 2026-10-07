// Add student — the registrar's full path on the demo school, every field filled in reading
// order (RTL: right before left, top to bottom), uploads through a macOS Finder sheet.
// Document tiles stay untouched: they fire a paid AI extraction on production and would
// pre-fill fields from a fake document. The photo circle carries the upload moment.

import { cleanup as archiveTestStudent } from "../../flows/hogwarts/add-student.mjs"

export const meta = {
  title: "إضافة <mark>طالب جديد</mark>",
  sub: "دليل خطوة بخطوة لإدارة المدرسة في منصة بالقلم",
  outro: "طالب جديد <mark>في دقائق</mark>",
  outroSub: "المطلوب فقط: اسم الطالب وولي أمر واحد — والباقي يُكمل لاحقاً",
}

const NAME = "أحمد عمر الطيب"
// Patterned, obviously fictional numbers (+249 900 000 0xx) — random digits land in live Sudanese
// mobile ranges and could be a real person's number (media-qa, 2026-10-07).
const fakePhone = () => `+2499000000${String(10 + Math.floor(Math.random() * 90))}`
const A = (f) => new URL(`../../assets/hogwarts/${f}`, import.meta.url).pathname
// Downloads, as the admin's Mac shows it — the photo and the five documents (make-docs.mjs).
const FILES = [
  { slot: null, name: "صورة-أحمد.jpg", path: A("photo.jpg") },
  { slot: "الشهادة", name: "شهادة-الروضة.jpg", path: A("degree.jpg") },
  { slot: "كشف الدرجات", name: "تقرير-الروضة.jpg", path: A("transcript.jpg") },
  { slot: "الهوية", name: "شهادة-الميلاد.jpg", path: A("id.jpg") },
  { slot: "السيرة الذاتية", name: "ملف-الطالب.jpg", path: A("resume.jpg") },
  { slot: "أخرى", name: "بطاقة-التطعيم.jpg", path: A("other.jpg") },
]

export async function cleanup({ page, go }) {
  await archiveTestStudent({ page, go })
}

export async function prepare({ page, go }) {
  // Document tiles fire a paid AI extraction (and pre-fill fields from what it reads). Filming
  // blocks exactly that server action — the uploads themselves run as in the real app.
  await page.route("**/*", (route) => {
    const r = route.request()
    if (r.method() === "POST" && r.headers()["next-action"] && /"(degree|transcript|id|resume|other)Url"\]$/.test(r.postData() || ""))
      return (console.log("blocked AI extraction:", (r.postData() || "").slice(-14)), route.abort())
    return route.continue()
  })
  await go("/ar/students")
}

export default async (sim) => {
  const { page } = sim
  const next = page.getByRole("button", { name: "التالي", exact: true })
  const tel = (nameInput) => page.locator(`input[name="${nameInput}"]`)
    .locator('xpath=ancestor::div[contains(@class,"space-y-6")][1]').locator('input[type="tel"]').first()

  // 1 — the students list
  await sim.wait(900)
  sim.caption(1, "من صفحة الطلاب، اضغط زر الإضافة")
  const add = page.getByRole("button", { name: "إنشاء", exact: true })
  await sim.focus(add, { z: 2 })
  await sim.wait(1100)
  await sim.click(add, { pause: 200 })
  await page.waitForURL(/students\/add\/.+\/attachments/, { timeout: 60000 }); await sim.settle()

  // 2 — documents: the photo and every document, each through Finder
  sim.caption(2, "ارفع صورة الطالب ومستنداته")
  const tiles = page.locator("form").first()
  // the whole page for this step: six tiles, the heading and the Finder window all matter
  await sim.focus(null)
  await sim.wait(900)
  const photo = page.locator("form").locator("[class*=rounded-full], [data-variant=avatar]").first()
  for (const f of FILES) {
    const target = f.slot ? page.locator("form div.h-32").filter({ hasText: f.slot }).first() : photo
    await sim.upload(target, f.path, { files: FILES })
  }
  // tips only once every Finder window is gone — never on top of one
  sim.toast("الصورة تظهر في ملف الطالب وقوائم المدرسة")
  await sim.wait(1700)
  sim.toast("رفع الهوية أو الشهادة يملأ بيانات الطالب تلقائياً")
  await sim.wait(3000)
  await sim.focus(null)
  await sim.click(next, { pause: 200 })
  await page.waitForURL(/\/personal/); await sim.settle()

  // 3 — the student, in reading order
  sim.caption(3, "أدخل بيانات الطالب")
  const personal = [page.locator('input[name="_fullName"]'), page.locator('input[name="phone"]').first(), page.locator('input[type="tel"]').nth(1)]
  await sim.focus(personal)
  await sim.type(page.locator('input[name="_fullName"]'), NAME)
  // date of birth: year → month → day
  await sim.click(page.getByText("اختر تاريخاً").first(), { pause: 600 })
  await sim.focus([page.getByText("اختر تاريخاً").first(), page.locator("[data-radix-popper-content-wrapper]").first()])
  await sim.select(page.locator('select[aria-label="Choose the Year"]'), "2019")
  await sim.select(page.locator('select[aria-label="Choose the Month"]'), { index: 2 })
  await sim.click(page.getByRole("button", { name: /^.*، 14 .* 2019$/ }).first(), { pause: 500 })
  await sim.focus(personal)
  await sim.pick(page.getByRole("combobox").filter({ hasText: "اختر الجنس" }), "ذكر")
  await sim.type(page.locator('input[name="phone"]').first(), fakePhone(), { cps: 11 })
  // the WhatsApp copy lands on blur — show the tip once the field has it
  await page.keyboard.press("Tab"); await sim.wait(700)
  sim.toast("رقم واتساب يُنسخ تلقائياً من رقم الهاتف")
  await sim.wait(2200)

  // 4 — guardians: father, then mother
  sim.caption(4, "أضف ولي الأمر: الأب ثم الأم")
  await sim.click(page.getByRole("button", { name: "الأب" }), { pause: 400 })
  await sim.focus([page.locator('input[name="fatherName"]'), tel("fatherName"), page.getByRole("button", { name: "الأم" })])
  await sim.type(page.locator('input[name="fatherName"]'), "عمر الطيب محمد")
  await sim.type(tel("fatherName"), fakePhone(), { cps: 11 })
  sim.toast("يكفي ولي أمر واحد — ويمكن إضافة الآخر لاحقاً")
  await sim.wait(900)
  await sim.click(page.getByRole("button", { name: "الأم" }), { pause: 400 })
  await sim.focus([page.locator('input[name="motherName"]'), tel("motherName")])
  await sim.type(page.locator('input[name="motherName"]'), "فاطمة أحمد علي")
  await sim.type(tel("motherName"), fakePhone(), { cps: 11 })
  await sim.wait(800)
  await sim.focus(null)
  await sim.click(next, { pause: 200 })
  await page.waitForURL(/\/location/); await sim.settle()

  // 5 — the address
  sim.caption(5, "ابحث عن عنوان السكن واختره")
  const search = page.getByPlaceholder(/ابحث عن حي/)
  await sim.focus([search, page.locator(".mapboxgl-map, [class*=map]").first()])
  await sim.type(search, "الخرطوم")
  const hit = page.getByRole("option").first()
  if (await hit.waitFor({ timeout: 6000 }).then(() => true, () => false)) {
    await sim.click(hit, { pause: 1600 })
    sim.toast("اسحب الدبوس على الخريطة لضبط الموقع بدقة")
  }
  await sim.wait(2200)
  await sim.focus(null)
  await sim.click(next, { pause: 200 })
  await page.waitForURL(/\/academic/); await sim.settle()

  // 6 — academic, in reading order: previous school, grade, section
  sim.caption(6, "أدخل المعلومات الأكاديمية")
  const academic = [page.locator('input[name="previousSchoolName"]'), page.getByRole("combobox", { name: "الصف", exact: true }), page.getByRole("combobox", { name: "المسار", exact: true })]
  await sim.focus(academic)
  await sim.type(page.locator('input[name="previousSchoolName"]'), "روضة النيل")
  await sim.pick(page.getByRole("combobox", { name: "الصف", exact: true }), "الصف الأول")
  const section = page.getByRole("combobox", { name: "الفصل", exact: true })
  await section.and(page.locator(":enabled")).waitFor({ timeout: 15000 })
  // «الصف A-1» has no timetable and raises a warning toast; «- أ» has 17 periods.
  await sim.pick(section, "الصف الأول - أ")
  sim.toast("تُضاف رسوم الصف للطالب تلقائياً عند الإنشاء")
  await sim.wait(1500)
  const create = page.getByRole("button", { name: "إنشاء", exact: true })
  await sim.focus([...academic, create])
  sim.caption(7, "اضغط «إنشاء»")
  await sim.wait(900)
  await sim.click(create, { pause: 200 })
  await page.waitForURL((u) => !u.pathname.includes("/add/"), { timeout: 90000 }); await sim.settle()

  // 8 — done. The login-details dialog opens a beat after the redirect and shows the new account's
  // real username and password: blur every credential-shaped token, give it a beat, close it.
  await sim.focus(null)
  sim.caption(8, "تم! الطالب في القائمة بصورته وصفّه")
  const dlg = page.locator('[role="alertdialog"], [role="dialog"]').last()
  if (await dlg.waitFor({ timeout: 15000 }).then(() => true, () => false)) {
    await page.evaluate(() => {
      const d = [...document.querySelectorAll('[role="alertdialog"],[role="dialog"]')].pop()
      const w = document.createTreeWalker(d, NodeFilter.SHOW_TEXT)
      for (let n; (n = w.nextNode()); ) if (/^\s*[A-Za-z0-9@._-]{6,}\s*$/.test(n.textContent)) n.parentElement.style.filter = "blur(9px)"
      d.querySelectorAll("input, code, pre").forEach((e) => (e.style.filter = "blur(9px)"))
    })
    await sim.wait(1800)
    await page.keyboard.press("Escape")
    await dlg.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {})
  }
  await sim.wait(700)
  const row = page.getByRole("row").filter({ hasText: "أحمد" }).first()
  // the row is full-width; frame its start (RTL right): the name and the grade
  await sim.focus([row.getByText(/^أحمد/).first(), row.getByText("الأول").first()], { z: 1.5 })
  await sim.move(page.getByText(/^أحمد/).first())
  sim.toast("يُرسل إشعار ترحيب للأسرة، ويُنشأ حساب دخول للطالب")
  await sim.wait(3600)
}
