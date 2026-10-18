// Set fees — the bursar's fees overview and the payments recorded against it. Stills only so far;
// this module carries what publish.mjs needs: the route, the title and one alt per step.
// the app route it films → cdn.databayt.org/hogwarts/<lang>/finance/fees/overview.avif
export const route = "finance/fees"
export const block = "finance"
export const paths = ["src/components/school-dashboard/finance/fees"]
export const title = ["إعداد الرسوم", "Setting up fees"]
export const alt = {
  overview: ["نظرة عامة على الرسوم", "The fees overview"],
  payments: ["المدفوعات المسجّلة", "Recorded payments"],
}
