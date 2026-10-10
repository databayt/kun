// Bulk import — the admin brings people in from a spreadsheet at /school/bulk (إدخال جماعي):
// page → Finder on the file → match columns → review → import finished → history with logins.
// Shared by bulk-student and bulk-teacher (a leading _ marks a helper, not a flow).
// The sheets are fictional (assets/hogwarts/make-sheets.mjs). Cleanup = the product's own Undo
// on every finished import of that file, so a crashed run leaves nothing behind for the next.

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { finderStill, finderClose } from "../../scripts/finder.mjs"
import { initScript as blurPhones } from "./add-student.mjs"

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), "../../assets/hogwarts")
const sheet = (name) => ({ name, path: join(ASSETS, name), thumb: join(ASSETS, name.replace(/\.csv$/, ".thumb.jpg")) })
// What the Finder shows in Documents: both sheets, the picked one selected.
const SHEETS = [sheet("طلاب-الصف-الأول.csv"), sheet("معلمون-جدد.csv")]

export const initScript = blurPhones

// The import's own history row, and only that: the line naming the file sits two levels inside
// its row (history.tsx: row > details > «file · date»). Never filter generic divs by text — an
// outer container holding several rows matches too, and its Undo belongs to another import
// (bit us 2026-10-10). If the markup moves, this finds nothing and the review count check fails.
const undoRow = (page, file, t) =>
  page.locator("p").filter({ hasText: `${file} ·` })
    .locator("xpath=../..")
    .filter({ has: page.getByRole("button", { name: t("تراجع", "Undo"), exact: true }) })
    .first()

export function bulkFlow({ desc, file, rows }) {
  const SHEET = SHEETS.find((s) => s.name === file)

  async function cleanup({ page, go, t = (ar) => ar }) {
    await go("/ar/school/bulk")
    for (let guard = 0; guard < 5; guard++) {
      const row = undoRow(page, file, t)
      if (!(await row.count())) break
      await row.getByRole("button", { name: t("تراجع", "Undo"), exact: true }).click()
      // the history re-renders while the confirm animates in (the button detaches): retry the click
      const confirm = page.getByRole("alertdialog").getByRole("button", { name: t("تراجع عن الاستيراد", "Undo import") })
      for (let i = 0; i < 4; i++) {
        await page.waitForTimeout(600)
        if (await confirm.click({ timeout: 5000 }).then(() => true, () => false)) break
        if (!(await page.getByRole("alertdialog").count())) await row.getByRole("button", { name: t("تراجع", "Undo"), exact: true }).click().catch(() => {})
      }
      await page.getByRole("alertdialog").waitFor({ state: "hidden", timeout: 20000 })
      await page.waitForTimeout(3000)
    }
  }

  async function flow({ page, go, shot, settle, t, device }) {
    await cleanup({ page, go, t })

    await go("/ar/school/bulk")
    await shot("bulk")

    const card = page.getByRole("button").filter({ hasText: t(...desc) })
    const chooser = page.waitForEvent("filechooser", { timeout: 15000 })
    await card.click()
    if (!device) {
      await finderStill(page, { files: SHEETS, pick: SHEET })
      await shot("finder")
      await finderClose(page)
    }
    await (await chooser).setFiles({ name: SHEET.name, mimeType: "text/csv", buffer: readFileSync(SHEET.path) })

    const dialog = page.getByRole("dialog")
    const review = dialog.getByRole("button", { name: t("مراجعة", "Review"), exact: true })
    await review.waitFor({ timeout: 30000 })
    await settle()
    await shot("map")

    await review.click()
    const run = dialog.getByRole("button", { name: new RegExp(`^${t("استيراد", "Import")} \\d+$`) })
    await run.waitFor({ timeout: 60000 })
    // Every row must plan as New. A Skip means a person from an earlier run survived its Undo:
    // the review still would shoot «تخطٍّ», so stop and name it instead of filing a wrong still.
    const planned = Number(/\d+/.exec(await run.innerText())[0])
    if (planned !== rows) throw new Error(`review plans ${planned} of ${rows} rows as new: an earlier run's people are still in the school (${file}) — remove them, then re-shoot`)
    await shot("review")

    await run.click()
    await dialog.getByText(t("اكتمل الاستيراد", "Import finished")).waitFor({ timeout: 180000 })
    await shot("done")

    await dialog.getByRole("button", { name: t("إغلاق", "Close"), exact: true }).first().click()
    await dialog.waitFor({ state: "hidden" })
    await undoRow(page, file, t).waitFor({ timeout: 20000 })
    // the history sits under the four cards: bring its heading to the top of the frame
    await page.getByText(t("سجل الاستيراد", "Import history"), { exact: true }).evaluate((el) => el.scrollIntoView({ block: "start" }))
    await shot("history")

    // An Undo seconds after «done» once left the newest row behind (hogwarts#436): let the last
    // row's side work settle first.
    await page.waitForTimeout(8000)
    await cleanup({ page, go, t })
  }

  return { cleanup, flow }
}
