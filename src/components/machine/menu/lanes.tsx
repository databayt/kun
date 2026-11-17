import Link from "next/link";

import type { Locale } from "@/components/local/config";
import { tr } from "../chat/config";
import {
  copy,
  defaultRepos,
  promptHref,
  repoName,
  repoStarters,
  skillHow,
  skillStarter,
} from "./config";
import type { MachineProfile } from "../profile/types";
import { rowClass, Section, subClass } from "./section";

/** One column for every lane: a sub-heading per department, its starters and skills as big links. */
export function Lanes({
  lang,
  profile,
}: {
  lang: Locale;
  profile: MachineProfile;
}) {
  const isAr = lang === "ar";
  const t = tr(isAr);
  if (profile.departments.length === 0) return null;
  return (
    <Section title={t(copy.lanes)}>
      {profile.departments.map((d) => (
        <div key={d.name}>
          <h3 className={subClass}>{(isAr && d.title_ar) || d.title}</h3>
          <ul>
            {d.quick_actions.map((q) => (
              <li key={q.prompt}>
                <Link href={promptHref(lang, q.prompt)} className={rowClass}>
                  <span className="truncate">
                    {isAr ? q.label_ar : q.label_en}
                  </span>
                </Link>
              </li>
            ))}
            {d.skills.map((s) => (
              <li key={s.name} className="flex items-center">
                <Link
                  href={promptHref(lang, skillStarter(s.title, isAr))}
                  title={s.description}
                  className={`${rowClass} min-w-0 flex-1`}
                >
                  <span dir="auto" className="truncate">
                    {s.title}
                  </span>
                </Link>
                <Link
                  href={promptHref(lang, skillHow(s.name))}
                  aria-label={`${t(copy.how)}: ${s.title}`}
                  className="shrink-0 ps-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t(copy.how)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Section>
  );
}

/** One row per repo, each with three learn starters. */
export function Knowledge({
  lang,
  repos,
}: {
  lang: Locale;
  repos: string[] | null;
}) {
  const isAr = lang === "ar";
  const t = tr(isAr);
  const list = repos ?? defaultRepos;
  if (list.length === 0) return null;
  return (
    <Section title={t(copy.knowledge)}>
      <ul>
        {list.map((r) => (
          <li key={r}>
            <h3 className={subClass}>{repoName(r, isAr)}</h3>
            <ul>
              {repoStarters(r, isAr).map((s) => (
                <li key={s.label}>
                  <Link href={promptHref(lang, s.prompt)} className={rowClass}>
                    <span dir="auto" className="truncate">
                      {s.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Section>
  );
}
