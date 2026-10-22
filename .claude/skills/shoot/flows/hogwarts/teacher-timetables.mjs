// Teacher timetables — the admin flips between teachers' weeks. The video is the sim
// (sims/hogwarts/teacher-timetables.mjs: «اختر معلماً» → one teacher → another); the still is
// the timetable page it starts from.
import { tour } from "./_tour.mjs"

// the app route it films → cdn.databayt.org/hogwarts/<lang>/timetable/teacher/video.mp4
// (not timetable/teachers: that is the app's assign-teachers page)
export const route = "timetable/teacher"
export const block = "timetable"
export const paths = ["src/components/school-dashboard/timetable"]
export const title = ["جدول كل معلم", "Each teacher's timetable"]
export const alt = {
  week: ["صفحة الجدول مع اختيار القاعة والمعلم", "The timetable page with its room and teacher pickers"],
}
export default tour([["week", "/ar/timetable"]])
