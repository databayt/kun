// Install app — the school on a phone, shot with --device iphone-16 (stills land in iphone-16/).
import { tour } from "./_tour.mjs"
export { initScript } from "./_tour.mjs"

// the app route it films → cdn.databayt.org/hogwarts/<lang>/dashboard/install/iphone-16/dashboard.avif
export const route = "dashboard/install"
export const block = "offline"
export const paths = ["src/components/offline"]
export const title = ["الجوال والعمل دون اتصال", "Mobile and offline"]
export const alt = {
  dashboard: ["المدرسة على الجوال", "The school on a phone"],
}
export default tour([["dashboard", "/ar/dashboard"]])
