// Feature hero: payment (fees) — /<lang>/features/payment.
import { feature } from "./_feature.mjs"
export { initScript } from "./_feature.mjs"
export const route = "features/payment"
export const block = "finance"
export const paths = ["src/components/school-dashboard/finance/fees"]
export const title = ["المدفوعات", "Payment"]
export const alt = {
  overview: ["نظرة عامة على الرسوم", "The fees overview"],
  payments: ["المدفوعات المسجّلة", "Recorded payments"],
  structures: ["هياكل الرسوم", "Fee structures"],
}
export default feature([
  ["overview", "/ar/finance/fees"],
  ["payments", "/ar/finance/fees/payments"],
  ["structures", "/ar/finance/fees/structures"],
])
