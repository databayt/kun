// Add student — the registrar's path from the list through the 4-step wizard to the new row.
// Demo tenant, admin. Creating a student attaches fees, so plain delete is refused; cleanup
// archives the test student and purges it from the archive (export download + typed name),
// the same way the office would. Runs before (leftovers of a crashed run) and after.

const NAME = "أحمد الطيب"
const FATHER = "عمر الطيب"
// Fresh numbers every run: a phone that matches an earlier (archived) test student reuses
// that login, and the wizard only shows the credentials dialog for a NEW login.
const rnd = () => String(Math.floor(10000000 + Math.random() * 89999999))
const PHONE = `+2499${rnd()}`
const FATHER_PHONE = `+2499${rnd()}`

const dialog = (page) => page.locator('[role="alertdialog"], [role="dialog"]').last()
const next = (page) => page.getByRole("button", { name: "التالي", exact: true }).click()

async function pickFirst(page, trigger) {
  await trigger.click()
  await page.getByRole("option").first().click()
}

// hogwarts search quirks (2026-10-06): a full name ("أحمد الطيب") matches nothing — search one
// token and filter rows; and typing on /students/archived drops the archive scope, so the
// archive is read unsearched.
async function rows(page, go, path) {
  await go(path)
  if (!path.endsWith("/archived")) {
    await page.getByPlaceholder("بحث في الطلاب...").fill(NAME.split(" ").pop())
    await page.waitForTimeout(2500)
  }
  return page.getByRole("row").filter({ hasText: NAME })
}

async function rowAction(page, row, label) {
  await row.first().getByRole("button", { name: "الإجراءات" }).click()
  await page.getByRole("menuitem", { name: label, exact: true }).click()
}

export async function cleanup({ page, go }) {
  let row = await rows(page, go, "/ar/students")
  while (await row.count()) {
    await rowAction(page, row, "أرشفة")
    await dialog(page).getByRole("button", { name: "أرشفة" }).click()
    await page.waitForTimeout(2000)
    row = await rows(page, go, "/ar/students")
  }
  // Purge = export copy, typed name, delete. Blocked on 2026-10-06: the export answers
  // STUDENT_NOT_FOUND for archived students, so archived test rows stay in the archive
  // (out of every list shot) until hogwarts fixes it. Warn, never fail the shoot.
  row = await rows(page, go, "/ar/students/archived")
  while (await row.count()) {
    await rowAction(page, row, "حذف نهائي")
    const box = dialog(page)
    await box.getByRole("button", { name: "تنزيل النسخة" }).click()
    const confirm = box.getByRole("textbox")
    if (!(await confirm.waitFor({ timeout: 8000 }).then(() => true, () => false))) {
      console.warn(`purge blocked — ${await row.count()} archived test row(s) left in /students/archived`)
      await page.keyboard.press("Escape")
      break
    }
    await confirm.fill(await confirm.getAttribute("placeholder"))
    await box.getByRole("button", { name: "حذف نهائي" }).click()
    await page.waitForTimeout(2500)
    row = await rows(page, go, "/ar/students/archived")
  }
}

export default async ({ page, go, shot }) => {
  await cleanup({ page, go })

  await go("/ar/students")
  await shot("list")

  await page.getByRole("button", { name: "إنشاء", exact: true }).click()
  await page.waitForURL(/students\/add\/.+\/attachments/, { timeout: 60000 })
  await shot("documents")

  await next(page)
  await page.waitForURL(/\/personal/)
  await shot("personal")

  await page.locator('input[name="_fullName"]').fill(NAME)
  await pickFirst(page, page.getByRole("combobox").filter({ hasText: "اختر الجنس" }))
  await page.locator('input[name="phone"]').first().fill(PHONE)
  await shot("personal-filled")

  await page.getByRole("button", { name: "الأب" }).click()
  await page.locator('input[name="fatherName"]').fill(FATHER)
  // Every PhoneField renders name="phone" — reach the father's through his section.
  await page
    .locator('input[name="fatherName"]')
    .locator('xpath=ancestor::div[contains(@class,"space-y-6")][1]')
    .locator('input[type="tel"]')
    .first()
    .fill(FATHER_PHONE)
  await shot("father")

  await next(page)
  await page.waitForURL(/\/location/)
  await shot("address")

  await next(page)
  await page.waitForURL(/\/academic/)
  await pickFirst(page, page.getByRole("combobox", { name: "الصف", exact: true }))
  const section = page.getByRole("combobox", { name: "الفصل", exact: true })
  await section.and(page.locator(":enabled")).waitFor({ timeout: 15000 })
  await pickFirst(page, section)
  await shot("academic")

  await page.getByRole("button", { name: "إنشاء", exact: true }).click()
  await page.waitForURL((u) => !u.pathname.includes("/add/"), { timeout: 90000 })
  // The login-details dialog opens a beat after the redirect.
  await dialog(page).filter({ hasText: NAME }).waitFor({ timeout: 20000 }).catch(() => {})
  await shot("created")

  await page.keyboard.press("Escape")
  await page.getByPlaceholder("بحث في الطلاب...").fill(NAME.split(" ").pop())
  await page.waitForTimeout(2500)
  await shot("new-row")

  await cleanup({ page, go })
}
