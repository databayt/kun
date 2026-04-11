"use server"

interface ReportData {
  description: string
  pageUrl: string
  category?: string
  viewport?: string
  direction?: string
  browser?: string
}

export async function reportIssue(data: ReportData) {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN
  const repo = process.env.GITHUB_REPO || "databayt/kun"
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  }

  if (!token) throw new Error("GITHUB_PERSONAL_ACCESS_TOKEN not configured")

  const title =
    data.description.length > 80
      ? data.description.slice(0, 77) + "..."
      : data.description

  const metadata = [
    `**Page**: \`${data.pageUrl}\``,
    `**Time**: ${new Date().toISOString()}`,
    data.category ? `**Category**: ${data.category}` : null,
    data.viewport ? `**Viewport**: ${data.viewport}` : null,
    data.direction ? `**Direction**: ${data.direction}` : null,
    data.browser ? `**Browser**: ${data.browser}` : null,
  ]
    .filter(Boolean)
    .join("\n")

  const body = [data.description, "", "---", "", metadata].join("\n")

  const payload: Record<string, unknown> = { title, body, labels: ["report"] }

  let response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  })

  // If 422 (label doesn't exist), create it then retry
  if (response.status === 422) {
    await fetch(`https://api.github.com/repos/${repo}/labels`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "report",
        color: "d93f0b",
        description: "User-reported issues",
      }),
    }).catch(() => {})

    response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    })
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    console.error(`[report-issue] GitHub API ${response.status}: ${text}`)
    throw new Error(`GitHub API error: ${response.status}`)
  }
}
