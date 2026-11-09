// Live setup — an admin readies the school for live classes: «طريقة التدريس» (in person, live or
// both, with «جاهزية اليوم» under the cards) → «إعدادات الحصص المباشرة». Read only: no card is
// pressed and no setting changed (both save on their own). The video is sims/hogwarts/live-setup.mjs.

// the app route it films → cdn.databayt.org/hogwarts/<lang>/school/configuration/teaching-mode/…
export const route = "school/configuration/teaching-mode"
export const block = "live"
export const paths = ["src/components/school-dashboard/school/configuration", "src/components/school-dashboard/live"]
export const title = ["تجهيز المدرسة للحصص المباشرة", "Set up the school for live classes"]
export const alt = {
  mode: ["«طريقة التدريس»: حضوري أو مباشر أو كلاهما", "Teaching mode: in person, live or both"],
  ready: ["«جاهزية اليوم»: الفصل المرئي وحصص اليوم وحسابات المعلمين والتذكير والحضور", "Today's readiness: video service, today's classes, teacher logins, reminders, attendance"],
  settings: ["«إعدادات الحصص المباشرة»: التذكير والحضور التلقائي وأدوات الغرفة", "Live-class settings: reminders, automatic attendance and the room's tools"],
}
export const role = "admin"
export { initScript } from "./_tour.mjs"
export default async ({ page, go, shot }) => {
  await go("/ar/school/configuration/teaching-mode")
  await shot("mode")
  // The dashboard scrolls an inner container, not the window: bring the checklist's LAST row
  // (attendance) to the bottom of the view, whatever scrolls it.
  const last = page.getByText(/يُسجَّل الحضور|لا يُسجَّل الحضور/).last()
  await last.evaluate((el) => el.scrollIntoView({ block: "end" }))
  await page.waitForTimeout(900)
  await shot("ready")
  await go("/ar/school/configuration/live-classes")
  await shot("settings")
}
