# Security hardening takes priority over performance optimization

**ID**: D-20260726-security-hardening-before-performance
**Date**: 2026-07-26
**Decided by**: Cowork (audit) → founder (ratification pending)
**Type**: 2 (reversible — ordering of work, not an architecture change)
**Status**: proposed
**Reviewed-by**: 2026-08-15
**Tags**: #security #auth #server-actions #ci #performance #cowork-handoff

## Decision

Kun's "optimization" work is sequenced **security first, build gate second, performance third**,
shipped as three separate PRs in that order. The security PR deploys before the other two are opened.

Rationale: a full audit of `5203213` found three live production exposures on a **public**
repository. Performance work on an app anyone can log into is optimizing the wrong thing.

## Context — what the audit found

Verified firsthand against the working tree at `5203213`. File:line references are exact.

### Critical

1. **`src/auth.config.ts:16`** — the entire password check is `if (password !== "1234") return null`.
   The contributor emails it validates against (`abdout@databayt.org`, `ali@`, `samia@`, `sedon@`)
   are guessable, and also ship in the client bundle: four `"use client"` files
   (`cloud-tag.tsx`, `content.tsx`, `keyword-card.tsx`, `story-bar.tsx`) import
   `components/root/context/config.ts` by relative path. Anyone can sign in, reach `/en/social`,
   and post to the live Hogwarts, mkan, and databayt Facebook Pages.

2. **`src/actions/dispatch.ts`** — `"use server"` with no auth check of any kind. Holds
   `GITHUB_PERSONAL_ACCESS_TOKEN` and interpolates the caller-supplied `repo` argument raw into
   `https://api.github.com/repos/${repo}/issues`. It is **value**-imported by `dispatch-modal.tsx:6`
   and `keyword-card.tsx:6`, both `"use client"`, both on the public `/[lang]/context` route —
   so its Server Action ID is published and callable by any anonymous visitor. Line 61 returns the
   raw GitHub response body, making it a read-back oracle.

### High

3. **`src/actions/status.ts`** — same shape as dispatch; leaks private-repo issue titles and commit
   messages. Currently only **type**-imported (`status-bar.tsx:1`), so its ID is probably not
   published today. The auth gap is real regardless and one refactor away from being live.

4. **Every anti-abuse control in the report pipeline fails open.** `src/lib/rate-limit.ts:63`
   returns silently when Redis is absent; `:65` when the limiter is missing.
   `src/lib/report/pipeline.ts:76` skips captcha when Turnstile is unconfigured. Both `UPSTASH_*`
   and `TURNSTILE_SECRET_KEY` are optional in `.env.example`, so a production deploy missing them
   has no rate limiting and no captcha, silently.

5. **There is no `src/middleware.ts`.** Zero edge gating.
   `src/app/[lang]/(root)/context/page.tsx` is gated only in client code.

### Medium

6. `src/actions/post-social.ts:32-89` — the three `verify*Connection` actions check `session?.user`
   but skip `requireContributor()`, contradicting the file's own comment at lines 16-18.
7. `src/lib/social-token.ts:104` doesn't validate `p`/`c` against the enums; tokens are replayable
   (no nonce). Misposts are mitigated downstream by `social-publish.ts:36-49`; replay is not.
8. `report/adapter.ts:126-130` writes dedup key `user:${ipHash}` but `pipeline.ts:58` reads
   `user:${userId}` — dedup never fires for authenticated reporters.
9. `report/adapter.ts:145-151` reads `report:issue:${host}:${path}`, a key nothing writes — the
   whole corroboration path is dead code.

### The reason none of this was caught

`.github/workflows/config-drift.yml` is the **only** workflow, and it only checks plugin config
drift on PRs touching `.claude/**` or `plugins/**`. There is no build, typecheck, lint, or test
gate anywhere in CI. `package.json` has no test framework, no `typecheck` script, and
`"lint": "next lint"` invokes a command Next 16 removed. `next.config.ts` sets
`typescript: { ignoreBuildErrors: true }`.

**Measured 2026-07-26: `npx tsc --noEmit` on `5203213` returns 0 errors.** `ignoreBuildErrors`
is currently hiding nothing, which makes removing it free today and expensive later.
(Run `npx fumadocs-mdx` first to generate `@/.source/server`, or you get 4 phantom errors
all downstream of that one missing generated module.)

## Premortem

- *"It failed because we shipped the auth fix without setting the hashes in Vercel first."* —
  The replacement fails closed by design. `AUTH_PASSWORD_HASH_ABDOUT` must exist in Vercel's
  environment **before** the deploy goes live, or everyone is locked out of `/en/social`.
  Mitigation: state the deployment order in the PR description; setting abdout's hash alone unblocks.
- *"It failed because we tried to fix everything in one PR and couldn't review or revert it."* —
  Mitigation: three PRs, security first, deployed independently.
- *"It failed because the rate-limit fix locked out legitimate reporters in production."* —
  Mitigation: the dev bypass stays; only `NODE_ENV === "production"` with missing infra throws.
  `.env.example` moves the vars to required with a comment.
- *"It failed because someone 'simplified' the relay auth while in the area."* —
  `src/app/api/social/relay/route.ts` and `/api/social/cron/route.ts` are the best-defended
  surfaces in the repo. The length check before `crypto.timingSafeEqual` is load-bearing —
  that function **throws** on length mismatch. Do not touch them.

## Expected outcome

- **Success looks like**: no unauthenticated path to a live Facebook Page or to
  `GITHUB_PERSONAL_ACCESS_TOKEN`; `pnpm typecheck` and `pnpm build` gate every PR;
  `(root)` pages render static again.
- **Failure looks like**: lockout on deploy (recoverable — set the env var), or the security PR
  sitting unreviewed while performance work merges around it (not recoverable in reputation terms
  if the `1234` password is discovered first).
- **Probability of success**: 0.9 — the fixes are small and local. The risk is sequencing, not difficulty.

## Alternatives considered

1. **Add a database and a real user table.** Rejected — kun deliberately has no DB
   (`next-auth` JWT, no adapter, Upstash Redis optional). Per-contributor scrypt hashes in env
   vars solve this with `node:crypto` and no new infrastructure.
2. **GitHub OAuth restricted to the contributors allowlist.** Better long-term and worth doing
   later, but it needs an OAuth app registered by hand, which blocks the fix on a human step.
   Not acceptable while `1234` is live.
3. **Do performance first because it's visible to users.** Rejected — that is the decision this
   record exists to overrule.

## Action

- Owner: Abdout / Claude Code in `~/kun`
- Full task breakdown: `.claude/handoff/2026-07-26-optimization-prompt.md`
- Order: Tasks 1–4 (security PR) → Task 5 (build gate PR) → Tasks 6–7 (performance PR)
- Next checkpoint: security PR deployed and `AUTH_PASSWORD_HASH_ABDOUT` set in Vercel

## Review

(To be filled at reviewed-by date 2026-08-15.)
