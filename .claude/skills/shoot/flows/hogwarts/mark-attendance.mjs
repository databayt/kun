// Mark attendance — the teacher takes the register from the class list. Stills only so far;
// this module carries what publish.mjs needs: the route, the title and one alt per step.
// the app route it films → cdn.databayt.org/hogwarts/<lang>/attendance/mark/manual.avif
export const route = "attendance/mark"
export const block = "attendance"
export const paths = ["src/components/school-dashboard/attendance"]
export const title = ["تسجيل الحضور", "Taking attendance"]
export const alt = {
  manual: ["التحضير من قائمة الفصل", "Taking attendance from the class list"],
}
