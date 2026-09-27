// ── Ashby: read the form, fill it, submit it ─────────────────────────────────
//
// Ashby's hosted page loads its application form from a public GraphQL call
// (ApiJobPosting → applicationForm); the same call, made directly, gives every
// field's path, type, title, required flag and options. The DOM uses the path
// as the input's id/name, so answers are decided before the browser opens
// (ats-answers.ts) and the browser only types — same as Greenhouse.
//
// Booleans are Yes/No buttons, short ValueSelects are radio-style buttons,
// long ones a combobox; the location is an autocomplete.

import type { Locator, Page } from "playwright-core";

import type { Answer, AtsQuestion } from "@/lib/jobs/ats-answers";

import type { FillPlan, SubmitOutcome } from "./ats-greenhouse";

export function parseAshby(
  applyUrl: string,
): { org: string; id: string } | null {
  const m = new URL(applyUrl).pathname.match(/^\/([^/]+)\/([0-9a-f-]{36})/i);
  return m ? { org: m[1], id: m[2] } : null;
}

const QUERY = `query ApiJobPosting($organizationHostedJobsPageName: String!, $jobPostingId: String!) {
  jobPosting(organizationHostedJobsPageName: $organizationHostedJobsPageName, jobPostingId: $jobPostingId) {
    id title locationName workplaceType
    applicationForm { sections { fieldEntries { field isRequired isHidden } } }
  }
}`;

const TYPE: Record<string, string> = {
  String: "input_text",
  Email: "input_text",
  Phone: "input_text",
  Url: "input_text",
  Number: "input_text",
  Date: "input_text",
  LongText: "textarea",
  Boolean: "boolean",
  ValueSelect: "multi_value_single_select",
  MultiValueSelect: "multi_value_multi_select",
  Location: "location",
  File: "input_file",
};

interface AshbyField {
  path: string;
  title?: string;
  type: string;
  selectableValues?: { label: string; value: string }[];
}

export async function ashbyQuestions(
  org: string,
  id: string,
): Promise<AtsQuestion[] | null> {
  const res = await fetch(
    "https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobPosting",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        operationName: "ApiJobPosting",
        variables: { organizationHostedJobsPageName: org, jobPostingId: id },
        query: QUERY,
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!res.ok) return null;
  const d = (await res.json()) as {
    data?: {
      jobPosting?: {
        applicationForm?: {
          sections: {
            fieldEntries: {
              field: AshbyField;
              isRequired: boolean;
              isHidden: boolean;
            }[];
          }[];
        };
      } | null;
    };
  };
  const form = d.data?.jobPosting?.applicationForm;
  if (!form) return null;
  const qs: AtsQuestion[] = [];
  for (const section of form.sections) {
    for (const fe of section.fieldEntries) {
      if (fe.isHidden) continue;
      const f = fe.field;
      // A custom file field titled "cover letter" is the cover letter slot.
      const name =
        f.type === "File" &&
        /cover/i.test(f.title ?? "") &&
        f.path !== "_systemfield_resume"
          ? "_systemfield_cover_letter"
          : f.path;
      qs.push({
        label: f.title ?? f.path,
        required: fe.isRequired,
        fields: [
          {
            name,
            type: TYPE[f.type] ?? f.type,
            values: (f.selectableValues ?? []).map((v) => ({
              label: v.label,
              value: v.value,
            })),
          },
        ],
        // the real DOM path, when the name above was normalised
        ...(name !== f.path ? { domPath: f.path } : {}),
      } as AtsQuestion & { domPath?: string });
    }
  }
  return qs;
}

function container(page: Page, path: string): Locator {
  return page
    .locator(`[name="${path}"], [id="${path}"]`)
    .first()
    .locator('xpath=ancestor::div[contains(@class,"fieldEntry")][1]');
}

async function choose(page: Page, path: string, option: string): Promise<void> {
  const box = container(page, path);
  const button = box.getByRole("button", { name: option, exact: true });
  if (await button.count()) return button.first().click();
  const radio = box.getByRole("radio", { name: option, exact: true });
  if (await radio.count()) return radio.first().check({ force: true });
  const label = box.getByText(option, { exact: true });
  if (await label.count()) return label.first().click();
  const combo = box
    .locator(
      'input[role="combobox"], input[placeholder*="Start typing"], input[type="text"]',
    )
    .first();
  await combo.click();
  await combo.fill(option.slice(0, 40));
  await page.getByRole("option", { name: option, exact: true }).first().click();
}

export async function fillAshby(page: Page, plan: FillPlan): Promise<string[]> {
  const failed: string[] = [];
  for (const { question, answer } of plan.answers.values()) {
    const field = question.fields[0];
    const path =
      (question as AtsQuestion & { domPath?: string }).domPath ?? field.name;
    try {
      await fillOne(page, path, question, answer, plan);
    } catch (err) {
      failed.push(
        `${question.label.slice(0, 60)}: ${err instanceof Error ? err.message.split("\n")[0].slice(0, 80) : err}`,
      );
    }
  }
  // Location autocomplete: type the city, take the Rwanda suggestion.
  const loc = container(page, "_systemfield_location").locator("input").first();
  if (
    await page
      .locator('[name="_systemfield_location"], [id="_systemfield_location"]')
      .count()
  ) {
    try {
      await loc.click();
      await loc.pressSequentially(plan.city.split(",")[0], { delay: 80 });
      const opt = page
        .getByRole("option")
        .filter({ hasText: /rwanda/i })
        .first();
      await opt.waitFor({ timeout: 12_000 });
      await opt.click();
    } catch {
      failed.push("location autocomplete");
    }
  }
  return failed;
}

async function fillOne(
  page: Page,
  path: string,
  question: AtsQuestion,
  answer: Answer,
  plan: FillPlan,
): Promise<void> {
  switch (answer.kind) {
    case "skip":
      return;
    case "text":
      await page
        .locator(`[id="${path}"], [name="${path}"]`)
        .first()
        .fill(answer.value);
      return;
    case "prose": {
      const text = plan.prose[question.label];
      if (!text) throw new Error("no prose written");
      await page.locator(`[id="${path}"], [name="${path}"]`).first().fill(text);
      return;
    }
    case "check":
      await choose(page, path, answer.value ? "Yes" : "No");
      return;
    case "select":
      await choose(page, path, answer.option);
      return;
    case "multi":
      for (const o of answer.options) await choose(page, path, o);
      return;
    case "file": {
      const input = page
        .locator(
          `input[type="file"][id="${path}"], [id="${path}"] input[type="file"]`,
        )
        .first();
      const target = (await input.count())
        ? input
        : container(page, path).locator('input[type="file"]').first();
      await target.setInputFiles(
        answer.which === "resume" ? plan.resumePath : plan.coverLetterPath,
      );
      return;
    }
  }
}

export async function submitAshby(page: Page): Promise<SubmitOutcome> {
  await page
    .getByRole("button", { name: /submit application/i })
    .first()
    .click();
  try {
    await page.waitForFunction(
      () =>
        /application (was )?(successfully )?(submitted|received)|thank you for (applying|your application|your interest)|thanks for applying/i.test(
          document.body.innerText,
        ) ||
        /(is required|missing|invalid|flagged as spam|suspicious|try again)/i.test(
          document.body.innerText,
        ),
      undefined,
      { timeout: 45_000 },
    );
  } catch {
    return { ok: false, reason: "no confirmation within 45s" };
  }
  const body = await page.evaluate(() => document.body.innerText);
  if (
    /application (was )?(successfully )?(submitted|received)|thank you for (applying|your application|your interest)|thanks for applying/i.test(
      body,
    )
  ) {
    return { ok: true };
  }
  const why =
    body.match(
      /[^\n]*(is required|missing|invalid|flagged as spam|suspicious|try again)[^\n]*/i,
    )?.[0] ?? "unknown";
  return { ok: false, reason: `form said: ${why.slice(0, 160)}` };
}
