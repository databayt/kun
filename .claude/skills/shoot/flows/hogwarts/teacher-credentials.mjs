// Teacher credentials — the admin hands a teacher their login. The video is the sim
// (sims/hogwarts/teacher-credentials.mjs: search → the row's ⋯ → «إنشاء بيانات الدخول» → the
// dialog with the 6-digit username, the PIN and the share icons, on a throwaway teacher); the
// still is the teachers list the action starts from.
import { tour } from "./_tour.mjs"

// the app route it films → cdn.databayt.org/hogwarts/<lang>/teachers/credentials/video.mp4
export const route = "teachers/credentials"
export const block = "teachers"
export const paths = ["src/components/school-dashboard/listings/credentials", "src/components/school-dashboard/listings/teachers"]
export const title = ["إنشاء بيانات دخول المعلم", "Generating a teacher's login"]
export const alt = {
  list: ["قائمة المعلمين وزر الإجراءات في كل صف", "The teachers list, an actions menu on every row"],
}
export default tour([["list", "/ar/teachers"]])
