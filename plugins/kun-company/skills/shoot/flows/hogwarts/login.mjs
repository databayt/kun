// Login — the sign-in page and the email reset, signed out. The demo host's login carries the
// password-less role picker, which is not what a school's people see, so the tour opens the
// main host's form (an absolute URL keeps --lang working).
import { tour } from "./_tour.mjs"
// the app route it films → cdn.databayt.org/hogwarts/<lang>/login/login.avif
export const route = "login"
export const block = "auth"
export const paths = ["src/components/auth"]
export const title = ["تسجيل الدخول", "Signing in"]
export const alt = {
  login: ["صفحة تسجيل الدخول", "The sign-in page"],
  reset: ["استعادة كلمة المرور بالبريد", "Resetting a password by email"],
}
export const role = "guest"
export default tour([
  ["login", "https://balqalam.com/ar/login"],
  ["reset", "https://balqalam.com/ar/reset"],
])
