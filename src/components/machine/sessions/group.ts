// group — sessions under day heads, as ChatGPT's drawer shows them. Pure.
import type { Session } from "./types"

export type DayGroup = "today" | "yesterday" | "week" | "older"

const DAY = 86_400

/** Today / Yesterday / Previous 7 days / Older, newest first; empty groups are dropped. */
export function groupSessions(sessions: Session[], now = Date.now() / 1000): { group: DayGroup; rows: Session[] }[] {
  const midnight = new Date(now * 1000)
  midnight.setHours(0, 0, 0, 0)
  const today = midnight.getTime() / 1000
  const out: Record<DayGroup, Session[]> = { today: [], yesterday: [], week: [], older: [] }
  for (const s of [...sessions].sort((a, b) => b.updated_at - a.updated_at)) {
    const group: DayGroup = s.updated_at >= today ? "today" : s.updated_at >= today - DAY ? "yesterday" : s.updated_at >= today - 7 * DAY ? "week" : "older"
    out[group].push(s)
  }
  return (["today", "yesterday", "week", "older"] as const).filter((g) => out[g].length).map((group) => ({ group, rows: out[group] }))
}
