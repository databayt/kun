// Teacher timetables — the admin explores each teacher's week: «الجدول» → «اختر معلماً» →
// one teacher's periods → the picker again → a second teacher. Demo tenant, admin; read-only.
// The two teachers carry the demo's fullest weeks (40 and 31 periods on 2026-10-22).

export const meta = {
  title: "جدول <mark>كل معلم</mark>",
  sub: "تصفّح حصص المعلمين واحدًا تلو الآخر",
  outro: "كل معلم <mark>بجدوله</mark>",
  outroSub: "اختر أي معلم لترى حصصه في الأسبوع",
}

const FIRST = "عائشة أحمد"
const SECOND = "زينب آدم"

export async function prepare({ page, go }) {
  await go("/ar/timetable")
  // the page settles on its default room after load; a pick before that is overwritten
  await page.getByRole("button", { name: /^A\d+/ }).first().waitFor({ timeout: 90000 })
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1500)
}

export default async (sim) => {
  const { page } = sim
  const picker = page.getByRole("button", { name: /اختر معلماً|عائشة|زينب/ }).first()
  const grid = page.locator("table, div.overflow-x-auto").first()

  // 1 — the timetable page
  await sim.wait(900)
  sim.caption(1, "من «الجدول» تظهر حصص الأسبوع")
  await sim.focus(null)
  await sim.wait(2600)

  // 2 — the teacher picker
  sim.caption(2, "اضغط «اختر معلماً» لعرض جدول معلم بعينه")
  await sim.focus(picker, { z: 2 })
  await sim.wait(1800)

  // 3 — the first teacher
  await pickTeacher(sim, picker, FIRST)
  sim.caption(3, `هذا جدول ${FIRST}: كل حصة بفصلها وقاعتها`)
  await sim.focus(grid, { z: 1.1 })
  await sim.wait(4200)

  // 4 — flip to a second teacher
  sim.caption(4, "غيّر المعلم من القائمة نفسها")
  await sim.focus(picker, { z: 2 })
  await sim.wait(1200)
  await pickTeacher(sim, picker, SECOND)
  sim.caption(5, `والآن جدول ${SECOND}`)
  await sim.focus(grid, { z: 1.1 })
  await sim.wait(4200)
  sim.toast("الخانات الفارغة حصص فراغ للمعلم")
  await sim.wait(3000)
}

async function pickTeacher(sim, picker, name) {
  const { page } = sim
  await sim.click(picker, { pause: 700 })
  const search = page.locator("[data-radix-popper-content-wrapper] input").first()
  if (await search.isVisible().catch(() => false)) await sim.type(search, name.split(" ")[0])
  const option = page.getByRole("option", { name: new RegExp(name) }).first()
  await option.waitFor({ timeout: 15000 })
  // the week loads behind a skeleton: time-lapse it until the periods are on screen
  await sim.lapse(async () => {
    await sim.click(option, { pause: 300 })
    // «الحصة 1» is in the skeleton too; the teacher's «N حصص/أسبوع» summary arrives with the data
    // the name shows twice once her week is in: the picker + the summary header
    const named = page.getByText(name, { exact: true }).filter({ visible: true })
    for (let i = 0; i < 120 && (await named.count()) < 2; i++) await page.waitForTimeout(500)
    await page.getByText(/حصص\/أسبوع/).filter({ visible: true }).first().waitFor({ timeout: 60000 })
    await sim.settle()
  }, { keep: 1 })
  await sim.wait(600)
}
