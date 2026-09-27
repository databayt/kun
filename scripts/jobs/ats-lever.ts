// ── Lever: read the hosted form's questions (for a paste-ready packet) ───────
//
// Lever's apply page carries hCaptcha, so under Abdout's rule (a CAPTCHA or
// bot block means HOLD, never evade — 2026-09-27) Lever is never submitted by
// the loop. This reads the form so the packet has every answer ready: the
// standard fields by their `name`, custom question cards by their label.

import type { AtsQuestion } from "@/lib/jobs/ats-answers";

const strip = (html: string): string =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/✱|\*/g, "")
    .replace(/\s+/g, " ")
    .trim();

/// Lever's standard field names → the names the answer engine knows.
const STANDARD: Record<string, string> = {
  name: "_systemfield_name",
  email: "_systemfield_email",
  phone: "_systemfield_phone",
  resume: "_systemfield_resume",
};

export async function leverQuestions(
  applyUrl: string,
): Promise<AtsQuestion[] | null> {
  const res = await fetch(applyUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/128 Safari/537.36",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return null;
  const html = await res.text();
  const qs: AtsQuestion[] = [];
  for (const block of html.split(/<li class="application-question/).slice(1)) {
    const chunk = block.slice(0, 6000);
    const label = strip(
      chunk.match(
        /class="application-label[^"]*"[^>]*>([\s\S]*?)<\/div>/,
      )?.[1] ?? "",
    );
    if (!label) continue;
    const required =
      /class="required"|required/.test(
        chunk.match(/class="application-label[\s\S]*?<\/div>/)?.[0] ?? "",
      ) || /\brequired\b/.test(chunk.slice(0, 1500));
    const name = chunk.match(/name="([^"]+)"/)?.[1] ?? label;
    const radios = [
      ...chunk.matchAll(/type="(?:radio|checkbox)"[^>]*value="([^"]*)"/g),
    ].map((m) => ({ label: strip(m[1]) }));
    const options = [
      ...chunk.matchAll(
        /<option[^>]*value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/g,
      ),
    ]
      .map((m) => ({ label: strip(m[2]) || m[1] }))
      .filter((o) => o.label && !/^select/i.test(o.label));
    const type = /type="file"/.test(chunk)
      ? "input_file"
      : /<textarea/.test(chunk)
        ? "textarea"
        : /type="checkbox"/.test(chunk)
          ? "multi_value_multi_select"
          : radios.length || options.length
            ? "multi_value_single_select"
            : "input_text";
    qs.push({
      label,
      required,
      fields: [
        {
          name: STANDARD[name] ?? name,
          type,
          values: radios.length ? radios : options,
        },
      ],
    });
  }
  return qs.length ? qs : null;
}
