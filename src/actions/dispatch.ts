"use server";

import { repos } from "@/components/root/context/config";
import { requireContributor } from "@/lib/auth-guard";

interface DispatchResult {
  ok: boolean;
  issueNumber?: number;
  issueUrl?: string;
  error?: string;
}

// Both are interpolated into a Markdown issue body, so bound them and refuse
// control characters rather than trusting the UI to have done it.
const MAX_KEYWORD = 100;
const MAX_ARGS = 500;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

function invalidText(value: string, max: number): boolean {
  return value.length > max || CONTROL_CHARS.test(value);
}

export async function dispatch(
  repo: string,
  keyword: string,
  args?: string,
): Promise<DispatchResult> {
  // First statement: this action creates issues with the org's PAT, so an
  // unauthenticated caller must never reach the network.
  if (!(await requireContributor())) {
    return { ok: false, error: "Unauthorized" };
  }

  // Allowlist rather than sanitise. `repo` is interpolated straight into the
  // GitHub API path, so accepting a free string invites endpoint confusion
  // (`../`, `@host`, absolute-URL-ish values). Membership is a stronger
  // guarantee than any escaping we could write.
  if (!repos.some((r) => r.github === repo)) {
    return { ok: false, error: "Unknown repository" };
  }

  if (!keyword || invalidText(keyword, MAX_KEYWORD)) {
    return { ok: false, error: "Invalid keyword" };
  }
  if (args && invalidText(args, MAX_ARGS)) {
    return { ok: false, error: "Invalid arguments" };
  }

  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN?.trim();
  if (!token) {
    return { ok: false, error: "GITHUB_PERSONAL_ACCESS_TOKEN not configured" };
  }

  const title = `dispatch: ${keyword}${args ? ` ${args}` : ""}`;
  const body = [
    `Triggered via Context UI`,
    "",
    `**Keyword**: \`${keyword}\``,
    args ? `**Arguments**: ${args}` : `**Arguments**: none`,
    `**Repository**: ${repo}`,
    `**Time**: ${new Date().toISOString()}`,
  ].join("\n");

  const payload: Record<string, unknown> = {
    title,
    body,
    labels: ["dispatch"],
  };

  const post = () =>
    fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify(payload),
    });

  let response = await post();

  // If 422 (label doesn't exist), retry without labels
  if (response.status === 422) {
    delete payload.labels;
    response = await post();
  }

  if (!response.ok) {
    // Log the body server-side; return only the status. GitHub error bodies
    // can echo request details, and this string is rendered to the client.
    const text = await response.text().catch(() => "");
    console.error(
      `[dispatch] GitHub API ${response.status} for ${repo}: ${text}`,
    );
    return { ok: false, error: `GitHub API error: ${response.status}` };
  }

  const data = await response.json();
  return {
    ok: true,
    issueNumber: data.number,
    issueUrl: data.html_url,
  };
}
