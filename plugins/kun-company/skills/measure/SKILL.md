---
name: measure
description: Read the numbers back — platform reach and engagement plus UTM attribution, per post and per brand
when_to_use: "Use when asking how published posts actually performed — reach, views, reactions, comments, shares, or UTM-attributed traffic, per post, per channel, or per brand, and whether the strategy's kill criteria can yet be judged. This reads numbers only: it never writes copy (/draft), never publishes (/publish), and is neither a bug report (/report) nor a deploy check (/watch). Triggers on: how did the post do, social metrics, reach and engagement, is social working, did anyone see it, أرقام المنشور, أداء المنشورات."
argument-hint: "[brand] [--since 30d] [--channel facebook] [--refresh]"
---

# Measure — what actually happened

The stage that makes the strategy falsifiable. Without it, "zero signal after
three months of consistent posting" is a kill criterion nobody can evaluate.

Arguments: $ARGUMENTS — brand, time window, channel, `--refresh` to pull fresh
numbers rather than read stored ones.

## Doctrine (inherits /social)

- **Name what cannot be measured.** A channel with no metric lane is reported as
  such, never shown as a zero — a zero reads as "nobody saw it" when the truth is
  "nobody counted."
- **UTM is the signal that survives.** A platform can retire a metric, gate it
  behind a permission, or answer with an approximate count. All three happened on
  one feature inside one year.

## Steps

1. **Refresh or read.** With `--refresh`, trigger the pull:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" "$SITE_URL/api/social/metrics"
   ```
   Otherwise read what is stored. The route runs six-hourly and skips posts under
   an hour old, so a just-published post legitimately has nothing yet.
2. **Read the numbers** — `SocialMetric` joined to `SocialVariant` and
   `SocialPiece`. It is a **time series**: take the latest row per variant _and_
   the delta from the previous one. The delta is usually the interesting number.
3. **Name the channels with no lane.** `METRIC_CHANNEL_IDS` is Facebook only today.
   Telegram exposes a per-post view count that the Bot API will not give a
   non-admin bot; every `manual` channel has no platform surface at all. Say so.
4. **Surface the stopped rows** — any variant with `metricsGaveUp` set, with its
   `metricsError`, and distinguish the two causes that look alike and are not:
   - **`permission`** — the token needs a scope. The fix is Meta's app **Use Case**
     (Dashboard → Use cases → Customize → Permissions and features), not App Review.
   - **`bad-metric`** — Meta retired the metric names again. The fix is
     `METRIC_VIEWS` / `METRIC_REACH` in `src/lib/facebook-metrics.ts`. **The token
     is fine.** Granting a scope does not resurrect a retired name, and re-probing
     with the old names after a grant looks exactly like the grant failing.

   Re-arm after fixing either:

   ```sql
   UPDATE "SocialVariant"
      SET "metricsGaveUp" = false, "metricsAttempts" = 0, "metricsError" = NULL
    WHERE "metricsGaveUp" = true;
   ```

5. **Report UTM attribution from PostHog.** Links are tagged at delivery
   (`utm_source=<channel>&utm_medium=social&utm_campaign=<brand>`), and since
   2026-07-30 the hogwarts site consumes them — posthog-js in
   `analytics-provider.tsx` (EU project 221194) autocaptures `utm_*` on every
   `$pageview`. Query via the PostHog MCP with HogQL:

   ```sql
   SELECT properties.utm_campaign AS brand,
          properties.utm_source   AS channel,
          count() AS pageviews
     FROM events
    WHERE event = '$pageview'
      AND properties.utm_medium = 'social'
      AND timestamp > now() - INTERVAL 30 DAY
    GROUP BY 1, 2
    ORDER BY 3 DESC
   ```

   Coverage is per-site and must be named: **hogwarts carries the snippet; kun
   and mkan do not yet**, so a zero for a campaign landing elsewhere means
   "nobody counted", not "nobody came". `SocialMetric.clicks` stays 0 by
   design — report platform reach and PostHog pageviews side by side, never
   merged. (Clicks backfill from PostHog into SocialMetric is a named
   follow-up, only if MCP-side reads prove insufficient.)

6. **Judge the kill criteria** — and say plainly whether the data can yet support
   the judgement. Scope coverage is per-product: verified on the hogwarts Page
   token, unverified on mkan and databayt, and sijillee and moalimee have no Page.

## Exit gate

A per-brand table of reach / views / engagement, each number carrying its
`fetchedAt`; every channel without a metric lane named as such rather than shown
as zero; and every `metricsGaveUp` variant listed with its classified cause and
the specific remedy.

## The scheduled sibling

`scripts/social-digest.mjs` (launchd, Fridays 09:00 via
`scripts/weekly-digest.sh`) is this skill's zero-token weekly floor: planned vs
shipped for the ISO week, latest Facebook numbers, 60-day dismissal lessons,
and lane health, delivered to Slack `#social` via Hermes (Telegram review chat
fallback). A hand-run `/measure` goes deeper — the digest never replaces the
kill-criteria judgement; it feeds the captain's Friday review. `--dry-run`
prints without delivering.
