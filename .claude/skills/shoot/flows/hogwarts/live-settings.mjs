// Live settings — the settings that make live classes run themselves. The video is the sim
// (sims/hogwarts/live-settings.mjs); the still is the settings page.
import { tour } from "./_tour.mjs"

// the app route it films → cdn.databayt.org/hogwarts/<lang>/live/settings/video.mp4
export const route = "live/settings"
export const block = "live"
export const paths = ["src/components/school-dashboard/live"]
export const title = ["استخدم الحصص المباشرة بفعالية", "Getting the most from live classes"]
export const alt = {
  settings: ["إعدادات الحصص المباشرة", "The live-class settings"],
}
export default tour([["settings", "/ar/live/settings"]])
