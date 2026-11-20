import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { currentContributor } from "@/components/auth/auth";
import { isRTL, type Locale } from "@/components/local/config";
import { getDictionary } from "@/components/local/dictionaries";
import { db } from "@/lib/db";
import {
  fleetState,
  parseReadiness,
  relativeTime,
  type FleetState,
} from "@/components/root/machines/fleet";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Machines | Databayt",
  robots: { index: false },
};

const TONE: Record<FleetState, string> = {
  ok: "bg-emerald-500",
  attention: "bg-amber-500",
  stale: "bg-red-500",
};
const ROW_TONE: Record<FleetState, string> = {
  ok: "",
  attention: "",
  stale: "",
};

interface PageProps {
  params: Promise<{ lang: string }>;
}

export default async function MachinesPage({ params }: PageProps) {
  const { lang } = await params;
  const locale = lang as Locale;

  // Admin only: the signed-in contributor must be Abdout. Always enforced (no dev bypass) —
  // this page lists every teammate's machine.
  const session = await auth();
  if (!session?.user) {
    redirect(`/${lang}/login?callbackUrl=${encodeURIComponent(`/${lang}/machines`)}`);
  }
  const me = await currentContributor();
  if (me?.id !== "abdout") notFound();

  const d = (await getDictionary(locale)).machines;

  // Fails soft before the readiness migration is applied: fall back to the columns that exist.
  const [machines, requests] = await Promise.all([
    db.machine
      .findMany({ orderBy: { login: "asc" } })
      .catch(() => [] as Awaited<ReturnType<typeof db.machine.findMany>>),
    db.machineMessage
      .findMany({ where: { kind: "request" }, orderBy: { createdAt: "desc" }, take: 20 })
      .catch(() => []),
  ]);

  const now = Date.now();
  const rows = machines.map((m) => {
    const readiness = parseReadiness((m as { readiness?: unknown }).readiness);
    return { m, readiness, state: fleetState(m.lastSeenAt, readiness, now) };
  });
  const stateLabel: Record<FleetState, string> = {
    ok: d.ok,
    attention: d.attention,
    stale: d.stale,
  };

  return (
    <main dir={isRTL(locale) ? "rtl" : "ltr"} className="mx-auto max-w-5xl px-responsive py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{d.title}</h1>
      <p className="mt-2 text-muted-foreground">{d.subtitle}</p>

      {rows.length === 0 ? (
        <p className="mt-10 text-muted-foreground">{d.empty}</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-lg border">
          <table className="w-full text-start text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                {[d.login, d.os, d.version, d.lastSeen, d.readiness, d.failing, d.health].map((h) => (
                  <th key={h} className="px-3 py-2 text-start font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ m, readiness, state }) => (
                <tr key={m.id} className={`border-t ${ROW_TONE[state]}`}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-muted-foreground" dir="ltr">
                      {m.login}
                    </div>
                  </td>
                  <td className="px-3 py-2">{m.os || "—"}</td>
                  <td className="px-3 py-2" dir="ltr">
                    {m.appVersion || "—"}
                  </td>
                  <td className="px-3 py-2">{relativeTime(m.lastSeenAt, d, now)}</td>
                  <td className="px-3 py-2">
                    {readiness ? `${Math.round(readiness.percent)}%` : d.unknown}
                  </td>
                  <td className="max-w-xs px-3 py-2 text-xs" dir="ltr">
                    {readiness && readiness.failing.length > 0 ? readiness.failing.join(", ") : d.none}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      <span className={`size-2.5 rounded-full ${TONE[state]}`} aria-hidden />
                      {stateLabel[state]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-12 text-xl font-semibold">{d.requests}</h2>
      {requests.length === 0 ? (
        <p className="mt-3 text-muted-foreground">{d.noRequests}</p>
      ) : (
        <ul className="mt-3 divide-y rounded-lg border">
          {requests.map((r) => {
            const text = (r.body as { text?: string } | null)?.text ?? "";
            return (
              <li key={r.id} className="px-3 py-2 text-sm">
                <span className="font-medium" dir="ltr">
                  {r.fromLogin}
                </span>
                <span className="text-muted-foreground"> · {relativeTime(r.createdAt, d, now)}</span>
                <div>{text}</div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
