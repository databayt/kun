// Add teacher — the registrar's path from the list through the teacher wizard to the new row.
// Demo tenant, admin. Create opens on the documents step (hogwarts 162c8b891; before that deploy
// it skipped to «المعلومات الأساسية» — both are handled), then information → expertise → contact → address → employment → «إنشاء». Cleanup deletes the test
// teacher by name; it runs before (leftovers of a crashed run) and after.

import { initScript as blurPhones } from "./add-student.mjs"

// add-student's phone blur, plus emails: seeded teachers carry addresses at real providers
// (yahoo, outlook, hotmail) that could belong to someone. Only the take's example.com stays sharp.
const blurEmails = () => {
  const scan = (root) => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n; (n = w.nextNode()); )
      if (/[\w.+-]+@(?!example\.com)[\w-]+\.[\w.]+/.test(n.textContent) && n.parentElement) n.parentElement.style.filter = "blur(6px)"
  }
  new MutationObserver(() => scan(document.body)).observe(document, { childList: true, subtree: true, characterData: true })
  addEventListener("DOMContentLoaded", () => scan(document.body))
}
// addInitScript ships source text, not closures — so the two run as one string.
export const initScript = `(${blurPhones})();(${blurEmails})()`

const NAME_AR = "منى عبدالرحيم", NAME_EN = "Mona Abdelrahim"
// Fictional, patterned numbers (+249 900 000 0xx) and an address that can never receive mail.
const PHONE = `+2499000000${10 + Math.floor(Math.random() * 90)}`
const EMAIL = `mona.${Date.now()}@example.com`

const dialog = (page) => page.locator('[role="alertdialog"], [role="dialog"]').last()
const next = (page, t) => page.getByRole("button", { name: t("التالي", "Next"), exact: true }).click()

// Search one token (a full name matches nothing in hogwarts listings), then filter rows.
async function rows(page, go, t) {
  const name = t(NAME_AR, NAME_EN)
  await go("/ar/teachers")
  await page.getByPlaceholder(t("بحث عن معلم...", "Search teachers...")).fill(name.split(" ").pop())
  await page.waitForTimeout(2500)
  return page.getByRole("row").filter({ hasText: name })
}

export async function cleanup({ page, go, t = (ar) => ar }) {
  let row = await rows(page, go, t)
  for (let guard = 0; (await row.count()) && guard < 5; guard++) {
    await row.first().getByRole("button", { name: t("إجراءات", "Actions") }).click()
    await page.getByRole("menuitem", { name: t("حذف", "Delete"), exact: true }).click()
    await dialog(page).getByRole("button", { name: new RegExp(t("حذف", "Delete")) }).last().click()
    await page.waitForTimeout(2500)
    row = await rows(page, go, t)
  }
}

export default async ({ page, go, shot, t }) => {
  const NAME = t(NAME_AR, NAME_EN)
  await cleanup({ page, go, t })

  await go("/ar/teachers")
  await shot("list")

  await page.getByRole("button", { name: t("إنشاء", "Create"), exact: true }).click()
  await page.waitForURL(/teachers\/add\/[^/]+\/(attachments|information)/, { timeout: 60000 })
  if (page.url().endsWith("/attachments")) {
    await shot("documents")
    await next(page, t)
    await page.waitForURL(/\/information/)
  }
  await page.locator('input[name="_fullName"]').waitFor()
  await shot("information")

  await page.locator('input[name="_fullName"]').fill(NAME)
  await page.getByRole("combobox").filter({ hasText: t("ذكر", "Male") }).click()
  await page.getByRole("option", { name: t("أنثى", "Female") }).click()
  await page.getByRole("combobox").filter({ hasText: t("اختر الجنسية", "Select nationality") }).click()
  // "Sudan" matches before and after hogwarts 162c8b891 (Arabic names searchable from then on).
  await page.keyboard.type("Sudan")
  await page.getByRole("option", { name: /Sudan|السودان|سوداني/ }).first().click()
  await shot("information-filled")

  await next(page, t)
  await page.waitForURL(/\/expertise/)
  await shot("expertise")
  // Grade 1 is preselected; give her Arabic and Maths in section «أ» (the section with a timetable).
  for (const subject of [t("اللغة العربية", "Arabic"), t("الرياضيات", "Mathematics")]) {
    const card = page.getByRole("button", { name: new RegExp(`^${subject}`) }).locator("xpath=ancestor::*[.//button[normalize-space()='أ' or normalize-space()='A']][1]")
    await card.getByRole("button", { name: "أ", exact: true }).click()
    await page.waitForTimeout(600)
  }
  await shot("expertise-picked")

  await next(page, t)
  await page.waitForURL(/\/contact/)
  await page.locator('input[name="emailAddress"]').fill(EMAIL)
  await page.locator('input[name="phone"]').first().fill(PHONE)
  await shot("contact")

  await next(page, t)
  await page.waitForURL(/\/location/)
  await page.getByPlaceholder(/ابحث عن حي|Search for a neighborhood/).fill(t("الخرطوم", "Khartoum"))
  const hit = page.getByRole("option").first()
  if (await hit.waitFor({ timeout: 8000 }).then(() => true, () => false)) await hit.click()
  await shot("address")

  await next(page, t)
  await page.waitForURL(/\/employment/)
  await page.locator('input[name="employeeId"]').waitFor()
  await shot("employment")

  await page.getByRole("button", { name: t("إنشاء", "Create"), exact: true }).click()
  await page.waitForURL((u) => !u.pathname.includes("/add/"), { timeout: 90000 })
  // a credentials dialog may open a beat after the redirect
  await dialog(page).filter({ hasText: NAME }).waitFor({ timeout: 20000 }).catch(() => {})
  await shot("created")

  await page.keyboard.press("Escape")
  await cleanup({ page, go, t })
}
