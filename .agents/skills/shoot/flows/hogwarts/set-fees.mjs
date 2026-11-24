// Set fees — the bursar's fees overview and the payments recorded against it.
import { tour } from "./_tour.mjs"
export { initScript } from "./_tour.mjs"
// the app route it films → cdn.databayt.org/hogwarts/<lang>/finance/fees/overview.avif
export const route = "finance/fees"
export const block = "finance"
export const paths = ["src/components/school-dashboard/finance/fees"]
export const title = ["إعداد الرسوم", "Setting up fees"]
export const alt = {
  overview: ["نظرة عامة على الرسوم", "The fees overview"],
  payments: ["المدفوعات المسجّلة", "Recorded payments"],
}
export default tour([
  ["overview", "/ar/finance/fees"],
  ["payments", "/ar/finance/fees/payments"],
])
