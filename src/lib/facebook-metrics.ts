// Reading numbers back off a published Facebook post.
//
// The counterpart to social-utm.ts. UTM measures at the destination we own and
// works regardless of what a platform will tell us; this measures at the
// platform and needs its permission. Both are wanted — UTM proves someone
// arrived, this proves how many saw it at all, and the ratio between them is
// the only thing that says whether the copy or the reach is the problem.
//
// Deliberately split into two independent calls, because they fail
// independently and for different reasons:
//
//   engagement (reactions/comments/shares) — edge summaries on the post node,
//     gated by `pages_read_user_content`. Plain node fields, stable API.
//   insights (views/reach)                 — the /insights edge,
//     gated by `read_insights`. Metric names are versioned and churn.
//
// A token can hold one permission and not the other, so a combined call would
// report a total failure when half the data was actually available. Each half
// reports its own error.
//
// NOTE ON METRIC NAMES — read before debugging a (#100).
// Meta retired the whole `post_impressions*` family:
//   post_impressions        (2025-11-15) → post_media_view
//   post_impressions_unique (2025-06-15) → post_total_media_view_unique
// Those dates have passed, so the old names now return
// `(#100) The value must be a valid insights metric` on every API version.
// That is a METRIC error, not a permission error — a missing permission comes
// back as `(#10)`. Granting `read_insights` does not resurrect the old names,
// and re-probing with them after a grant will look exactly like the grant
// failed. classifyGraphError below exists so that mistake is not repeatable.
//
// `post_total_media_view_unique` is not identical to the old reach: it counts
// unique media views rather than unique people at the breakdown level. Do not
// compare a number from here against a pre-2025 reach figure.
//
// STATUS — verified end to end on 2026-07-27 against a live Hogwarts post
// (Page 1228948003637000), so nothing below is inferred from documentation:
//
//   read_insights            granted   post_media_view → 4
//   pages_read_user_content  granted   post_total_media_view_unique → 1
//
// Both permissions turned out to be Standard Access, auto-granted the moment
// they were added, with no App Review and no Business Verification. What was
// actually blocking them was neither review nor scope syntax: a permission has
// to be added to the app's Use Case (Dashboard → Use cases → Customize →
// Permissions and features) before it exists anywhere else in the console. Skip
// that and the Graph API Explorer's permission typeahead answers "Found 0
// results", which reads exactly like the permission having been withdrawn by
// Meta rather than never having been switched on. If a future scope looks
// impossible to request, check the Use Case first.

import { getFacebookConfig } from "@/lib/facebook";

// Both pinned to v25.0 because that is the only version the app can call.
// App Dashboard → App settings → Advanced → Upgrade API version offers exactly
// one option for app 874547138717755, and the Graph API Explorer's version
// dropdown likewise lists only v25.0: an app created after a version shipped
// cannot call anything older than the version current at its creation.
//
// This is worth knowing because it fails silently rather than loudly. Meta
// serves a call aimed at a version below the app's floor from the app's
// configured version instead of erroring, so `facebook.ts`'s GRAPH_VERSION =
// "v21.0" has been publishing against v25.0 all along and nothing ever said so.
// A version pin that the platform quietly ignores is worse than no pin, because
// it invites reasoning about a surface that is not the one being served.
// Left as two constants rather than one so the insights edge — whose metric
// names churn per version — can be moved independently of the node reads.
const INSIGHTS_GRAPH_VERSION = "v25.0";
const NODE_GRAPH_VERSION = "v25.0";

const METRIC_VIEWS = "post_media_view";
const METRIC_REACH = "post_total_media_view_unique";

export interface FacebookEngagement {
  reactions: number;
  comments: number;
  shares: number;
}

export interface FacebookReach {
  /** post_media_view — total times the post's media entered a screen. */
  views: number;
  /** post_total_media_view_unique — the post-2025 stand-in for reach. */
  reach: number;
}

export type MetricsFailure =
  | { kind: "not-configured"; error: string }
  | { kind: "permission"; error: string }
  | { kind: "bad-metric"; error: string }
  | { kind: "transport"; error: string };

export type MetricsResult<T> = ({ ok: true } & T) | ({ ok: false } & MetricsFailure);

interface GraphErrorBody {
  error?: { message?: string; code?: number };
}

// Graph puts the useful distinction in `code`, not in the prose. Classifying it
// here means a caller — or a human reading a failed metrics run — is told which
// of the two very different fixes applies: change the token, or change the
// metric name.
async function classifyGraphError(res: Response): Promise<MetricsFailure> {
  // Never include the request URL in anything returned or logged: it carries
  // the access token as a query parameter.
  const body = (await res.json().catch(() => null)) as GraphErrorBody | null;
  const message = body?.error?.message ?? `Facebook Graph API error ${res.status}`;
  const code = body?.error?.code;

  if (code === 10 || code === 200 || code === 190) {
    return { kind: "permission", error: message };
  }
  if (code === 100) {
    return {
      kind: "bad-metric",
      error: `${message} — this is a metric-name error, not a permissions one. See the retirement table in facebook-metrics.ts.`,
    };
  }
  return { kind: "transport", error: message };
}

function transportError(err: unknown, what: string): MetricsFailure {
  return {
    kind: "transport",
    error: err instanceof Error ? err.message : `Failed to read ${what} from Facebook`,
  };
}

/**
 * Reactions, comments and shares for a published post.
 * Requires `pages_read_user_content` on the Page token.
 *
 * `externalId` is what sendFacebookPost returned — the feed post id.
 */
export async function getFacebookEngagement(
  externalId: string,
  product?: string,
): Promise<MetricsResult<FacebookEngagement>> {
  const { token } = await getFacebookConfig(product);
  if (!token) {
    return { ok: false, kind: "not-configured", error: "No Page access token for this product" };
  }

  try {
    const url = new URL(`https://graph.facebook.com/${NODE_GRAPH_VERSION}/${externalId}`);
    // summary(true) is what turns these edges into counts instead of pages of
    // rows — without it Graph returns the first 25 comments and no total.
    url.searchParams.set(
      "fields",
      "shares,comments.summary(true),reactions.summary(true)",
    );
    url.searchParams.set("access_token", token);

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { ok: false, ...(await classifyGraphError(res)) };

    const data = (await res.json().catch(() => null)) as {
      // `shares` is absent entirely on a post with zero shares, rather than 0.
      // Confirmed against a live post: comments and reactions came back as
      // summary objects reading 0, while `shares` simply was not in the
      // response body at all. Hence `?? 0` on all three rather than on two.
      shares?: { count?: number };
      // Graph attaches a debug notice to this call: total_count is the
      // APPROXIMATE node count on the edge, and the figure can diverge from the
      // rows actually returned depending on the commenters' privacy settings.
      // Treat it as an indicator, not an audited number.
      comments?: { summary?: { total_count?: number } };
      reactions?: { summary?: { total_count?: number } };
    } | null;

    return {
      ok: true,
      reactions: data?.reactions?.summary?.total_count ?? 0,
      comments: data?.comments?.summary?.total_count ?? 0,
      shares: data?.shares?.count ?? 0,
    };
  } catch (err: unknown) {
    return { ok: false, ...transportError(err, "engagement") };
  }
}

/**
 * Views and reach for a published post.
 * Requires `read_insights` on the Page token.
 *
 * A `bad-metric` failure here means the names above have been retired again —
 * check Meta's deprecated-metrics page, do not touch the token.
 */
export async function getFacebookReach(
  externalId: string,
  product?: string,
): Promise<MetricsResult<FacebookReach>> {
  const { token } = await getFacebookConfig(product);
  if (!token) {
    return { ok: false, kind: "not-configured", error: "No Page access token for this product" };
  }

  try {
    const url = new URL(
      `https://graph.facebook.com/${INSIGHTS_GRAPH_VERSION}/${externalId}/insights`,
    );
    url.searchParams.set("metric", [METRIC_VIEWS, METRIC_REACH].join(","));
    url.searchParams.set("access_token", token);

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { ok: false, ...(await classifyGraphError(res)) };

    const data = (await res.json().catch(() => null)) as {
      data?: Array<{
        name?: string;
        period?: string;
        values?: Array<{ value?: number }>;
      }>;
    } | null;

    // Graph answers with one entry per (metric, period) PAIR — not one per
    // metric — in no guaranteed order.
    //
    // Verified 2026-07-27 against a live Hogwarts post: two requested metrics
    // came back as three entries, because post_total_media_view_unique is
    // served at both `lifetime` and `day`. The `lifetime` entry carried the
    // real figure; the `day` entry carried one row per day, every one of them
    // zero. Matching on name alone and taking values[0] reads the right number
    // only while `lifetime` happens to sort first, and a silent flip to a
    // plausible-looking 0 is the kind of wrong that never gets caught. Match on
    // the period as well.
    const read = (name: string): number =>
      data?.data?.find((m) => m.name === name && m.period === "lifetime")
        ?.values?.[0]?.value ?? 0;

    return { ok: true, views: read(METRIC_VIEWS), reach: read(METRIC_REACH) };
  } catch (err: unknown) {
    return { ok: false, ...transportError(err, "reach") };
  }
}

/**
 * Both halves, each reporting independently.
 *
 * Returns whatever succeeded plus the errors for whatever did not, so a token
 * holding only one of the two permissions still yields half the picture rather
 * than nothing. `SocialMetric.reach` is fed from `reach`; `clicks` comes from
 * the UTM side and is not read here.
 */
export async function getFacebookPostMetrics(
  externalId: string,
  product?: string,
): Promise<{
  engagement: MetricsResult<FacebookEngagement>;
  reach: MetricsResult<FacebookReach>;
}> {
  const [engagement, reachResult] = await Promise.all([
    getFacebookEngagement(externalId, product),
    getFacebookReach(externalId, product),
  ]);
  return { engagement, reach: reachResult };
}
