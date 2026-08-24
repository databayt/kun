import { execSync } from "node:child_process";

import { evaluateCampaignMatches } from "./campaigns";
import { generateJobFingerprint } from "./deduplication";
import { FullJobWithAssessment } from "./types";

// ── Push a job into the Kigali object in the Databayt workspace ──────────────
//
// Target is the custom `Kigali` object, NOT Opportunities. This used to post to
// /rest/opportunities with `stage: "QUALIFIED"`, an inline `company: {...}` and
// a top-level `note` string — three shapes the API does not accept. It never
// worked: the workspace has opportunities and zero notes, none named the way
// this function names them.
//
// Opportunity is a sales pipeline. It has no field for a campaign, a tier, an
// engine score or a job URL, and its stage enum is NEW|SCREENING|MEETING|
// PROPOSAL|CUSTOMER. Jobs get their own object; Databayt's deals keep theirs.
//
// Conventions from content/docs/crm.mdx: port 3100 (3000 is hogwarts' dev
// server and answers 307), REST only, Keychain auth, >=700ms spacing.

const KIGALI_PATH = "/rest/kigaliOpportunities";
const THROTTLE_MS = 800;

interface TwentyPushResult {
  ok: boolean;
  opportunityId?: string;
  url?: string;
  message: string;
  error?: string;
}

interface TwentyResponse {
  data?: Record<string, { id?: string } | undefined> & { id?: string };
}

/// The Kigali object's `campaign` SELECT. Campaign membership is recomputed
/// from the job text rather than stored, so the first matching lane wins and
/// the software lanes fall through to the remote option.
const CAMPAIGN_OPTION: Record<string, string> = {
  "kigali-protection-engineer": "PROTECTION",
  "kigali-electrical-engineer": "ELECTRICAL",
  "kivu-marine-eto": "MARINE_ETO",
  "kigali-web-developer": "WEB_DEVELOPER",
  "remote-web-developer-worldwide": "REMOTE_WORLDWIDE",
};

const TIER_OPTION: Record<string, string> = {
  "High Priority": "HIGH_PRIORITY",
  "Strong Fit": "STRONG_FIT",
  "Prepare & Apply": "PREPARE_AND_APPLY",
  "Low Probability": "LOW_PROBABILITY",
};

function getDatabytTwentyKey(): string {
  if (process.env.TWENTY_API_KEY_DATABAYT) {
    return process.env.TWENTY_API_KEY_DATABAYT.trim();
  }
  if (process.env.TWENTY_API_KEY) {
    return process.env.TWENTY_API_KEY.trim();
  }

  try {
    const key = execSync(
      "security find-generic-password -s databayt-twenty -a databayt -w 2>/dev/null",
      { encoding: "utf-8" },
    ).trim();
    if (key) return key;
  } catch {
    // ignore — fall through to the offline simulation below
  }

  return "";
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function call(
  apiUrl: string,
  path: string,
  apiKey: string,
  init: { method: string; body?: unknown },
): Promise<{ ok: boolean; status: number; body: TwentyResponse }> {
  const res = await fetch(`${apiUrl}${path}`, {
    method: init.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => ({}))) as TwentyResponse;
  return { ok: res.ok, status: res.status, body };
}

/// Companies are a relation, so the record needs a companyId. One list read and
/// an in-memory match beats a filter query the API version may not support.
async function resolveCompanyId(
  apiUrl: string,
  apiKey: string,
  job: FullJobWithAssessment,
): Promise<string | undefined> {
  const list = await call(apiUrl, "/rest/companies?limit=200", apiKey, { method: "GET" });
  const rows = ((list.body.data as unknown as { companies?: { id: string; name: string }[] })
    ?.companies ?? []) as { id: string; name: string }[];

  const wanted = job.company.trim().toLowerCase();
  const hit = rows.find((c) => c.name.trim().toLowerCase() === wanted);
  if (hit) return hit.id;

  await sleep(THROTTLE_MS);
  const created = await call(apiUrl, "/rest/companies", apiKey, {
    method: "POST",
    body: {
      name: job.company,
      ...(job.companyUrl
        ? {
            domainName: {
              primaryLinkUrl: job.companyUrl,
              primaryLinkLabel: "",
              secondaryLinks: [],
            },
          }
        : {}),
    },
  });
  if (!created.ok) return undefined;
  return created.body.data?.createCompany?.id ?? created.body.data?.id;
}

export async function pushJobToTwentyCRM(
  job: FullJobWithAssessment,
): Promise<TwentyPushResult> {
  const apiUrl = (process.env.TWENTY_API_URL ?? "http://localhost:3100").replace(/\/+$/, "");
  const apiKey = getDatabytTwentyKey();

  if (!apiKey) {
    // Offline or unprovisioned: report a simulated sync rather than throwing,
    // so the /jobs card still gives the user an answer.
    return {
      ok: true,
      opportunityId: `twenty-mock-${Date.now()}`,
      url: "https://sales.databayt.org",
      message:
        "Simulated sync to the Kigali object (Databayt workspace, sales.databayt.org). Set TWENTY_API_KEY_DATABAYT for a real push.",
    };
  }

  const fingerprint = generateJobFingerprint(job.title, job.company, job.remoteType);
  const matchedCampaign = evaluateCampaignMatches(job).find((id) => id in CAMPAIGN_OPTION);

  const assessment = job.assessment
    ? `${job.description}\n\n` +
      `Required: ${job.requiredSkills.join(", ")}\n` +
      (job.preferredSkills.length ? `Preferred: ${job.preferredSkills.join(", ")}\n` : "") +
      `\nEngine: ${job.assessment.overallScore}% ${job.assessment.recommendation} — ${job.assessment.whySummary}\n\n` +
      `Strong evidence:\n${job.assessment.strongEvidence.map((e) => `• ${e}`).join("\n")}\n\n` +
      `Talking points:\n${job.assessment.talkingPoints.map((t) => `• ${t}`).join("\n")}\n\n` +
      `Fingerprint: ${fingerprint}`
    : `${job.description}\n\nNo assessment generated yet.\n\nFingerprint: ${fingerprint}`;

  try {
    // Idempotency. The button is a button — it gets pressed twice, and without
    // this the second press creates a second row. That is not hypothetical:
    // three identical "Full-Stack Engineer @ Databayt Tech Partner" rows were
    // created this way within five minutes of the object going live, and the
    // Opportunities object still carries older duplicates from the same habit.
    const existing = await call(
      apiUrl,
      `${KIGALI_PATH}?limit=200`,
      apiKey,
      { method: "GET" },
    );
    const rows = ((existing.body.data as unknown as {
      kigaliOpportunities?: { id: string; fingerprint?: string }[];
    })?.kigaliOpportunities ?? []) as { id: string; fingerprint?: string }[];
    const already = rows.find((r) => r.fingerprint === fingerprint);
    if (already) {
      return {
        ok: true,
        opportunityId: already.id,
        url: `https://sales.databayt.org/object/kigaliOpportunity/${already.id}`,
        message: "Already in the Kigali pipeline — opening the existing record.",
      };
    }
    await sleep(THROTTLE_MS);

    const companyId = await resolveCompanyId(apiUrl, apiKey, job);
    await sleep(THROTTLE_MS);

    const res = await call(apiUrl, KIGALI_PATH, apiKey, {
      method: "POST",
      body: {
        name: `${job.title} @ ${job.company}`,
        ...(companyId ? { companyId } : {}),
        campaign: matchedCampaign ? CAMPAIGN_OPTION[matchedCampaign] : null,
        tier: job.assessment ? TIER_OPTION[job.assessment.recommendation] ?? null : null,
        engineScore: job.assessment?.overallScore ?? null,
        applicationStatus: "TO_APPLY",
        remoteType: job.remoteType.toUpperCase(),
        employmentType: job.employmentType.toUpperCase(),
        location: job.location ?? null,
        ...(job.sourceUrl
          ? {
              jobUrl: {
                primaryLinkUrl: job.sourceUrl,
                primaryLinkLabel: "",
                secondaryLinks: [],
              },
            }
          : {}),
        source: job.source ?? null,
        fingerprint,
        // RICH_TEXT is a composite of { blocknote, markdown }, not a string.
        // Twenty renders blocknote from the markdown on write.
        assessment: { blocknote: null, markdown: assessment },
      },
    });

    if (!res.ok) {
      return {
        ok: false,
        error: `Twenty API returned ${res.status}: ${JSON.stringify(res.body).slice(0, 250)}`,
        message: "Failed to push into the Kigali object.",
      };
    }

    const opportunityId =
      res.body.data?.createKigaliOpportunity?.id ?? res.body.data?.id ?? `twenty-${Date.now()}`;

    return {
      ok: true,
      opportunityId,
      url: `https://sales.databayt.org/object/kigaliOpportunity/${opportunityId}`,
      message: "Added to the Kigali pipeline in the Databayt workspace.",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error reaching Twenty CRM.",
      message: "Twenty CRM unreachable — the Docker stack on port 3100 may be asleep.",
    };
  }
}
