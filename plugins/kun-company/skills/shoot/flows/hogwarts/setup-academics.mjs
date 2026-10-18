// Set up academics — the academic structure, the subjects and the classrooms.
import { tour } from "./_tour.mjs"
export { initScript } from "./_tour.mjs"

// the app route it films → cdn.databayt.org/hogwarts/<lang>/school/configuration/academic/structure.avif
export const route = "school/configuration/academic"
export const block = "school"
export const paths = ["src/components/school-dashboard/school/configuration"]
export const title = ["الإعداد الأكاديمي", "Academic setup"]
export const alt = {
  structure: ["الهيكل الأكاديمي: الأعوام والفصول والتقييم", "Academic structure: years, terms and grading"],
  subjects: ["المواد الدراسية لكل صف", "The subjects each grade studies"],
  classrooms: ["الشعب والقاعات", "Sections and rooms"],
}
export default tour([
  ["structure", "/ar/school/configuration/academic"],
  ["subjects", "/ar/subjects"],
  ["classrooms", "/ar/classrooms"],
])
