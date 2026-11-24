// Install app — the school on a phone. A phone-only flow: `device` makes every run shoot it in
// WebKit at the iPhone 16 frame (stills land in iphone-16/), batch runs included.
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
export const device = "iphone-16"
export default tour([["dashboard", "/ar/dashboard"]])
