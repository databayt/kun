// Page tour — a guide's screens in order, opened and shot, nothing clicked or saved.
// The read-only flows (timetable, grades, exams, academics, roles, security, language, install)
// are tours: the guide's steps name pages, and a still per page is what the help center and the
// chat show. A leading _ marks a helper, not a flow.
import { initScript as blurPhones } from "./add-student.mjs"

export const initScript = blurPhones

/** `steps`: [step, path] pairs — the path is /ar/…; a run pinned to en follows it. */
export const tour = (steps) => async ({ go, shot }) => {
  for (const [step, path] of steps) {
    await go(path)
    await shot(step)
  }
}
