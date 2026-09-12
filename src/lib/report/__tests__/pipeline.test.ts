/**
 * Orchestrator tests — a fake adapter records every call so the ORDER and the
 * COUNT of side effects are asserted, not just the verdict. GitHub is a
 * stubbed global fetch; Anthropic never runs (no ANTHROPIC_API_KEY).
 *
 * What this pins down:
 *   - junk never reaches the rate limiter, Redis, or GitHub (pure filters first)
 *   - captcha policy: "required" fails closed outside development, "optional" degrades
 *   - a team report opens an issue with the `team` label and lands needs-human
 *   - the recorded event carries durationMs and isTeam
 *   - the duplicate path comments instead of opening a second issue
 *
 * Run via: pnpm vitest run src/lib/report
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RateLimitError, type ReportAdapter } from "../adapters/adapter";
import { runReportPipeline } from "../pipeline";
import type { PipelineEvent, ReporterContext } from "../types";

// ─── fake adapter ──────────────────────────────────────────────────────────

interface FakeAdapterOptions {
  reporter: ReporterContext;
  captcha?: "required" | "optional";
  rateLimited?: boolean;
  recent?: string[];
  banned?: boolean;
}

function makeAdapter(opts: FakeAdapterOptions) {
  const calls: string[] = [];
  const events: PipelineEvent[] = [];
  const adapter: ReportAdapter = {
    repo: "databayt/test",
    hostAllowlist: ["*.databayt.org", "*.balqalam.com", "localhost"],
    captcha: opts.captcha,
    async getReporter() {
      calls.push("getReporter");
      return opts.reporter;
    },
    async checkRateLimit() {
      calls.push("checkRateLimit");
      if (opts.rateLimited) throw new RateLimitError();
    },
    async getRecentSelfSubmissions() {
      calls.push("getRecentSelfSubmissions");
      return opts.recent ?? [];
    },
    async getCorroborationCount() {
      calls.push("getCorroborationCount");
      return 0;
    },
    async isBanned() {
      calls.push("isBanned");
      return opts.banned ?? false;
    },
    async recordPipelineEvent(event) {
      calls.push("recordPipelineEvent");
      events.push(event);
    },
    async findExistingForUrl() {
      calls.push("findExistingForUrl");
      return null;
    },
  };
  return { adapter, calls, events };
}

// ─── fake GitHub ───────────────────────────────────────────────────────────

interface FakeGitHub {
  requests: Array<{ method: string; url: string; body: unknown }>;
  searchHits: Array<{ number: number; title: string; body: string }>;
}

function stubGitHub(): FakeGitHub {
  const gh: FakeGitHub = { requests: [], searchHits: [] };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      gh.requests.push({ method, url, body });

      if (url.includes("/search/issues")) {
        return new Response(
          JSON.stringify({
            items: gh.searchHits.map((h) => ({
              ...h,
              state: "open",
              labels: [{ name: "report" }],
              html_url: `https://github.com/databayt/test/issues/${h.number}`,
            })),
          }),
          { status: 200 },
        );
      }
      if (method === "POST" && /\/issues$/.test(url)) {
        return new Response(
          JSON.stringify({
            number: 4242,
            html_url: "https://github.com/databayt/test/issues/4242",
            comments_url:
              "https://api.github.com/repos/databayt/test/issues/4242/comments",
          }),
          { status: 201 },
        );
      }
      if (method === "POST" && /\/comments$/.test(url)) {
        return new Response(JSON.stringify({ id: 1 }), { status: 201 });
      }
      if (method === "POST" && /\/labels$/.test(url)) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    }),
  );
  return gh;
}

// ─── fixtures ──────────────────────────────────────────────────────────────

const team: ReporterContext = {
  kind: "authenticated",
  userId: "cmrkybll0000team",
  role: "ADMIN",
  emailVerified: true,
  accountAgeDays: 30,
  isSuspended: false,
  ipHash: "team01",
  isTeam: true,
};

const anon: ReporterContext = { kind: "anonymous", ipHash: "anon01" };

const teamReport = {
  description: "in the student drop down list not all the students appears",
  pageUrl: "https://demo.balqalam.com/en/students/enroll",
  category: "other",
  viewport: "1366x633",
  direction: "ltr",
  browser: "Mozilla/5.0 (Windows NT 10.0) Chrome/150.0.0.0 Safari/537.36",
  hasScreenshot: false,
};

const junk = {
  ...teamReport,
  description: "asdf asdf asdf asdf asdf asdf asdf asdf asdf asdf asdf",
};

beforeEach(() => {
  vi.stubEnv("GITHUB_PERSONAL_ACCESS_TOKEN", "ghp_test");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "");
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// ─── tests ─────────────────────────────────────────────────────────────────

describe("runReportPipeline — order of operations", () => {
  it("junk is rejected before the rate limiter, Redis, or GitHub are touched", async () => {
    const gh = stubGitHub();
    const { adapter, calls, events } = makeAdapter({ reporter: team });

    const res = await runReportPipeline(junk, adapter);

    expect(res).toEqual({ ok: true, bucket: "silent-reject" });
    expect(calls).toEqual(["getReporter", "recordPipelineEvent"]);
    expect(gh.requests).toHaveLength(0);
    expect(events[0]?.rejectReason).toBe("HF6_few_tokens");
    expect(events[0]?.durationMs).toBeTypeOf("number");
  });

  it("a malformed payload is a silent success with no reporter lookup", async () => {
    const gh = stubGitHub();
    const { adapter, calls } = makeAdapter({ reporter: team });

    const res = await runReportPipeline({ description: 42 }, adapter);

    expect(res).toEqual({ ok: true, bucket: "silent-reject" });
    expect(calls).toEqual(["recordPipelineEvent"]);
    expect(gh.requests).toHaveLength(0);
  });

  it("rate limiting is checked before any Redis ledger read", async () => {
    stubGitHub();
    const { adapter, calls, events } = makeAdapter({
      reporter: team,
      rateLimited: true,
    });

    const res = await runReportPipeline(teamReport, adapter);

    expect(res).toEqual({ ok: true, bucket: "silent-reject" });
    expect(calls).toEqual([
      "getReporter",
      "checkRateLimit",
      "recordPipelineEvent",
    ]);
    expect(events[0]?.rejectReason).toBe("HF8_rate_limited");
  });

  it("a non-rate-limit adapter failure (fail-closed config) propagates", async () => {
    stubGitHub();
    const { adapter } = makeAdapter({ reporter: team });
    adapter.checkRateLimit = async () => {
      throw new Error("Rate limiting is not configured");
    };
    await expect(runReportPipeline(teamReport, adapter)).rejects.toThrow(
      /not configured/,
    );
  });
});

describe("runReportPipeline — captcha policy", () => {
  // vitest runs with NODE_ENV=test, i.e. NOT development: the bypass is off.
  it("required (default): anonymous + no Turnstile key → refused, nothing created", async () => {
    const gh = stubGitHub();
    const { adapter } = makeAdapter({ reporter: anon });
    const anonReport = {
      ...teamReport,
      description:
        "The docs page for onboarding shows a 404 when I open the GitHub invitation link from step four.",
    };
    await expect(runReportPipeline(anonReport, adapter)).rejects.toThrow(
      /Captcha is not configured/,
    );
    expect(gh.requests.filter((r) => r.method === "POST")).toHaveLength(0);
  });

  it("optional: anonymous + no Turnstile key → accepted at degraded trust", async () => {
    const gh = stubGitHub();
    const { adapter, events } = makeAdapter({
      reporter: anon,
      captcha: "optional",
    });
    const anonReport = {
      ...teamReport,
      description:
        "The docs page for onboarding shows a 404 when I open the GitHub invitation link from step four.",
    };
    const res = await runReportPipeline(anonReport, adapter);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.bucket).not.toBe("silent-reject");
    const created = gh.requests.find(
      (r) => r.method === "POST" && /\/issues$/.test(r.url),
    );
    expect(created).toBeDefined();
    expect(events.at(-1)?.reporterKind).toBe("anonymous");
  });
});

describe("runReportPipeline — team lane", () => {
  it("a short team report opens a needs-human issue carrying the team label", async () => {
    const gh = stubGitHub();
    const { adapter, events } = makeAdapter({ reporter: team });

    const res = await runReportPipeline(teamReport, adapter, { ip: "1.2.3.4" });

    expect(res).toMatchObject({
      ok: true,
      bucket: "needs-human",
      issueNumber: 4242,
    });

    const created = gh.requests.find(
      (r) => r.method === "POST" && /\/issues$/.test(r.url),
    );
    expect(created).toBeDefined();
    const payload = created!.body as {
      title: string;
      body: string;
      labels: string[];
    };
    expect(payload.labels).toEqual(
      expect.arrayContaining(["report", "needs-human", "team"]),
    );
    expect(payload.labels).not.toContain("low-confidence");
    expect(payload.title).toBe(teamReport.description);
    expect(payload.body).toContain("**Reporter**: team · ADMIN (id:cmrkybll…)");
    expect(payload.body).toContain('"team": true');
    expect(payload.body).toContain("AI triage**: unavailable");

    // needs-human gets no auto-ack; only verified-report does.
    expect(gh.requests.filter((r) => /\/comments$/.test(r.url))).toHaveLength(
      0,
    );

    const final = events.at(-1)!;
    expect(final.outcome).toBe("needs-human");
    expect(final.isTeam).toBe(true);
    expect(final.issueNumber).toBe(4242);
    expect(final.dedupIdentifier).toBe("user:cmrkybll0000team");
    expect(final.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("the ledger reads and the GitHub search happen once each", async () => {
    const gh = stubGitHub();
    const { adapter, calls } = makeAdapter({ reporter: team });
    await runReportPipeline(teamReport, adapter);
    expect(calls.filter((c) => c === "getRecentSelfSubmissions")).toHaveLength(
      1,
    );
    expect(calls.filter((c) => c === "isBanned")).toHaveLength(1);
    expect(
      gh.requests.filter((r) => r.url.includes("/search/issues")),
    ).toHaveLength(1);
  });
});

describe("runReportPipeline — duplicates", () => {
  it("a near-verbatim re-report comments on the existing issue instead of opening one", async () => {
    const gh = stubGitHub();
    gh.searchHits = [
      {
        number: 382,
        title: teamReport.description,
        body: `${teamReport.description}\n\n---\n\n**Page**: \`${teamReport.pageUrl}\``,
      },
    ];
    const { adapter, events } = makeAdapter({ reporter: team });

    const res = await runReportPipeline(teamReport, adapter);

    expect(res).toEqual({
      ok: true,
      bucket: "verified-report",
      issueNumber: 382,
    });
    expect(
      gh.requests.find((r) => r.method === "POST" && /\/issues$/.test(r.url)),
    ).toBeUndefined();
    expect(
      gh.requests.find((r) => /\/issues\/382\/comments$/.test(r.url)),
    ).toBeDefined();
    expect(events.at(-1)?.outcome).toBe("duplicate-corroborated");
  });
});

describe("runReportPipeline — config", () => {
  it("refuses to run without a GitHub token", async () => {
    vi.stubEnv("GITHUB_PERSONAL_ACCESS_TOKEN", "");
    const { adapter, calls } = makeAdapter({ reporter: team });
    const res = await runReportPipeline(teamReport, adapter);
    expect(res).toEqual({ ok: false, error: "config" });
    expect(calls).toEqual([]);
  });
});
