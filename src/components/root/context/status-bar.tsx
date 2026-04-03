import { type RepoStatus } from "@/actions/status"

interface StatusBarProps {
  status: RepoStatus | null
  repoLabel: string
  lang: string
}

export function StatusBar({ status, repoLabel, lang }: StatusBarProps) {
  const isAr = lang === "ar"

  if (!status) {
    return (
      <p className="text-xs text-muted-foreground/40">
        {isAr ? "جاري التحميل..." : "loading..."}
      </p>
    )
  }

  const timeAgo = status.latestEvent?.time
    ? formatTimeAgo(status.latestEvent.time, isAr)
    : null

  const parts: string[] = []
  parts.push(`${status.openIssues} ${isAr ? "مفتوحة" : "open"}`)
  if (status.openDispatches > 0) {
    parts.push(`${status.openDispatches} ${isAr ? "في الانتظار" : "dispatched"}`)
  }
  if (status.latestEvent && timeAgo) {
    parts.push(timeAgo)
  }

  return (
    <p className="text-xs text-muted-foreground/50">
      {parts.join(" · ")}
    </p>
  )
}

function formatTimeAgo(dateStr: string, isAr: boolean): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)

  if (isAr) {
    if (days > 0) return `منذ ${days} يوم`
    if (hrs > 0) return `منذ ${hrs} ساعة`
    return `منذ ${mins} دقيقة`
  }

  if (days > 0) return `${days}d ago`
  if (hrs > 0) return `${hrs}h ago`
  return `${mins}m ago`
}
