// Timetable edit — the admin fills a period from an empty cell. The video is the sim
// (sims/hogwarts/timetable-edit.mjs); the still is the timetable page.
import { tour } from "./_tour.mjs"

// the app route it films → cdn.databayt.org/hogwarts/<lang>/timetable/edit/video.mp4
export const route = "timetable/edit"
export const block = "timetable"
export const paths = ["src/components/school-dashboard/timetable"]
export const title = ["تعديل الجدول الدراسي", "Editing the timetable"]
export const alt = {
  week: ["صفحة الجدول وخاناتها", "The timetable page and its cells"],
}
export default tour([["week", "/ar/timetable"]])
