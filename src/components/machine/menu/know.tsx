import Link from "next/link";

import type { Locale } from "@/components/local/config";
import type { TeamResponse } from "./data";
import { tr } from "../chat/config";
import { copy, repoName } from "./config";
import type { RepoRow } from "./data";
import { Column, Dot, quiet, smallRow, subClass } from "./ui";

function ago(iso: string | null, lang: Locale, never: string): string {
  if (!iso) return never;
  const secs = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [["day", 86400], ["hour", 3600], ["minute", 60]];
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
  for (const [u, s] of units) if (Math.abs(secs) >= s) return rtf.format(Math.round(secs / s), u);
  return rtf.format(0, "minute");
}

/** Column 4: the department's repos (local or not), docs (kun site, opens outside) and people. */
export function Know({
  lang,
  repos,
  localRepos,
  docs,
  team,
}: {
  lang: Locale;
  repos: string[];
  localRepos: RepoRow[];
  docs: string[];
  team: TeamResponse | null;
}) {
  const isAr = lang === "ar";
  const t = tr(isAr);
  const local = new Set(localRepos.filter((r) => r.local).map((r) => r.name));
  const people = team?.machines ?? [];
  return (
    <Column title={t(copy.know)}>
      {repos.length > 0 && (
        <>
          <h3 className={`${subClass} pt-0`}>{t(copy.repos)}</h3>
          <ul>
            {repos.map((r) => (
              <li key={r}>
                <Link href={`/${lang}/machine/repos`} className={`${smallRow} transition-colors hover:text-muted-foreground`}>
                  <Dot kind={local.has(r) ? "solid" : "ring"} />
                  <span dir="auto" className="min-w-0 flex-1 truncate">{repoName(r, isAr)}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{local.has(r) ? t(copy.local) : t(copy.remote)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {docs.length > 0 && (
        <>
          <h3 className={`${subClass} ${repos.length === 0 ? "pt-0" : ""}`}>{t(copy.docs)}</h3>
          <ul>
            {docs.map((d) => (
              <li key={d}>
                <a
                  href={`https://kun.databayt.org/${lang}/docs/${d}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`${smallRow} transition-colors hover:text-muted-foreground`}
                >
                  <span dir="ltr" className="truncate">{d}</span>
                  <span aria-hidden className="text-muted-foreground">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      {people.length > 0 && (
        <>
          <h3 className={`${subClass} ${repos.length + docs.length === 0 ? "pt-0" : ""}`}>{t(copy.people)}</h3>
          <ul>
            {people.map((m) => (
              <li key={m.login} className={smallRow} title={m.currentTask ?? undefined}>
                <Dot kind={m.healthOk === true ? "solid" : m.healthOk === false ? "bad" : "ring"} />
                <span dir="auto" className="min-w-0 flex-1 truncate">{m.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{ago(m.lastSeenAt, lang, t(copy.never))}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {repos.length + docs.length + people.length === 0 && <p className={quiet}>—</p>}
    </Column>
  );
}
