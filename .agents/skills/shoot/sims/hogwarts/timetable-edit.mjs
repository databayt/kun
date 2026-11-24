// Timetable edit — the admin fills a period by hand: «الجدول» → an empty cell's «+» → the slot
// dialog (the cell fixes day, period, room and class → subject → teacher, specialists first) →
// «إنشاء» → the period in the grid. Demo tenant, admin, on the page's default room.
// prepare notes the time; cleanup deletes the demo timetable rows created after it.

import { execSync } from "node:child_process"
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export const meta = {
  title: "تعديل <mark>الجدول الدراسي</mark>",
  sub: "أضف حصة أو غيّرها بضغطة على خانتها",
  outro: "الجدول <mark>محدّث</mark>",
  outroSub: "ويراه المعلم والطلاب فورًا، وتصير الحصة حصة مباشرة عند الحاجة",
}

const SINCE = join(homedir(), ".cache/shoot-sim/timetable-edit.since")

const sql = (q) => {
  const url = execSync("security find-generic-password -s cf-hogwarts-DATABASE_URL -w").toString().trim()
  return execSync(`psql "${url}" -At -F '\t'`, { input: q + ";\n" }).toString().trim()
}

export async function cleanup() {
  if (!existsSync(SINCE)) return
  const since = readFileSync(SINCE, "utf8").trim()
  sql(`delete from timetables where "schoolId"=(select id from schools where domain='demo') and "createdAt" >= '${since}'`)
  rmSync(SINCE)
}

export async function prepare({ page, go }) {
  if (!existsSync(SINCE)) writeFileSync(SINCE, sql(`select now() at time zone 'utc'`) + "\n")
  await go("/ar/timetable")
  // the page settles on its default room after load
  await page.getByRole("button", { name: /^A\d+/ }).first().waitFor({ timeout: 90000 })
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1500)
}

export default async (sim) => {
  const { page } = sim

  // 1 — the timetable
  await sim.wait(900)
  sim.caption(1, "من «الجدول» اختر القاعة أو الفصل الذي تريد تعديله")
  const room = page.getByRole("button", { name: /^A\d+/ }).first()
  await sim.focus(room, { z: 2 })
  await sim.wait(2600)

  // 2 — an empty period: its «+»
  sim.caption(2, "اضغط «+» في الخانة الفارغة لإضافة حصة")
  const cell = page.getByRole("button", { name: "+" }).nth(1).or(page.getByText("+", { exact: true }).nth(1)).first()
  await sim.focus(cell, { z: 1.8 })
  await sim.wait(1600)
  await sim.click(cell, { pause: 500 })
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("combobox").first().waitFor({ timeout: 30000 }); await sim.settle()

  // 3 — the cell already names the day, period, room and class: pick the subject, then the teacher
  sim.caption(3, "اختر المادة ثم المعلم")
  await sim.focus(dialog, { z: 1.3 })
  const boxes = dialog.getByRole("combobox")
  await sim.pick(boxes.nth(0), 1)
  await sim.wait(700)
  await sim.pick(boxes.nth(1), 0)
  sim.toast("المعلمون المتخصصون في المادة يظهرون أولًا، والمشغول في هذا الوقت مُعلَّم")
  await sim.wait(3000)

  // 4 — save
  const save = dialog.getByRole("button", { name: /^(إنشاء|تحديث)$/ })
  sim.caption(4, "اضغط «إنشاء»")
  await sim.focus(save, { z: 2 })
  await sim.wait(1000)
  await sim.lapse(async () => {
    await sim.click(save, { pause: 300 })
    await dialog.waitFor({ state: "hidden", timeout: 30000 })
    await sim.settle()
  }, { keep: 1 })

  // 5 — the period in the grid
  sim.caption(5, "ظهرت الحصة في الجدول — اضغطها لتعديلها أو حذفها")
  await sim.focus(page.locator("div.overflow-x-auto").first(), { z: 1.15 })
  await sim.wait(3800)
}
