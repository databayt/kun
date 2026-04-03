"use server"

export interface RepoStatus {
  openIssues: number
  openDispatches: number
  latestEvent?: { type: string; title: string; time: string; url?: string }
}

export async function fetchRepoStatus(repo: string): Promise<RepoStatus> {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN

  if (!token) {
    return { openIssues: 0, openDispatches: 0 }
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  }

  const [issuesRes, eventsRes] = await Promise.all([
    fetch(`https://api.github.com/repos/${repo}/issues?state=open&per_page=100`, { headers }),
    fetch(`https://api.github.com/repos/${repo}/events?per_page=5`, { headers }),
  ])

  let openIssues = 0
  let openDispatches = 0

  if (issuesRes.ok) {
    const issues = await issuesRes.json()
    // Filter out PRs (GitHub API returns PRs in issues endpoint)
    const realIssues = issues.filter((i: { pull_request?: unknown }) => !i.pull_request)
    openIssues = realIssues.length
    openDispatches = realIssues.filter(
      (i: { labels: { name: string }[] }) =>
        i.labels.some((l) => l.name === "dispatch")
    ).length
  }

  let latestEvent: RepoStatus["latestEvent"]

  if (eventsRes.ok) {
    const events = await eventsRes.json()
    const event = events[0]
    if (event) {
      latestEvent = {
        type: event.type,
        title: formatEvent(event),
        time: event.created_at,
        url: getEventUrl(event),
      }
    }
  }

  return { openIssues, openDispatches, latestEvent }
}

function formatEvent(event: { type: string; payload?: { action?: string; commits?: { message: string }[]; issue?: { title: string }; pull_request?: { title: string } } }): string {
  switch (event.type) {
    case "PushEvent":
      return event.payload?.commits?.[0]?.message?.split("\n")[0] || "Push"
    case "IssuesEvent":
      return `${event.payload?.action}: ${event.payload?.issue?.title || "issue"}`
    case "PullRequestEvent":
      return `PR ${event.payload?.action}: ${event.payload?.pull_request?.title || "PR"}`
    default:
      return event.type.replace("Event", "")
  }
}

function getEventUrl(event: { type: string; payload?: { issue?: { html_url: string }; pull_request?: { html_url: string } }; repo?: { name: string } }): string | undefined {
  if (event.payload?.issue?.html_url) return event.payload.issue.html_url
  if (event.payload?.pull_request?.html_url) return event.payload.pull_request.html_url
  return undefined
}
