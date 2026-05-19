"use client";

/**
 * Canonical Report Issue dialog — copied from /Users/abdout/codebase/src/components/report-issue/.
 *
 * Symmetric success: every accepted submission shows the same success toast
 * regardless of which bucket it landed in. Only verified-bucket results
 * surface the issue number (when the server action chooses to return it).
 *
 * Anti-abuse client-side mirror:
 *   - Description must be ≥30 chars and ≤2000 (HF1/HF2).
 *   - 60s cooldown after submit (HF9 — prevents the triple-click case).
 *   - Turnstile widget required when no session (HF3).
 */

import { Bug } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { REPORT_DICTIONARY, type ReportLang } from "./dictionary";

const REPORT_CATEGORIES = [
  "visual",
  "broken",
  "data",
  "slow",
  "confusing",
  "auth",
  "i18n",
  "other",
] as const;

const SEVERITIES = ["low", "medium", "high", "critical"] as const;

const MIN_DESCRIPTION = 30;
const MAX_DESCRIPTION = 2000;
const COOLDOWN_MS = 60_000;

export interface ReportIssueSubmitInput {
  description: string;
  pageUrl: string;
  category: (typeof REPORT_CATEGORIES)[number];
  reproSteps?: string;
  expected?: string;
  actual?: string;
  severityHint?: (typeof SEVERITIES)[number];
  viewport: string;
  direction: "ltr" | "rtl";
  browser: string;
  hasScreenshot: false;
  captchaToken?: string;
}

export interface ReportIssueSubmitResult {
  ok: boolean;
  issueNumber?: number;
}

export interface ReportIssueDialogProps {
  variant?: "text" | "icon";
  lang?: ReportLang;
  hasSession: boolean;
  onSubmit: (input: ReportIssueSubmitInput) => Promise<ReportIssueSubmitResult>;
  turnstileSiteKey?: string | undefined;
  signInHref?: string;
}

const inputClass =
  "border-input placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border bg-transparent px-3 py-2 text-sm focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export function ReportIssueDialog({
  variant = "text",
  lang,
  hasSession,
  onSubmit,
  turnstileSiteKey,
  signInHref = "/login",
}: ReportIssueDialogProps): React.JSX.Element {
  const effectiveLang = lang ?? detectLang();
  const t = REPORT_DICTIONARY[effectiveLang];

  const [open, setOpen] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [issueNumber, setIssueNumber] = React.useState<number | undefined>(undefined);
  const [lastSubmitAt, setLastSubmitAt] = React.useState<number | null>(null);

  const cooldownActive = lastSubmitAt !== null && Date.now() - lastSubmitAt < COOLDOWN_MS;
  const needsCaptcha = !hasSession && Boolean(turnstileSiteKey);
  const charCount = description.trim().length;
  const minMet = charCount >= MIN_DESCRIPTION;

  async function handleSubmit() {
    if (!minMet || cooldownActive) return;
    if (needsCaptcha && !captchaToken) return;
    setStatus("loading");

    const payload: ReportIssueSubmitInput = {
      description,
      pageUrl: typeof window !== "undefined" ? window.location.href : "",
      category: "other",
      viewport:
        typeof window !== "undefined"
          ? `${window.innerWidth}x${window.innerHeight}`
          : "0x0",
      direction:
        typeof document !== "undefined" && document.documentElement.dir === "rtl"
          ? "rtl"
          : "ltr",
      browser: typeof navigator !== "undefined" ? navigator.userAgent : "",
      hasScreenshot: false,
      captchaToken: captchaToken ?? undefined,
    };

    try {
      const res = await onSubmit(payload);
      if (res.ok) {
        setStatus("success");
        setIssueNumber(res.issueNumber);
        setLastSubmitAt(Date.now());
        setDescription("");
        setCaptchaToken(null);
        setTimeout(() => {
          setOpen(false);
          setStatus("idle");
          setIssueNumber(undefined);
        }, 1500);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  const successMessage = issueNumber
    ? t.successWithId.replace("{id}", String(issueNumber))
    : t.success;

  return (
    <>
      <TriggerButton
        variant={variant}
        label={t.triggerText}
        ariaLabel={t.triggerAriaLabel}
        onClick={() => setOpen(true)}
      />

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setStatus("idle");
            setIssueNumber(undefined);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.title}</DialogTitle>
          </DialogHeader>

          <textarea
            className={`${inputClass} min-h-[120px]`}
            placeholder={t.descriptionPlaceholder}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            minLength={MIN_DESCRIPTION}
            maxLength={MAX_DESCRIPTION}
          />
          <p className="text-xs text-muted-foreground">
            {t.descriptionHint.replace("{count}", String(charCount))}
          </p>

          {needsCaptcha && (
            <TurnstileSlot
              siteKey={turnstileSiteKey as string}
              onSuccess={setCaptchaToken}
              hint={t.captchaHint}
              linkText={t.captchaLink}
              linkHref={signInHref}
            />
          )}

          {status === "error" && <p className="text-destructive text-sm">{t.error}</p>}
          {cooldownActive && status !== "success" && (
            <p className="text-xs text-muted-foreground">{t.cooldown}</p>
          )}

          {status === "success" ? (
            <p className="text-sm text-green-600">{successMessage}</p>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={
                !minMet ||
                status === "loading" ||
                cooldownActive ||
                (needsCaptcha && !captchaToken)
              }
            >
              {status === "loading" ? t.submitting : t.submit}
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function TriggerButton({
  variant,
  label,
  ariaLabel,
  onClick,
}: {
  variant: "text" | "icon";
  label: string;
  ariaLabel: string;
  onClick: () => void;
}) {
  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
      >
        <Bug className="h-4 w-4" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline font-medium underline underline-offset-4 cursor-pointer"
    >
      {label}
    </button>
  );
}

interface TurnstileSlotProps {
  siteKey: string;
  onSuccess: (token: string) => void;
  hint: string;
  linkText: string;
  linkHref: string;
}

function TurnstileSlot({
  siteKey,
  onSuccess,
  hint,
  linkText,
  linkHref,
}: TurnstileSlotProps) {
  const Turnstile = React.useMemo(
    () =>
      React.lazy(async () => {
        const mod = await import("@marsidev/react-turnstile");
        return { default: mod.Turnstile };
      }),
    []
  );
  return (
    <div className="space-y-2">
      <React.Suspense fallback={<div className="h-16" />}>
        <Turnstile
          siteKey={siteKey}
          onSuccess={onSuccess}
          options={{ size: "flexible", theme: "auto" }}
        />
      </React.Suspense>
      <p className="text-xs text-muted-foreground">
        {hint}{" "}
        <a className="underline" href={linkHref}>
          {linkText}
        </a>
      </p>
    </div>
  );
}

function detectLang(): ReportLang {
  if (typeof document === "undefined") return "en";
  const htmlLang = document.documentElement.lang?.toLowerCase();
  return htmlLang?.startsWith("ar") ? "ar" : "en";
}
