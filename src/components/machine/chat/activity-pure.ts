// activity-pure — what a turn's tool events fold into. No React, so it tests alone.

/** Rotating word: each turn starts on its own, changing with the tick. */
export function playfulWord(list: readonly string[], seed: string, tick: number): string {
  if (list.length === 0) return ""
  let hash = 0
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return list[(hash + Math.max(0, tick)) % list.length] ?? ""
}

/** The finished steps' tool names, each once in first-seen order. */
export function uniqueTools(names: readonly string[]): string[] {
  return [...new Set(names)]
}

/** "Read, Bash, Edit +2" — up to `max` names, the rest counted. */
export function summarize(names: readonly string[], max = 3): { head: string[]; rest: number } {
  const u = uniqueTools(names)
  return { head: u.slice(0, max), rest: Math.max(0, u.length - max) }
}
