// Teacher profile — a teacher updates their own details. The video is the sim
// (sims/hogwarts/teacher-profile.mjs: «الملف الشخصي» → «معلومات الاتصال» → a new phone → «حفظ»,
// as the demo teacher, phones restored after); the still is the teacher's profile.
import { tour } from "./_tour.mjs"

// the app route it films → cdn.databayt.org/hogwarts/<lang>/profile/edit/video.mp4
export const route = "profile/edit"
export const block = "profile"
export const paths = ["src/components/school-dashboard/profile"]
export const title = ["المعلم يعدّل بياناته", "A teacher updates their details"]
export const alt = {
  profile: ["الملف الشخصي للمعلم وأزرار التعديل", "The teacher's profile with its edit buttons"],
}
export const role = "teacher"
export default tour([["profile", "/ar/profile"]])
