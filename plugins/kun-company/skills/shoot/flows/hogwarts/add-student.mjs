// Add student — the registrar's path from the list through the 4-step wizard to the new row.
// Demo tenant, admin. Creating a student attaches fees, so plain delete is refused; cleanup
// archives the test student and purges it from the archive (export download + typed name),
// the same way the office would. Runs before (leftovers of a crashed run) and after.

import { homedir } from "node:os"
import { join } from "node:path"
import { readFileSync } from "node:fs"
import { finderStill, finderClose } from "../../scripts/finder.mjs"

// The student's photo and papers live in ~/Documents, as on the registrar's Mac (copies of
// assets/hogwarts/, watermarked «نموذج للعرض»). The Finder lists them; the upload is real.
const DOC = (name) => ({ name, path: join(homedir(), "Documents", name) })
const PHOTO = DOC("صورة-أحمد.jpg"), CV = DOC("ملف-الطالب.jpg")
const FILES = [PHOTO, DOC("شهادة-الروضة.jpg"), DOC("تقرير-الروضة.jpg"), DOC("شهادة-الميلاد.jpg"), CV, DOC("بطاقة-التطعيم.jpg")]

// Upload through the Finder window: shoot it open with the file selected, then the real upload.
async function upload({ page, shot, settle, device }, trigger, file, step) {
  const chooser = page.waitForEvent("filechooser", { timeout: 15000 })
  await trigger.click()
  // the Mac Finder only on the desktop frame — a phone opens its own picker, which no browser draws
  if (!device) {
    await finderStill(page, { files: FILES, pick: file })
    await shot(`finder-${step}`)
    await finderClose(page)
  }
  // the Finder name travels with the file, as when the admin picks it
  await (await chooser).setFiles({ name: file.name, mimeType: "image/jpeg", buffer: readFileSync(file.path) })
  await trigger.locator("img").first().waitFor({ timeout: 30000 }).catch(() => {})
  await settle()
  await shot(`${step}-uploaded`)
}

// The demo school's seeded students carry numbers in live Sudanese mobile ranges. Blur any
// phone-shaped text on screen except the fictional +249 900 000 0xx range this take types.
export const initScript = () => {
  const real = /(\+?249|\b0)[19]\d{5,8}/, fake = /2499000000\d\d/
  const scan = (root) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n; (n = w.nextNode()); ) {
      const s = n.textContent.replace(/[\s-]/g, "")
      if (real.test(s) && !fake.test(s) && n.parentElement) n.parentElement.style.filter = "blur(6px)"
    }
  }
  new MutationObserver(() => scan(document.body)).observe(document, { childList: true, subtree: true, characterData: true })
  addEventListener("DOMContentLoaded", () => scan(document.body))
}

// Labels come from hogwarts school-{ar,en}.json (school.students.*); t(ar, en) picks the run's language.
const NAME_AR = "أحمد الطيب", NAME_EN = "Ahmed Altayeb"
const FATHER_AR = "عمر الطيب", FATHER_EN = "Omar Altayeb"
// Fresh numbers every run: a phone that matches an earlier (archived) test student reuses
// that login, and the wizard only shows the credentials dialog for a NEW login.
const rnd = () => String(Math.floor(10000000 + Math.random() * 89999999))
const PHONE = `+2499000000${10 + Math.floor(Math.random() * 90)}`  // patterned, fictional
const FATHER_PHONE = `+2499000000${10 + Math.floor(Math.random() * 90)}`

const dialog = (page) => page.locator('[role="alertdialog"], [role="dialog"]').last()
const next = (page, t) => page.getByRole("button", { name: t("التالي", "Next"), exact: true }).click()

async function pickFirst(page, trigger) {
  await trigger.click()
  await page.getByRole("option").first().click()
}

// hogwarts search quirks (2026-10-06): a full name ("أحمد الطيب") matches nothing — search one
// token and filter rows; and typing on /students/archived drops the archive scope, so the
// archive is read unsearched.
async function rows(page, go, t, path, name = t(NAME_AR, NAME_EN), match = name) {
  await go(path)
  if (!path.endsWith("/archived")) {
    await page.getByPlaceholder(t("بحث في الطلاب...", "Search students...")).fill(name.split(" ").pop())
    await page.waitForTimeout(2500)
  }
  return page.getByRole("row").filter({ hasText: match })
}

async function rowAction(page, t, row, label) {
  await row.first().getByRole("button", { name: t("الإجراءات", "Actions") }).click()
  await page.getByRole("menuitem", { name: label, exact: true }).click()
}

export async function cleanup({ page, go, t = (ar) => ar }) {
  // both test names, whatever language this run's UI is in: an English stills run must not leave
  // "Ahmed Altayeb" in the Arabic video's list (media-qa, 2026-10-07)
  // Every spelling of the surname, matched on any Ahmed row: an English-entered "Altayeb" shows as
  // «أحمد الطايب» in the Arabic list, so neither full name ever matched it (media-qa round 3).
  let row
  const AHMED = /أحمد|Ahmed/
  for (const token of ["الطيب", "الطايب", "Altayeb"]) {
    row = await rows(page, go, t, "/ar/students", token, AHMED)
    while (await row.count()) {
      await rowAction(page, t, row, t("أرشفة", "Archive"))
      await dialog(page).getByRole("button", { name: t("أرشفة", "Archive") }).click()
      await page.waitForTimeout(2000)
      row = await rows(page, go, t, "/ar/students", token, AHMED)
    }
  }
  // Purge = export copy, typed name, delete. Blocked on 2026-10-06: the export answers
  // STUDENT_NOT_FOUND for archived students, so archived test rows stay in the archive
  // (out of every list shot) until hogwarts fixes it. Warn, never fail the shoot.
  row = await rows(page, go, t, "/ar/students/archived")
  while (await row.count()) {
    await rowAction(page, t, row, t("حذف نهائي", "Permanently delete"))
    const box = dialog(page)
    await box.getByRole("button", { name: t("تنزيل النسخة", "Download export") }).click()
    const confirm = box.getByRole("textbox")
    if (!(await confirm.waitFor({ timeout: 8000 }).then(() => true, () => false))) {
      console.warn(`purge blocked — ${await row.count()} archived test row(s) left in /students/archived`)
      await page.keyboard.press("Escape")
      break
    }
    await confirm.fill(await confirm.getAttribute("placeholder"))
    await box.getByRole("button", { name: t("حذف نهائي", "Permanently delete") }).click()
    await page.waitForTimeout(2500)
    row = await rows(page, go, t, "/ar/students/archived")
  }
}

export default async ({ page, go, shot, settle, t, device }) => {
  const NAME = t(NAME_AR, NAME_EN), FATHER = t(FATHER_AR, FATHER_EN)
  await cleanup({ page, go, t })
  // A document tile fires a paid AI extraction (and pre-fills fields from the sample) — block
  // exactly that server action; the upload itself runs as in the real app.
  await page.route("**/*", (route) => {
    const r = route.request()
    if (r.method() === "POST" && r.headers()["next-action"] && /"(degree|transcript|id|resume|other)Url"\]$/.test(r.postData() || ""))
      return (console.log("  blocked AI extraction"), route.abort())
    return route.continue()
  })

  await go("/ar/students")
  await shot("list")

  await page.getByRole("button", { name: t("إنشاء", "Create"), exact: true }).click()
  await page.waitForURL(/students\/add\/.+\/attachments/, { timeout: 60000 })
  await shot("documents")

  // the photo circle, then one document — the CV tile
  const form = page.locator("form").first()
  await upload({ page, shot, settle, device }, form.locator("[class*=rounded-full], [data-variant=avatar]").first(), PHOTO, "photo")
  await upload({ page, shot, settle, device }, form.locator("div.h-32").filter({ hasText: t("السيرة الذاتية", "Resume") }).first(), CV, "cv")

  await next(page, t)
  await page.waitForURL(/\/personal/)
  await shot("personal")

  await page.locator('input[name="_fullName"]').fill(NAME)
  await pickFirst(page, page.getByRole("combobox").filter({ hasText: t("اختر الجنس", "Select gender") }))
  await page.locator('input[name="phone"]').first().fill(PHONE)
  await shot("personal-filled")

  await page.getByRole("button", { name: t("الأب", "Father") }).click()
  await page.locator('input[name="fatherName"]').fill(FATHER)
  // Every PhoneField renders name="phone" — reach the father's through his section.
  await page
    .locator('input[name="fatherName"]')
    .locator('xpath=ancestor::div[contains(@class,"space-y-6")][1]')
    .locator('input[type="tel"]')
    .first()
    .fill(FATHER_PHONE)
  await shot("father")

  await next(page, t)
  await page.waitForURL(/\/location/)
  await shot("address")

  await next(page, t)
  await page.waitForURL(/\/academic/)
  await pickFirst(page, page.getByRole("combobox", { name: t("الصف", "Grade"), exact: true }))
  const section = page.getByRole("combobox", { name: t("الفصل", "Section"), exact: true })
  await section.and(page.locator(":enabled")).waitFor({ timeout: 15000 })
  await pickFirst(page, section)
  await shot("academic")

  await page.getByRole("button", { name: t("إنشاء", "Create"), exact: true }).click()
  await page.waitForURL((u) => !u.pathname.includes("/add/"), { timeout: 90000 })
  // The login-details dialog opens a beat after the redirect.
  await dialog(page).filter({ hasText: NAME }).waitFor({ timeout: 20000 }).catch(() => {})
  await shot("created")

  // "created" is the newest-first list with the new row on top — the last still. No search isolates
  // one student (2026-10-07: a full name, an English name or a phone finds nothing; one Arabic token
  // finds 20+ namesakes), and a hover does not show in a screenshot.
  await page.keyboard.press("Escape")

  await cleanup({ page, go, t })
}
