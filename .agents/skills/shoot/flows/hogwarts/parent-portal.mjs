// Parent portal — a parent picks a child and follows their day, signed in as the demo guardian.
import { tour } from "./_tour.mjs"
export { initScript } from "./_tour.mjs"
// the app route it films → cdn.databayt.org/hogwarts/<lang>/parent/children.avif
export const route = "parent"
export const block = "parent-portal"
export const paths = ["src/components/school-dashboard/parent"]
export const title = ["بوابة ولي الأمر", "The parent portal"]
export const alt = {
  children: ["اختيار أحد الأبناء في بوابة ولي الأمر", "Choosing a child in the parent portal"],
}
export const role = "guardian"
export default tour([["children", "/ar/parent"]])
