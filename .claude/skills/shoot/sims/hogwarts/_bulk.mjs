// Bulk import, filmed — the admin brings a whole sheet in at /school/bulk: the card → Finder on the
// CSV → columns matched → review → import finished → the history row. Shared by bulk-student and
// bulk-teacher (a leading _ marks a helper, not a sim). Cleanup is the flow's: the product's own
// Undo on every finished import of that file. The sheets are fictional (make-sheets.mjs).

import { bulkFlow, SHEETS, undoRow, initScript as BLUR_PHONES } from "../../flows/hogwarts/_bulk.mjs"

export function bulkSim({ desc, file, rows, noun, meta }) {
  const { cleanup: undo } = bulkFlow({ desc, file, rows })
  const SHEET = SHEETS.find((s) => s.name === file)

  // An Undo seconds after «done» once left the newest row behind (hogwarts#436): let the last row's
  // side work settle first. Off the take — cleanup runs before prepare and after the recording.
  async function cleanup(sim) {
    await sim.page.waitForTimeout(8000)
    await undo(sim)
  }

  async function prepare({ page, go }) {
    await page.addInitScript(BLUR_PHONES)
    await go("/ar/school/bulk")
  }

  async function take(sim) {
    const { page } = sim
    const dialog = page.getByRole("dialog")

    // 1 — the bulk page: pick the card, then the sheet in Finder
    await sim.wait(900)
    sim.caption(1, `من صفحة الإدخال الجماعي، اختر بطاقة ${noun}`)
    const card = page.getByRole("button").filter({ hasText: desc[0] })
    await sim.focus(card, { z: 1.8 })
    await sim.wait(2600)
    await sim.focus(null)
    await sim.upload(card, SHEET.path, { files: SHEETS })

    // 2 — columns matched by name, nothing to set by hand. Each caption goes up the moment its
    // screen appears, before the settle — never a new screen under the last step's caption.
    const review = dialog.getByRole("button", { name: "مراجعة", exact: true })
    await review.waitFor({ timeout: 30000 })
    sim.caption(2, "تُطابَق الأعمدة تلقائياً — راجعها ثم اضغط «مراجعة»")
    await sim.settle()
    await sim.focus(dialog)
    await sim.wait(3400)
    await sim.click(review, { pause: 300 })

    // 3 — the review: every row planned as new
    const run = dialog.getByRole("button", { name: /^استيراد \d+$/ })
    await run.waitFor({ timeout: 60000 })
    sim.caption(3, "راجع الصفوف ثم اضغط «استيراد»")
    await sim.settle()
    // A Skip means a person from an earlier run survived its Undo — stop instead of filming it.
    const planned = Number(/\d+/.exec(await run.innerText())[0])
    if (planned !== rows) throw new Error(`review plans ${planned} of ${rows} rows as new: an earlier run's people are still in the school (${file})`)
    await sim.focus(dialog)
    await sim.wait(3200)
    await sim.click(run, { pause: 300 })

    // 4 — finished, with logins to download or print
    // the rows import one by one behind a moving progress bar: time-lapse it to a few seconds
    await sim.lapse(() => dialog.getByText("اكتمل الاستيراد").waitFor({ timeout: 180000 }), { keep: 3 })
    sim.caption(4, "اكتمل الاستيراد — وحسابات الدخول جاهزة")
    await sim.settle()
    await sim.focus(dialog)
    await sim.wait(1200)
    sim.toast("نزّل بيانات الدخول أو اطبع بطاقاتها لتسليمها")
    await sim.wait(3400)
    await sim.focus(null)
    await sim.click(dialog.getByRole("button", { name: "إغلاق", exact: true }).first(), { pause: 300 })
    await dialog.waitFor({ state: "hidden" })

    // 5 — the history keeps every import, its logins and its undo. The row sits mid-frame at a
    // light zoom, so the top-right tip never covers the row it explains.
    sim.caption(5, "كل استيراد يبقى في السجل")
    const row = undoRow(page, file, (ar) => ar)
    await row.waitFor({ timeout: 20000 })
    await row.evaluate((el) => el.scrollIntoView({ block: "center" }))
    await sim.settle()
    await sim.focus(row, { z: 1.3 })
    await sim.wait(1200)
    sim.toast("من السجل يمكنك تنزيل بيانات الدخول لاحقاً أو التراجع عن الاستيراد")
    await sim.move(row.getByText("الطلاب").or(row.getByText("المعلمين")).first())
    await sim.wait(3600)
  }

  return { meta, cleanup, prepare, take }
}
