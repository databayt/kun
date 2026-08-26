// Read-only ledger — closes the "variant-awareness" gap the status page names:
// until this, pending approvals, scheduled posts, publishes and their numbers
// were invisible without raw SQL. Server component, no actions, no pagination
// — visibility only; the composer above stays the only writer.
//
// Since 2026-08-26 it also wears the stage frame and the box, the last of the
// five to do so. The box is the same surface with nothing to press: it finds a
// row, and finding is the whole question here. The table stays underneath, the
// way Media's showroom and Calendar's plan do — the box answers "did Tuesday's
// post go out", the table answers "what has this brand been doing".

import type { Locale } from "@/components/local/config";
import { getSocialDict } from "@/components/root/social/dictionary";
import {
  MeasureStage,
  type LedgerPick,
} from "@/components/root/social/measure-spotlight";
import { db } from "@/lib/db";

/**
 * The last twenty variants, whatever their state.
 *
 * A named function rather than an inline call so the row type is inferred from
 * the select and can be named on the `let` below — `let rows;` plus an empty
 * array in the catch collapses to `any[]`, which is how a ledger starts
 * rendering `undefined` at a column nobody typed.
 */
function readLedger() {
  return db.socialVariant.findMany({
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
}

type LedgerRow = Awaited<ReturnType<typeof readLedger>>[number];

export async function SocialLedger({
  lang,
}: {
  lang: Locale;
}): Promise<React.ReactElement> {
  const t = getSocialDict(lang);

  let rows: LedgerRow[];
  try {
    rows = await readLedger();
  } catch {
    // No DATABASE_URL (preview deployments) — the page must not die for a
    // panel that only adds visibility. An empty list rather than null, so the
    // stage still renders its frame and its box: a blank screen reads as a
    // broken route, and an empty ledger reads as an empty ledger.
    rows = [];
  }

  const fmt = (d: Date) =>
    d.toLocaleString(lang === "ar" ? "ar" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  // Narrowed at the boundary: seven strings, not the piece relation and the
  // metrics array. `when` is formatted here rather than in the browser — the
  // two disagree about the timezone, and that is a hydration mismatch for no
  // gain.
  const picks: LedgerPick[] = rows.map((row) => {
    const metric = row.metrics[0];
    return {
      id: row.id,
      brand: row.piece.brand,
      channel: row.channel,
      text: row.text,
      status: row.status,
      when: fmt(row.publishedAt ?? row.scheduledFor ?? row.createdAt),
      reach: metric ? `${metric.reach} / ${metric.views}` : "—",
    };
  });

  // The id is load-bearing: the agent window's heading links down here ("see
  // what's already published"), so the target has to be nameable.
  const table = (
    <section id="social-ledger" className="mx-auto w-full max-w-4xl px-4 pb-16 md:pb-24">
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

  return <MeasureStage picks={picks} below={table} />;
}
