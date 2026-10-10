// Add teacher — the registrar's path on the demo school: the list → documents (optional) →
// information → subjects and sections → contact → address → employment (optional) → «إنشاء» →
// the new row. Same steps as the add-teacher flow, filmed as a human. Cleanup is the flow's:
// delete the test teacher by name, before (a crashed run's leftovers) and after.

import { cleanup as deleteTestTeacher, initScript as BLUR_PHONES_EMAILS } from "../../flows/hogwarts/add-teacher.mjs"

export const meta = {
  title: "إضافة <mark>معلم جديد</mark>",
  sub: "دليل خطوة بخطوة لإدارة المدرسة في منصة بالقلم",
  outro: "معلم جديد <mark>بمواده وحصصه</mark>",
  outroSub: "المواد والفصول تُسند حصصها في الجدول مباشرة",
}

const NAME = "منى عبدالرحيم"
// Fictional, patterned numbers (+249 900 000 0xx) and an address that can never receive mail.
const PHONE = `+2499000000${10 + Math.floor(Math.random() * 90)}`
const EMAIL = `mona.${Date.now() % 100000}@example.com`

export async function cleanup({ page, go }) {
  await deleteTestTeacher({ page, go })
}

// A login-details dialog, if one opens, shows the new account's real username and password: blur
// every credential-shaped token from its first paint (a late blur leaves legible frames).
const BLUR_CREDENTIALS = () => {
  // dropdown popovers are role=dialog too: never blur those (the country list, the search box)
  const scan = () => document.querySelectorAll('[role="alertdialog"],[role="dialog"]').forEach((d) => {
    if (d.closest("[data-radix-popper-content-wrapper]")) return
    const w = document.createTreeWalker(d, NodeFilter.SHOW_TEXT)
    for (let n; (n = w.nextNode()); ) if (/^\s*[A-Za-z0-9@._-]{6,}\s*$/.test(n.textContent) && n.parentElement) n.parentElement.style.filter = "blur(9px)"
    d.querySelectorAll("input, code, pre").forEach((e) => (e.style.filter = "blur(9px)"))
  })
  new MutationObserver(scan).observe(document, { childList: true, subtree: true, characterData: true })
}

export async function prepare({ page, go }) {
  await page.addInitScript(BLUR_PHONES_EMAILS)
  await page.addInitScript(BLUR_CREDENTIALS)
  await go("/ar/teachers")
}

export default async (sim) => {
  const { page } = sim
  const next = page.getByRole("button", { name: "التالي", exact: true })
  // the demo may or may not open on documents: captions count the steps actually shown
  let n = 0
  const caption = (text) => sim.caption(++n, text)

  // 1 — the teachers list
  await sim.wait(900)
  caption("من صفحة المعلمين، اضغط زر الإضافة")
  const add = page.getByRole("button", { name: "إنشاء", exact: true })
  await sim.focus(add, { z: 2 })
  await sim.wait(3200)
  await sim.click(add, { pause: 200 })
  await page.waitForURL(/teachers\/add\/[^/]+\/(attachments|information)/, { timeout: 60000 }); await sim.settle()

  // 2 — documents are optional: straight on
  if (page.url().endsWith("/attachments")) {
    caption("المستندات اختيارية — اضغط «التالي»")
    await sim.focus(null)
    await sim.wait(2600)
    await sim.click(next, { pause: 200 })
    await page.waitForURL(/\/information/); await sim.settle()
  }

  // 3 — basic information, in reading order
  const name = page.locator('input[name="_fullName"]')
  await name.waitFor()
  caption("أدخل اسم المعلم وجنسه وجنسيته")
  const gender = page.getByRole("combobox").filter({ hasText: "ذكر" })
  const nationality = page.getByRole("combobox").filter({ hasText: "اختر الجنسية" })
  await sim.focus([name, gender, nationality])
  await sim.type(name, NAME)
  await sim.pick(gender, "أنثى")
  await sim.click(nationality, { pause: 500 })
  // the country list searches English names (an Arabic query found nothing on 2026-10-10)
  const popover = page.locator("[data-radix-popper-content-wrapper]").first()
  const search = popover.locator("input").first()
  const sudan = page.getByRole("option", { name: /Sudan|السودان/ }).first()
  await sim.focus([nationality, popover])
  await sim.type(search, "Sudan")
  await sudan.waitFor({ timeout: 8000 })
  await sim.click(sudan, { pause: 500 })
  await sim.focus([name, gender, nationality])
  await sim.wait(1400)
  await sim.focus(null)
  await sim.click(next, { pause: 200 })
  await page.waitForURL(/\/expertise/); await sim.settle()

  // 4 — subjects and sections: Arabic and Maths in «أ», grade 1 preselected
  caption("اختر المواد والفصول التي يدرّسها")
  const card = (subject) => page.getByRole("button", { name: new RegExp(`^${subject}`) })
    .locator("xpath=ancestor::*[.//button[normalize-space()='أ']][1]")
  await sim.focus([card("اللغة العربية"), card("الرياضيات")])
  await sim.wait(1200)
  for (const subject of ["اللغة العربية", "الرياضيات"]) {
    await sim.click(card(subject).getByRole("button", { name: "أ", exact: true }), { pause: 900 })
  }
  // the tip says what the step's own copy says: picking a section assigns its periods
  sim.toast("تُسند حصص المادة في الجدول للمعلم عند اختيار الفصل")
  await sim.wait(3400)
  await sim.focus(null)
  await sim.click(next, { pause: 200 })
  await page.waitForURL(/\/contact/); await sim.settle()

  // 5 — contact
  caption("أدخل البريد الإلكتروني ورقم الهاتف")
  const email = page.locator('input[name="emailAddress"]'), phone = page.locator('input[name="phone"]').first()
  await sim.focus([email, phone])
  await sim.type(email, EMAIL, { cps: 14 })
  await sim.type(phone, PHONE, { cps: 11 })
  await sim.wait(1400)
  await sim.focus(null)
  await sim.click(next, { pause: 200 })
  await page.waitForURL(/\/location/); await sim.settle()

  // 6 — the address
  caption("ابحث عن عنوان السكن واختره")
  const place = page.getByPlaceholder(/ابحث عن حي/)
  await sim.focus([place, page.locator(".mapboxgl-map, [class*=map]").first()])
  await sim.type(place, "الخرطوم")
  const hit = page.getByRole("option").first()
  if (await hit.waitFor({ timeout: 8000 }).then(() => true, () => false)) await sim.click(hit, { pause: 1600 })
  await sim.wait(1800)
  await sim.focus(null)
  await sim.click(next, { pause: 200 })
  await page.waitForURL(/\/employment/); await sim.settle()

  // 7 — employment is optional: create
  await page.locator('input[name="employeeId"]').waitFor()
  caption("التوظيف اختياري — اضغط «إنشاء»")
  const create = page.getByRole("button", { name: "إنشاء", exact: true })
  await sim.focus(null)
  await sim.wait(2600)
  await sim.click(create, { pause: 200 })
  await page.waitForURL((u) => !u.pathname.includes("/add/"), { timeout: 90000 }); await sim.settle()

  // 8 — done: close a login dialog if one opens, then the new row
  caption("تم! المعلمة في القائمة بموادها")
  const dlg = page.locator('[role="alertdialog"], [role="dialog"]').last()
  if (await dlg.waitFor({ timeout: 6000 }).then(() => true, () => false)) {
    await sim.wait(1000)
    await page.keyboard.press("Escape")
    await dlg.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {})
  }
  const row = page.getByRole("row").filter({ hasText: NAME }).first()
  await row.waitFor({ timeout: 20000 })
  await sim.focus(row)
  // park the cursor on the name, never on the email or phone digits
  await sim.move(row.getByText(NAME).first())
  sim.toast("يُنشأ للمعلم حساب دخول تلقائياً")
  await sim.wait(3400)
}
