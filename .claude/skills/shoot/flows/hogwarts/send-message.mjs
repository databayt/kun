// Send message — the school inbox, opened and shot, nothing sent.
import { tour } from "./_tour.mjs"
export { initScript } from "./_tour.mjs"

// the app route it films → cdn.databayt.org/hogwarts/<lang>/messages/inbox.avif
export const route = "messages"
export const block = "messaging"
export const paths = ["src/components/school-dashboard/messaging"]
export const title = ["الرسائل", "Messages"]
export const alt = {
  inbox: ["صندوق الرسائل بين المدرسة والأسر", "The inbox between the school and families"],
}
export default tour([["inbox", "/ar/messages"]])
