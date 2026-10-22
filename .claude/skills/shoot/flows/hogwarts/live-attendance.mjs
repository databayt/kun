// Live attendance — the attendance a live class writes by itself. The video is the sim
// (sims/hogwarts/live-attendance.mjs); the still is that session's page.
import { tour } from "./_tour.mjs"

// the app route it films → cdn.databayt.org/hogwarts/<lang>/live/attendance/video.mp4
export const route = "live/attendance"
export const block = "live"
export const paths = ["src/components/school-dashboard/live"]
export const title = ["الحضور في الحصة المباشرة", "Attendance from a live class"]
export const alt = {
  session: ["صفحة حصة منتهية وقسم الحضور", "An ended class and its attendance"],
}
export default tour([["session", "/ar/live/cmtty5q1m008j8ocgo8j2o7oe"]])
