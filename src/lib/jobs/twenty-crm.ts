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
  "ai-training-gigs": "AI_TRAINING",
  "freelance-contracts": "FREELANCE",
  "rwanda-tenders-databayt": "TENDER",
  "engineering-contracts": "ENGINEERING_CONTRACT",
};

/// The Kigali object's `applicationStatus` SELECT is coarser than the engine's
/// JobOpportunityStatus: every pre-application state is TO_APPLY, and the
/// interview rounds collapse into INTERVIEW.
const STATUS_OPTION: Record<string, string> = {
  discovered: "TO_APPLY",
  analyzed: "TO_APPLY",
  qualified: "TO_APPLY",
  high_priority: "TO_APPLY",
  preparing: "TO_APPLY",
  ready_to_apply: "TO_APPLY",
  applied: "APPLIED",
  response: "RESPONSE",
  screen: "RESPONSE",
  interview: "INTERVIEW",
  technical_round: "INTERVIEW",
  final_round: "INTERVIEW",
  offer: "OFFER",
  rejected: "REJECTED",
  withdrawn: "ARCHIVED",
  ghosted: "ARCHIVED",
  archived: "ARCHIVED",
};

export function crmStatusFor(status: string): string | undefined {
  return STATUS_OPTION[status];
}

interface PushOptions {
  /// Override the text-matched lane when the source already knows it (a scan
  /// that went looking for AI-training gigs should not land in REMOTE_WORLDWIDE).
  campaignId?: string;
  /// YYYY-MM-DD; "rolling" and anything unparseable are left empty.
  deadline?: string;
  /// Free text appended to the assessment: how to apply, why it fits.
  note?: string;
}

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
  opts: PushOptions = {},
): Promise<TwentyPushResult> {
  const apiUrl = (process.env.TWENTY_API_URL ?? "http://localhost:3100").replace(/\/+$/, "");
  const apiKey = getDatabytTwentyKey();

  if (!apiKey) {
    // Never report success without a write: a fabricated id used to land in
    // JobOpportunity.twentyOpportunityId and point at nothing (kun#154).
    return {
      ok: false,
      error: "No Twenty API key",
      message:
        "Not synced — no Databayt API key. Set TWENTY_API_KEY_DATABAYT or the Keychain entry databayt-twenty/databayt.",
    };
  }

  const fingerprint = generateJobFingerprint(job.title, job.company, job.remoteType);
  const matchedCampaign =
    opts.campaignId && opts.campaignId in CAMPAIGN_OPTION
      ? opts.campaignId
      : evaluateCampaignMatches(job).find((id) => id in CAMPAIGN_OPTION);
  const deadline = opts.deadline && /^\d{4}-\d{2}-\d{2}$/.test(opts.deadline) ? `${opts.deadline}T23:59:00Z` : null;

  const assessment = job.assessment
    ? `${job.description}\n\n` +
      `Required: ${job.requiredSkills.join(", ")}\n` +
      (job.preferredSkills.length ? `Preferred: ${job.preferredSkills.join(", ")}\n` : "") +
      `\nEngine: ${job.assessment.overallScore}% ${job.assessment.recommendation} — ${job.assessment.whySummary}\n\n` +
      `Strong evidence:\n${job.assessment.strongEvidence.map((e) => `• ${e}`).join("\n")}\n\n` +
      `Talking points:\n${job.assessment.talkingPoints.map((t) => `• ${t}`).join("\n")}\n\n` +
      `Fingerprint: ${fingerprint}`
    : `${job.description}\n\nNo assessment generated yet.\n\nFingerprint: ${fingerprint}`;
  const assessmentWithNote = opts.note ? `${assessment}\n\nNote: ${opts.note}` : assessment;

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
        deadline,
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
        assessment: { blocknote: null, markdown: assessmentWithNote },
      },
    });

    if (!res.ok) {
      return {
        ok: false,
        error: `Twenty API returned ${res.status}: ${JSON.stringify(res.body).slice(0, 250)}`,
        message: "Failed to push into the Kigali object.",
      };
    }

    const opportunityId = res.body.data?.createKigaliOpportunity?.id ?? res.body.data?.id;
    if (!opportunityId) {
      return {
        ok: false,
        error: `Twenty returned ${res.status} without a record id`,
        message: "Push response had no id — check the Kigali object before retrying.",
      };
    }

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

/// Move a record along the pipeline. `status` is the engine's
/// JobOpportunityStatus; it is mapped onto the coarser CRM select. An optional
/// line is appended to the assessment so outcome feedback is kept somewhere a
/// human will read it — JobOpportunity has no column for it.
export async function updateTwentyApplicationStatus(
  opportunityId: string,
  status: string,
  logLine?: string,
): Promise<{ ok: boolean; message: string }> {
  const apiUrl = (process.env.TWENTY_API_URL ?? "http://localhost:3100").replace(/\/+$/, "");
  const apiKey = getDatabytTwentyKey();
  const applicationStatus = STATUS_OPTION[status];
  if (!apiKey) return { ok: false, message: "No Twenty API key." };
  if (!applicationStatus) return { ok: false, message: `No CRM status for "${status}".` };

  try {
    const body: Record<string, unknown> = { applicationStatus };
    if (logLine) {
      const current = await call(apiUrl, `${KIGALI_PATH}/${opportunityId}`, apiKey, { method: "GET" });
      const record = (current.body.data as unknown as {
        kigaliOpportunity?: { assessment?: { markdown?: string } };
      })?.kigaliOpportunity;
      const stamp = new Date().toISOString().slice(0, 10);
      body.assessment = {
        blocknote: null,
        markdown: `${record?.assessment?.markdown ?? ""}\n\n${stamp} — ${applicationStatus}: ${logLine}`,
      };
      await sleep(THROTTLE_MS);
    }
    const res = await call(apiUrl, `${KIGALI_PATH}/${opportunityId}`, apiKey, { method: "PATCH", body });
    return res.ok
      ? { ok: true, message: `CRM status → ${applicationStatus}` }
      : { ok: false, message: `Twenty API returned ${res.status}: ${JSON.stringify(res.body).slice(0, 200)}` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Twenty CRM unreachable." };
  }
}
