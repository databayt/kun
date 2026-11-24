// Feature hero: student — /<lang>/features/student (hero.mjs → cdn …/<lang>/features/student/video.mp4).
import { feature, press } from "./_feature.mjs"
export { initScript } from "./_feature.mjs"
export const route = "features/student"
export const block = "students"
export const paths = ["src/components/school-dashboard/listings/students"]
export const title = ["الطلاب", "Student"]
export const alt = {
  list: ["قائمة الطلاب", "The student directory"],
  grid: ["الطلاب في عرض البطاقات", "Students as cards"],
  levels: ["المراحل الدراسية", "Year levels"],
}
export default feature([
  ["list", "/ar/students"],
  ["grid", null, press(["التبديل إلى عرض الشبكة", "Switch to grid view"])],
  ["levels", "/ar/students/year-levels"],
])
