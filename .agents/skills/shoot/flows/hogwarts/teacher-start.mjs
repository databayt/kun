// Teacher start — a teacher's first login, from the school's form to their timetable. The video is
// the sim (sims/hogwarts/teacher-start.mjs: login, the public page → «المنصة», the first-login PIN
// dialog, the dashboard → «الجدول»); the stills are the sign-in form, signed out, on the main
// host (the demo host's login opens on a role picker no school shows).
import { tour } from "./_tour.mjs"
// the app route it films → cdn.databayt.org/hogwarts/<lang>/login/teacher/video.mp4
export const route = "login/teacher"
export const block = "auth"
export const paths = ["src/components/auth", "src/components/school-dashboard/timetable"]
export const title = ["أول دخول للمعلم", "A teacher's first login"]
export const alt = {
  login: ["صفحة الدخول: اسم المستخدم المكوّن من ٦ أرقام وكلمة المرور", "The sign-in page: the 6-digit username and the password"],
}
export const role = "guest"
export default tour([["login", "https://balqalam.com/ar/login"]])
