// Read-only ledger — closes the "variant-awareness" gap the status page names:
// until this, pending approvals, scheduled posts, publishes and their numbers
// were invisible without raw SQL. Server component, no actions, no pagination
// — visibility only; the composer above stays the only writer.

import type { Locale } from "@/components/local/config";
import { getSocialDict } from "@/components/root/social/dictionary";
import { db } from "@/lib/db";

export async function SocialLedger({
  lang,
}: {
  lang: Locale;
}): Promise<React.ReactElement | null> {
  const t = getSocialDict(lang);

  let rows;
  try {
    rows = await db.socialVariant.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        channel: true,
        status: true,
        text: true,
        scheduledFor: true,
        publishedAt: true,
        createdAt: true,
        piece: { select: { brand: true } },
        metrics: {
          orderBy: { fetchedAt: "desc" },
          take: 1,
          select: { reach: true, views: true },
        },
      },
    });
  } catch {
    // No DATABASE_URL (preview deployments) — the page must not die for a
    // panel that only adds visibility.
    return null;
  }

  // The id is load-bearing: the agent window's heading links down here ("see
  // what's already published"), so the target has to be nameable.
  return (
    <section id="social-ledger" className="mt-10">
      {/* The one stage that had no name on it. Every other stage says what it
          is in a word; this one opened straight into a table. Not the full
          screen frame — that belongs to the stages with a box to lock around,
          and a ledger has nothing to engage. */}
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          {t.measureStageTitle}
        </h2>
      </div>
      <h3 className="mb-3 text-sm font-medium">{t.ledgerTitle}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.ledgerEmpty}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-3 py-2 text-start font-medium">
                  {t.ledgerBrand}
                </th>
                <th className="px-3 py-2 text-start font-medium">
                  {t.ledgerChannel}
                </th>
                <th className="px-3 py-2 text-start font-medium">
                  {t.ledgerText}
                </th>
                <th className="px-3 py-2 text-start font-medium">
                  {t.ledgerStatus}
                </th>
                <th className="px-3 py-2 text-start font-medium">
                  {t.ledgerWhen}
                </th>
                <th className="px-3 py-2 text-start font-medium">
                  {t.ledgerReach}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const when =
                  row.publishedAt ?? row.scheduledFor ?? row.createdAt;
                const metric = row.metrics[0];
                return (
                  <tr
                    key={row.id}
                    className="border-b border-border align-top last:border-0"
                  >
                    <td className="px-3 py-2">{row.piece.brand}</td>
                    <td className="px-3 py-2">{row.channel}</td>
                    <td className="px-3 py-2">
                      <div
                        className="max-w-[28ch] truncate text-muted-foreground"
                        title={row.text}
                      >
                        {row.text}
                      </div>
                    </td>
                    {/* System state and timestamps read LTR whatever the page direction. */}
                    <td className="px-3 py-2 font-mono text-xs" dir="ltr">
                      {row.status}
                    </td>
                    <td
                      className="whitespace-nowrap px-3 py-2 font-mono text-xs"
                      dir="ltr"
                    >
                      {when.toLocaleString(lang === "ar" ? "ar" : "en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs" dir="ltr">
                      {metric ? `${metric.reach} / ${metric.views}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
