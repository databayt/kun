// Review security — the security score, failed logins, 2FA and the audit log.
import { tour } from "./_tour.mjs"
export { initScript } from "./_tour.mjs"

// the app route it films → cdn.databayt.org/hogwarts/<lang>/school/security/overview.avif
export const route = "school/security"
export const block = "school"
export const paths = ["src/components/school-dashboard/school/security"]
export const title = ["أمان البيانات", "Data security"]
export const alt = {
  overview: ["درجة الأمان ومحاولات الدخول الفاشلة والتحقق الثنائي", "Security score, failed logins and 2FA"],
}
export default tour([["overview", "/ar/school/security"]])
