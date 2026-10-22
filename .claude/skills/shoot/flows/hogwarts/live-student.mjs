// Live student — a student joins the running class. The video is the sim
// (sims/hogwarts/live-student.mjs); the still is the student's live page.
import { tour } from "./_tour.mjs"

// the app route it films → cdn.databayt.org/hogwarts/<lang>/live/student/video.mp4
export const route = "live/student"
export const block = "live"
export const paths = ["src/components/school-dashboard/live"]
export const title = ["الطالب ينضم للحصة المباشرة", "A student joins a live class"]
export const alt = {
  live: ["صفحة «مباشر» للطالب والحصة الجارية في الأعلى", "The student's live page, the running class on top"],
}
export const role = "student"
export default tour([["live", "/ar/live"]])
