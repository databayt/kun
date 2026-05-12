# CDN migration to cdn.databayt.org

**ID**: D-20260425-cdn-databayt-org-migration
**Date**: 2026-04-25
**Decided by**: founder
**Type**: 1 (irreversible — DNS/CAA/IAM changes have multi-day blast radius)
**Status**: executed
**Reviewed-by**: 2026-07-25 (Q3 mid-quarter)
**Tags**: #infrastructure #aws #cdn #vercel-dns #backfilled

## Decision

Migrate CDN delivery for Hogwarts and other Databayt products from raw CloudFront URLs to a custom subdomain `cdn.databayt.org`, using an additive CNAME on the existing Vercel-hosted DNS. Reuse existing IAM user `hogwarts-s3-uploader` for S3 access. Bind ACM certificate to the CloudFront distribution `E3PHDXTDSBCQSJ`.

## Context

- AWS account 446731258367, S3 bucket `hogwarts-databayt`, CloudFront distribution `E3PHDXTDSBCQSJ` — all already provisioned.
- DNS lives on Vercel for `databayt.org`.
- Brand consistency: assets should be served from `databayt.org` family of domains, not `*.cloudfront.net`.
- Anthropic asset crawler also benefits from a stable hostname for cache + CSP rules.

## Premortem (retrospective)

- *"It failed because CAA records on databayt.org didn't allow Amazon to issue the cert."* — This was the actual gotcha encountered. Mitigated by adding a permissive CAA record temporarily, then locking down.
- *"It failed because Vercel CLI changes to DNS weren't idempotent."* — Mitigated by using additive CNAMEs, never destructive.
- *"It failed because IAM user permissions were over-broad."* — Reused existing `hogwarts-s3-uploader` IAM principle of least privilege; no expansion.

## Expected outcome

- **Success looks like**: All Hogwarts asset references resolve to `cdn.databayt.org`; CloudFront cache hit rate ≥ 90%; no broken images in production.
- **Failure looks like**: Cert issuance fails; assets 404 in production; rollback to raw CloudFront URLs.
- **Probability of success (at decision time)**: 0.85
- **Reasoning**: Standard pattern; only novel piece was the CAA gotcha and the Vercel-DNS-via-CLI step.

## Alternatives considered

1. **Stay on raw `*.cloudfront.net` URLs**: Rejected — brand consistency matters; locks us into one CDN forever.
2. **Use Vercel's built-in image optimization + CDN**: Rejected — costs more at scale, less control over cache rules, doesn't help with non-image assets (PDFs, font files).
3. **Use Cloudflare CDN**: Rejected — adds another vendor; AWS S3 + CloudFront already in place.

## Action

- Owner: Abdout
- Due: 2026-04-25
- Next checkpoint: 2026-07-25 (verify cache hit rate and no incidents)

## Review

(To be filled at reviewed-by date 2026-07-25.)

**Notes from backfill (2026-05-12)**: Migration completed successfully on 2026-04-25 per `/Users/abdout/.claude/projects/-Users-abdout-kun/memory/project_cdn_migration.md`. Specific gotchas captured (CAA, Vercel CLI, IAM reuse) — these are now part of the team's institutional knowledge.
