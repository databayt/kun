// ── Greenhouse: read the form's questions, fill it, submit it ────────────────
//
// Greenhouse publishes each job's application questions on its public board
// API (?questions=true), and the hosted form (job-boards.greenhouse.io/embed)
// uses the API's field names as element ids. So answers are decided from the
// API before a browser opens (ats-answers.ts), and the browser only types.
//
// Selects are react comboboxes: click, type the option, pick the exact
// option. Success is Greenhouse's confirmation text; anything else — a field
// error, a CAPTCHA challenge, a timeout — is reported, never assumed.

import type { Page } from "playwright-core";

import type { Answer, AtsQuestion } from "@/lib/jobs/ats-answers";

export function parseGreenhouse(
  applyUrl: string,
): { token: string; id: string } | null {
  const u = new URL(applyUrl);
  const token = u.searchParams.get("for");
  const id = u.searchParams.get("token");
  return token && id ? { token, id } : null;
}

interface GhApiField {
  name: string;
  type: string;
  values?: { label: string; value: string | number }[];
}
interface GhApiQuestion {
  label: string;
  required: boolean;
  fields: GhApiField[];
}

/// Every question on the form: custom, location, EEOC compliance, demographic.
export async function greenhouseQuestions(
  token: string,
  id: string,
): Promise<AtsQuestion[] | null> {
  const res = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${token}/jobs/${id}?questions=true`,
    {
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!res.ok) return null;
  const d = (await res.json()) as {
    questions?: GhApiQuestion[];
    location_questions?: GhApiQuestion[];
    compliance?: { questions?: GhApiQuestion[] }[] | null;
    demographic_questions?: {
      questions?: {
        label: string;
        required: boolean;
        id: number;
        answer_options?: { label: string }[];
      }[];
    } | null;
  };
  const qs: AtsQuestion[] = [...(d.questions ?? [])];
  // Location is an autocomplete with hidden lat/long; one synthetic question.
  if ((d.location_questions ?? []).some((q) => q.required)) {
    qs.push({
      label: "Location (City)",
      required: true,
      fields: [{ name: "candidate-location", type: "location" }],
    });
  }
  for (const block of d.compliance ?? []) qs.push(...(block.questions ?? []));
  for (const q of d.demographic_questions?.questions ?? []) {
    qs.push({
      label: q.label,
      required: q.required,
      fields: [
        {
          // The form renders the bare question id (`4033064002`), not a
          // `demographic_` prefix — the prefix held every Discord card.
          name: String(q.id),
          type: "multi_value_single_select",
          values: (q.answer_options ?? []).map((o) => ({ label: o.label })),
        },
      ],
    });
  }
  return qs;
}

async function pickCombo(
  page: Page,
  selector: string,
  option: string,
): Promise<void> {
  const input = page.locator(selector).first();
  await input.click();
  await input.fill(option.slice(0, 40));
  const exact = page.getByRole("option", { name: option, exact: true }).first();
  if (await exact.count()) await exact.click();
  else await page.getByRole("option").first().click();
}

export interface FillPlan {
  answers: Map<string, { question: AtsQuestion; answer: Answer }>;
  prose: Record<string, string>; // question label → text written by the wave
  resumePath: string;
  coverLetterPath: string;
  city: string;
}

/// Fill the form. Returns the list of fields it could not set.
export async function fillGreenhouse(
  page: Page,
  plan: FillPlan,
): Promise<string[]> {
  const failed: string[] = [];
  for (const { question, answer } of plan.answers.values()) {
    const field = question.fields[0];
    const sel = `[id="${field.name}"]`;
    // Conditional fields (race appears only after ethnicity is answered)
    // may be hidden: an optional hidden field is simply not asked.
    if (answer.kind !== "file" && answer.kind !== "skip") {
      const el = page.locator(sel).first();
      if (!(await el.count()) || !(await el.isVisible())) {
        if (question.required)
          failed.push(`${question.label.slice(0, 60)}: field not on the page`);
        continue;
      }
    }
    try {
      switch (answer.kind) {
        case "skip":
          break;
        case "text":
          await page.locator(sel).first().fill(answer.value);
          break;
        case "prose": {
          const text = plan.prose[question.label];
          if (!text) throw new Error("no prose written");
          await page.locator(sel).first().fill(text);
          break;
        }
        case "select":
          await pickCombo(page, sel, answer.option);
          break;
        case "multi":
          for (const o of answer.options) await pickCombo(page, sel, o);
          break;
        case "check":
          if (answer.value)
            await page.locator(sel).first().check({ force: true });
          break;
        case "file":
          await page
            .locator(`input[type="file"][id="${answer.which}"]`)
            .setInputFiles(
              answer.which === "resume"
                ? plan.resumePath
                : plan.coverLetterPath,
            );
          break;
      }
    } catch (err) {
      failed.push(
        `${question.label.slice(0, 60)}: ${err instanceof Error ? err.message.split("\n")[0].slice(0, 80) : err}`,
      );
    }
  }
  // Location autocomplete (Google Places behind it): type the city, take the first match.
  const loc = page.locator('[id="candidate-location"]');
  if (await loc.count()) {
    try {
      await loc.click();
      await loc.pressSequentially(plan.city.split(",")[0], { delay: 80 });
      const option = page
        .getByRole("option")
        .filter({ hasText: /rwanda/i })
        .first();
      await option.waitFor({ timeout: 12_000 });
      await option.click();
    } catch {
      failed.push("location autocomplete");
    }
  }
  // Phone country code, when the form shows the picker.
  const country = page.locator('[id="country"]');
  if (await country.count()) {
    try {
      await pickCombo(page, '[id="country"]', "Rwanda");
    } catch {
      // optional on most forms
    }
  }
  return failed;
}

export type SubmitOutcome = { ok: true } | { ok: false; reason: string };

const CONFIRMED =
  /thank you for applying|application (has been )?(received|submitted)|we.ve received your application/i;

async function waitForOutcome(
  page: Page,
  ms: number,
  afterCode = false,
): Promise<"confirmed" | "code" | "invalid" | "captcha" | "timeout"> {
  try {
    await page.waitForFunction(
      // After the code is entered the prompt's text stays on the page, so the
      // second wait looks only for the confirmation or a field error.
      (afterCode: boolean) =>
        (afterCode
          ? /thank you for applying|application (has been )?(received|submitted)|we.ve received your application/i
          : /thank you for applying|application (has been )?(received|submitted)|we.ve received your application|verification code was sent/i
        ).test(document.body.innerText) ||
        !!document.querySelector(
          '[aria-invalid="true"], iframe[src*="recaptcha/api2/bframe"]',
        ),
      afterCode,
      { timeout: ms },
    );
  } catch {
    return "timeout";
  }
  const body = await page.evaluate(() => document.body.innerText);
  if (CONFIRMED.test(body)) return "confirmed";
  if (!afterCode && /verification code was sent/i.test(body)) return "code";
  if (await page.locator('iframe[src*="recaptcha/api2/bframe"]').count())
    return "captcha";
  return "invalid";
}

/// Submit; when Greenhouse emails a security code (Abdout's choice,
/// 2026-09-27: read it from his hotmail and enter it), `getCode` fetches it.
export async function submitGreenhouse(
  page: Page,
  getCode?: () => Promise<string | null>,
): Promise<SubmitOutcome> {
  const submit = () =>
    page
      .getByRole("button", { name: /submit application/i })
      .first()
      .click();
  await submit();
  let state = await waitForOutcome(page, 45_000);

  if (state === "code") {
    if (!getCode) return { ok: false, reason: "security code requested" };
    const code = await getCode();
    if (!code)
      return { ok: false, reason: "security code email did not arrive" };
    // Eight one-character boxes that auto-advance: focus the first, type all.
    const boxes = page.locator(
      'input[id^="security-input"], input[aria-label*="ecurity"], input[maxlength="1"]',
    );
    if (await boxes.count()) {
      await boxes.first().click();
      await page.keyboard.type(code, { delay: 60 });
    } else {
      await page
        .getByLabel(/security code/i)
        .first()
        .fill(code);
    }
    await submit();
    state = await waitForOutcome(page, 60_000, true);
  }

  if (state === "confirmed") return { ok: true };
  if (state === "captcha") return { ok: false, reason: "CAPTCHA challenge" };
  if (state === "timeout")
    return { ok: false, reason: "no confirmation within 45s" };
  const invalid = await page.evaluate(() =>
    [...document.querySelectorAll('[aria-invalid="true"]')]
      .map((e) => e.getAttribute("id") || e.getAttribute("name") || "?")
      .join(", "),
  );
  return { ok: false, reason: `form rejected fields: ${invalid || "unknown"}` };
}
