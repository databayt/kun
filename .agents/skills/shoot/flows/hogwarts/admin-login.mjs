// Admin login — into the demo as the school's admin. The video is the sim
// (sims/hogwarts/admin-login.mjs: balqalam.com → «جرّب المنصة الآن» → demo.balqalam.com's role
// picker on «مدير المدرسة» → «دخول» → the dashboard); the still is the admin dashboard.
import { tour } from "./_tour.mjs"

// the app route it films → cdn.databayt.org/hogwarts/<lang>/login/admin/video.mp4
export const route = "login/admin"
export const block = "auth"
export const paths = ["src/components/auth", "src/components/school-dashboard/dashboard"]
export const title = ["الدخول كمدير المدرسة", "Signing in as the school admin"]
export const alt = {
  dashboard: ["لوحة تحكم الإدارة بعد الدخول", "The admin dashboard after signing in"],
}
export default tour([["dashboard", "/ar/dashboard"]])
