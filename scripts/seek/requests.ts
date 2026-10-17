// ── Client project requests: databayt.org /wizard → the board ───────────────
//
//   pnpm jobs:requests            dry run
//   pnpm jobs:requests --apply    create cards + ping Slack (the loop runs this)
//
// The marketing wizard opens a GitHub issue labelled `request` on
// databayt/marketing. It cannot write to Twenty itself: the site runs on
// Cloudflare and Cloudflare cannot TLS-handshake with the Tailscale Funnel the
// CRM sits behind (525). So the Mac pulls instead — each open request becomes
// a CLIENT_PROJECT card on HOLD (a person answers a client, never the loop).

import { execSync } from "node:child_process";

import { call, listBoard } from "./board";
import { notify } from "./notify";

const REPO = "databayt/marketing";

/// Dialling code → board country, for the markets Abdout sells in.
const DIAL: [RegExp, string][] = [
  [/^\+?250/, "RWANDA"],
  [/^\+?254/, "KENYA"],
  [/^\+?234/, "NIGERIA"],
  [/^\+?256/, "UGANDA"],
  [/^\+?255/, "TANZANIA"],
  [/^\+?249/, "SUDAN"],
  [/^\+?966/, "SAUDI_ARABIA"],
  [/^\+?971/, "UAE"],
  [/^\+?974/, "QATAR"],
];

interface Issue {
  number: number;
  title: string;
  body: string;
  url: string;
  createdAt: string;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const issues = JSON.parse(
    execSync(
      `gh issue list --repo ${REPO} --label request --state open --limit 50 --json number,title,body,url,createdAt`,
      {
        encoding: "utf-8",
      },
    ),
  ) as Issue[];
  const real = issues.filter(
    (i) => !/verification|safe to ignore|test/i.test(i.title),
  );
  const onBoard = new Set((await listBoard()).map((r) => r.fingerprint));
  let created = 0;
  for (const i of real) {
    const fingerprint = `wizard:${i.number}`;
    if (onBoard.has(fingerprint)) continue;
    const contact =
      i.body.match(/WhatsApp \/ email:\*\*\s*(.+)/)?.[1]?.trim() ?? "";
    const estimate = i.body.match(/Estimate:\*\*\s*(.+)/)?.[1]?.trim() ?? "";
    const phone = contact.replace(/[\s()-]/g, "");
    const country = DIAL.find(([re]) => re.test(phone))?.[1] ?? "OTHER";
    const email = /@/.test(contact) ? contact : null;
    const name = i.title.replace(/^Project request:\s*/i, "Client: ");
    console.log(
      `  + #${i.number} ${name} · ${country} · ${estimate} · ${contact}`,
    );
    if (!apply) continue;
    await call("/rest/kigaliOpportunities", {
      method: "POST",
      body: {
        name,
        campaign: "CLIENT_PROJECT",
        track: "DATABAYT",
        country,
        applicationStatus: "HOLD",
        holdReason: `Client request — answer within 24h on ${contact}. Scope + estimate: ${i.url}`,
        employmentType: "CONTRACT",
        remoteType: "REMOTE",
        source: "marketing-wizard",
        fingerprint,
        ...(email ? { applyEmail: email } : {}),
        jobUrl: {
          primaryLinkUrl: i.url,
          primaryLinkLabel: `wizard #${i.number}`,
          secondaryLinks: [],
        },
        assessment: { markdown: i.body, blocknote: null },
      },
    });
    notify(
      `New client request on databayt.org: ${name} (${estimate}) — ${contact}\n${i.url}`,
      "Client request",
    );
    created++;
  }
  console.log(
    `${real.length} open request(s) · ${apply ? `${created} carded` : "DRY RUN"}`,
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
