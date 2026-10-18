// Login — the sign-in page and the email reset. Stills only so far (shot by path, no scripted flow yet);
// this module carries what publish.mjs needs: the route, the title and one alt per step.
// the app route it films → cdn.databayt.org/hogwarts/<lang>/login/login.avif
export const route = "login"
export const block = "auth"
export const paths = ["src/components/auth"]
export const title = ["تسجيل الدخول", "Signing in"]
export const alt = {
  login: ["صفحة تسجيل الدخول", "The sign-in page"],
  reset: ["استعادة كلمة المرور بالبريد", "Resetting a password by email"],
}
