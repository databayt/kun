// Live teacher — a teacher starts the class running now and enters the room. The video is the sim
// (sims/hogwarts/live-teacher.mjs, as demo's teacher10); the still is the teacher's live page.
import { tour } from "./_tour.mjs"

// the app route it films → cdn.databayt.org/hogwarts/<lang>/live/teacher/video.mp4
export const route = "live/teacher"
export const block = "live"
export const paths = ["src/components/school-dashboard/live"]
export const title = ["المعلم يبدأ الحصة المباشرة", "A teacher starts a live class"]
export const alt = {
  live: ["صفحة «مباشر» للمعلم وحصته الجارية", "The teacher's live page and their running class"],
}
export const role = "teacher"
export default tour([["live", "/ar/live"]])
