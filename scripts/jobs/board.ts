// ── The board client for the send loop ───────────────────────────────────────
//
// The loop's state lives on the Twenty board (object kigaliOpportunity,
// workspace Databayt) — Abdout moves cards from his phone, so every step
// re-reads it rather than trusting a local copy.
//
// Conventions from content/docs/crm.mdx: port 3100, REST only, Keychain key,
// >= 700ms spacing.

import { execSync } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";

const API = (process.env.TWENTY_API_URL ?? "http://localhost:3100").replace(
  /\/+$/,
  "",
);
const PATH = "/rest/kigaliOpportunities";
const SPACING_MS = 800;

export interface BoardRow {
  id: string;
  name: string;
  campaign: string | null;
  tier: string | null;
  engineScore: number | null;
  applicationStatus: string | null;
  deadline: string | null;
  jobUrl?: { primaryLinkUrl?: string } | null;
  assessment?: { markdown?: string } | null;
  applyEmail: string | null;
  channel: string | null;
  variant: string | null;
  waveId: string | null;
  appliedAt: string | null;
  lastTouchAt: string | null;
  responseAt: string | null;
  touchNumber: number | null;
  holdReason: string | null;
  fingerprint: string | null;
  source: string | null;
  updatedAt: string;
}

let key = "";
function apiKey(): string {
  if (key) return key;
  key =
    process.env.TWENTY_API_KEY_DATABAYT?.trim() ||
    execSync(
      "security find-generic-password -s databayt-twenty -a databayt -w",
      { encoding: "utf-8" },
    ).trim();
  return key;
}

let last = 0;
async function call<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
  attempt = 1,
): Promise<T> {
  const wait = SPACING_MS - (Date.now() - last);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: init.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey()}`,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    // The Mac-hosted CRM drops a socket now and then (UND_ERR_SOCKET mid-body);
    // a retry is cheap, a dead wave is not.
    if (attempt >= 4) throw err;
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    return call<T>(path, init, attempt + 1);
  }
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    return call<T>(path, init, attempt + 1);
  }
  let body: T & { messages?: string[] };
  try {
    body = (await res.json()) as T & { messages?: string[] };
  } catch (err) {
    if (attempt < 4 && init.method === undefined) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      return call<T>(path, init, attempt + 1);
    }
    if (!res.ok) throw err;
    body = {} as T & { messages?: string[] };
  }
  if (!res.ok)
    throw new Error(
      `Twenty ${res.status} ${path}: ${JSON.stringify(body).slice(0, 200)}`,
    );
  return body;
}

export async function listBoard(): Promise<BoardRow[]> {
  const rows: BoardRow[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await call<{
      data: { kigaliOpportunities: BoardRow[] };
      pageInfo?: { hasNextPage?: boolean; endCursor?: string };
    }>(`${PATH}?limit=60${cursor ? `&starting_after=${cursor}` : ""}`);
    rows.push(...page.data.kigaliOpportunities);
    if (
      !page.pageInfo?.hasNextPage ||
      page.data.kigaliOpportunities.length === 0
    )
      break;
    cursor = page.pageInfo.endCursor;
  }
  return rows;
}

export async function getRow(id: string): Promise<BoardRow> {
  const res = await call<{ data: { kigaliOpportunity: BoardRow } }>(
    `${PATH}/${id}`,
  );
  return res.data.kigaliOpportunity;
}

export async function patchRow(
  id: string,
  fields: Partial<Record<keyof BoardRow, unknown>>,
): Promise<void> {
  await call(`${PATH}/${id}`, { method: "PATCH", body: fields });
}

/// Append a dated line to the card's assessment — the human-readable trail.
export async function noteRow(
  id: string,
  line: string,
  extra: Partial<Record<keyof BoardRow, unknown>> = {},
): Promise<void> {
  const row = await getRow(id);
  const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  await patchRow(id, {
    ...extra,
    assessment: {
      blocknote: null,
      markdown: `${row.assessment?.markdown ?? ""}\n\n${stamp} — ${line}`,
    },
  });
}

export const boardUrl = (id: string): string =>
  `https://sales.databayt.org/object/kigaliOpportunity/${id}`;

// ── the ledger: one JSON line per loop event, the learn step's raw data ──────

export interface LedgerEvent {
  ts?: string;
  kind: "sent" | "followup" | "reply" | "hold" | "queued" | "archive" | "error";
  crmId: string;
  name?: string;
  campaign?: string | null;
  variant?: string | null;
  waveId?: string | null;
  subject?: string;
  to?: string;
  detail?: string;
}

export function ledger(e: LedgerEvent): void {
  mkdirSync("jobs", { recursive: true });
  appendFileSync(
    "jobs/ledger.jsonl",
    JSON.stringify({ ts: new Date().toISOString(), ...e }) + "\n",
  );
}
