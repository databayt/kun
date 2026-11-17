import Link from "next/link"

import type { Locale } from "@/components/local/config"
import { tr } from "../chat/config"
import { copy, defaultRepos, promptHref, repoName, repoStarters, skillHow, skillStarter } from "./config"
import type { MachineProfile } from "../profile/types"
import { rowClass, Section } from "./section"

/** One card per department: its quick actions, then each skill as a starter with a "how it works" link. */
export function Lanes({ lang, profile }: { lang: Locale; profile: MachineProfile }) {
  const isAr = lang === "ar"
  const t = tr(isAr)
  if (profile.departments.length === 0) return null
  return (
    <>
      {profile.departments.map((d) => (
        <Section key={d.name} title={`${t(copy.lanes)} · ${(isAr && d.title_ar) || d.title}`}>
          <ul>
            {d.quick_actions.map((q) => (
              <li key={q.prompt}>
                <Link href={promptHref(lang, q.prompt)} className={rowClass}>
                  <span className="truncate">{isAr ? q.label_ar : q.label_en}</span>
                </Link>
              </li>
            ))}
            {d.skills.map((s) => (
              <li key={s.name} className="flex items-center">
                <Link href={promptHref(lang, skillStarter(s.title, isAr))} title={s.description} className={`${rowClass} min-w-0 flex-1`}>
                  <span dir="auto" className="truncate">{s.title}</span>
                </Link>
                <Link
                  href={promptHref(lang, skillHow(s.name))}
                  aria-label={`${t(copy.how)}: ${s.title}`}
                  className="flex min-h-11 shrink-0 items-center rounded-xl px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                >
                  {t(copy.how)}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ))}
    </>
  )
}

/** One row per repo, each with three learn starters. */
export function Knowledge({ lang, repos }: { lang: Locale; repos: string[] | null }) {
  const isAr = lang === "ar"
  const t = tr(isAr)
  const list = repos ?? defaultRepos
  if (list.length === 0) return null
  return (
    <Section title={t(copy.knowledge)}>
      <ul className="space-y-2">
        {list.map((r) => (
          <li key={r}>
            <p className="px-3 pt-1 text-[15px] font-semibold">{repoName(r, isAr)}</p>
            <ul>
              {repoStarters(r, isAr).map((s) => (
                <li key={s.label}>
                  <Link href={promptHref(lang, s.prompt)} className={`${rowClass} text-muted-foreground hover:text-foreground`}>
                    <span dir="auto" className="truncate">{s.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Section>
  )
}
