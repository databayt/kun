// Manage roles — everyone in the school with their role, status and pending requests.
import { tour } from "./_tour.mjs"
export { initScript } from "./_tour.mjs"

// the app route it films → cdn.databayt.org/hogwarts/<lang>/school/membership/members.avif
export const route = "school/membership"
export const block = "school"
export const paths = ["src/components/school-dashboard/school/membership"]
export const title = ["الأدوار والصلاحيات", "Roles and permissions"]
export const alt = {
  members: ["أعضاء المدرسة بأدوارهم وحالاتهم", "School members with their roles and status"],
}
export default tour([["members", "/ar/school/membership"]])
