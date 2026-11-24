// Student credentials — the admin hands a student their login. The video is the sim
// (sims/hogwarts/student-credentials.mjs, a throwaway student); the still is the students list.
import { tour } from "./_tour.mjs"

// the app route it films → cdn.databayt.org/hogwarts/<lang>/students/credentials/video.mp4
export const route = "students/credentials"
export const block = "students"
export const paths = ["src/components/school-dashboard/listings/credentials", "src/components/school-dashboard/listings/students"]
export const title = ["إنشاء بيانات دخول الطالب", "Generating a student's login"]
export const alt = {
  list: ["قائمة الطلاب وزر الإجراءات في كل صف", "The students list, an actions menu on every row"],
}
export default tour([["list", "/ar/students"]])
