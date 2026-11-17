import Link from "next/link";

import type { Locale } from "@/components/local/config";
import { tr } from "../chat/config";
import type { Department } from "../profile/types";
import { copy, promptHref, skillHow, skillStarter } from "./config";
import { bigClass, Column, quiet } from "./ui";

/** Column 3: the department's lanes — quick actions and skills as big links, each skill with «كيف تعمل؟». */
export function Run({ lang, dept }: { lang: Locale; dept: Department | undefined }) {
  const isAr = lang === "ar";
  const t = tr(isAr);
  const empty = !dept || (dept.quick_actions.length === 0 && dept.skills.length === 0);
  return (
    <Column title={t(copy.run)}>
      {empty && <p className={quiet}>{t(copy.noSkills)}</p>}
      {dept && (
        <ul>
          {dept.quick_actions.map((q) => (
            <li key={q.prompt}>
              <Link href={promptHref(lang, q.prompt)} className={bigClass}>
                {isAr ? q.label_ar : q.label_en}
              </Link>
            </li>
          ))}
          {dept.skills.map((s) => (
            <li key={s.name} className="flex items-center">
              <Link href={promptHref(lang, skillStarter(s.title, isAr))} title={s.description} dir="auto" className={`${bigClass} flex-1`}>
                {s.title}
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
      )}
    </Column>
  );
}
