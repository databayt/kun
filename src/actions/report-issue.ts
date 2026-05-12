"use server";

/**
 * Report-issue server action — thin wrapper around the shared pipeline.
 *
 * All quality gating (Zod, hard filters, captcha, dedup, AI triage, scoring)
 * lives in {@link runReportPipeline}. The client receives a symmetric success
 * shape so spammers can't probe the filter.
 */

import { runReportPipeline } from "@/lib/report";
import { kunReportAdapter } from "@/lib/report/adapter";
import { getClientIp } from "@/lib/rate-limit";

import type { ReportIssueSubmitInput, ReportIssueSubmitResult } from "@/components/report-issue/dialog";

export async function reportIssue(
  data: ReportIssueSubmitInput
): Promise<ReportIssueSubmitResult> {
  const ip = await getClientIp();
  const result = await runReportPipeline(
    {
      description: data.description,
      pageUrl: data.pageUrl,
      category: data.category,
      reproSteps: data.reproSteps,
      expected: data.expected,
      actual: data.actual,
      severityHint: data.severityHint,
      viewport: data.viewport,
      direction: data.direction,
      browser: data.browser,
      hasScreenshot: data.hasScreenshot,
      captchaToken: data.captchaToken,
    },
    kunReportAdapter,
    { ip }
  );

  // Symmetric success — silent-reject and verified-report both return ok:true.
  // Only verified-report (or duplicate-corroboration) surfaces the issue number.
  if (result.ok && result.bucket === "verified-report" && result.issueNumber) {
    return { ok: true, issueNumber: result.issueNumber };
  }
  if (result.ok) {
    return { ok: true };
  }
  return { ok: false };
}
