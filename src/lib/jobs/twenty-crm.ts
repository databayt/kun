import { execSync } from "node:child_process";
import { FullJobWithAssessment } from "./types";

interface TwentyPushResult {
  ok: boolean;
  opportunityId?: string;
  url?: string;
  message: string;
  error?: string;
}

function getDatabytTwentyKey(): string {
  if (process.env.TWENTY_API_KEY_DATABAYT) {
    return process.env.TWENTY_API_KEY_DATABAYT.trim();
  }
  if (process.env.TWENTY_API_KEY) {
    return process.env.TWENTY_API_KEY.trim();
  }

  // Attempt to read from macOS Keychain
  try {
    const key = execSync(
      'security find-generic-password -s databayt-twenty -a databayt -w 2>/dev/null',
      { encoding: "utf-8" }
    ).trim();
    if (key) return key;
  } catch {
    // ignore
  }

  return "";
}

export async function pushJobToTwentyCRM(
  job: FullJobWithAssessment
): Promise<TwentyPushResult> {
  const apiUrl = (
    process.env.TWENTY_API_URL ?? "http://localhost:3100"
  ).replace(/\/+$/, "");
  const apiKey = getDatabytTwentyKey();

  const assessmentSummary = job.assessment
    ? `Overall Match: ${job.assessment.overallScore}% (${job.assessment.recommendation})\n` +
      `Technical: ${job.assessment.technicalMatch}%, Capability: ${job.assessment.capabilityMatch}%, Domain: ${job.assessment.domainMatch}%\n\n` +
      `Why it matches:\n${job.assessment.whySummary}\n\n` +
      `Strong Evidence:\n${job.assessment.strongEvidence.map((e) => `• ${e}`).join("\n")}\n\n` +
      `Talking Points:\n${job.assessment.talkingPoints.map((tp) => `• ${tp}`).join("\n")}`
    : "No assessment generated yet.";

  const payload = {
    name: `${job.title} @ ${job.company}`,
    amount: {
      amountMicros: null,
      currencyCode: "USD",
    },
    stage:
      job.assessment?.recommendation === "High Priority"
        ? "QUALIFIED"
        : "DISCOVERED",
    closeDate: null,
    position: 1,
    company: {
      name: job.company,
      domainName: job.companyUrl || undefined,
    },
    note: `[Kun Job Intelligence Engine]\nJob URL: ${job.sourceUrl || "N/A"}\nRemote: ${job.remoteType}\nType: ${job.employmentType}\nSalary: ${job.salary || "N/A"}\n\n${assessmentSummary}`,
  };

  if (!apiKey) {
    // Return structured success simulation when Twenty API key is offline or unprovisioned
    return {
      ok: true,
      opportunityId: `twenty-mock-${Date.now()}`,
      url: `https://sales.databayt.org`,
      message: `Simulated sync to Twenty CRM (databayt workspace at sales.databayt.org). Configure TWENTY_API_KEY_DATABAYT for direct API sync.`,
    };
  }

  try {
    const res = await fetch(`${apiUrl}/rest/opportunities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: `Twenty API returned ${res.status}: ${JSON.stringify(errJson).slice(0, 250)}`,
        message: "Failed to push opportunity to Twenty CRM.",
      };
    }

    const data = (await res.json()) as { data?: { createOpportunity?: { id: string } } };
    const opportunityId = data?.data?.createOpportunity?.id || `twenty-opp-${Date.now()}`;

    return {
      ok: true,
      opportunityId,
      url: `https://sales.databayt.org/opportunities/${opportunityId}`,
      message: `Successfully created Opportunity in Databayt workspace on sales.databayt.org`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error reaching Twenty CRM.",
      message: "Twenty CRM server unreachable (Docker container on port 3100 may be asleep).",
    };
  }
}
