"use server"

interface DispatchResult {
  ok: boolean
  issueNumber?: number
  issueUrl?: string
  error?: string
}

export async function dispatch(
  repo: string,
  keyword: string,
  args?: string
): Promise<DispatchResult> {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN

  if (!token) {
    return { ok: false, error: "GITHUB_PERSONAL_ACCESS_TOKEN not configured" }
  }

  const title = `dispatch: ${keyword}${args ? ` ${args}` : ""}`
  const body = [
    `Triggered via Context UI`,
    "",
    `**Keyword**: \`${keyword}\``,
    args ? `**Arguments**: ${args}` : `**Arguments**: none`,
    `**Repository**: ${repo}`,
    `**Time**: ${new Date().toISOString()}`,
  ].join("\n")

  const payload: Record<string, unknown> = {
    title,
    body,
    labels: ["dispatch"],
  }

  let response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
    body: JSON.stringify(payload),
  })

  // If 422 (label doesn't exist), retry without labels
  if (response.status === 422) {
    delete payload.labels
    response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify(payload),
    })
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    return { ok: false, error: `GitHub API error: ${response.status} ${text}` }
  }

  const data = await response.json()
  return {
    ok: true,
    issueNumber: data.number,
    issueUrl: data.html_url,
  }
}
