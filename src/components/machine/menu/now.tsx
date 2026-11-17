"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { Locale } from "@/components/local/config";
import type { Task } from "../tasks/types";
import { tr } from "../chat/config";
import { copy } from "./config";
import type { Readiness, TasksView } from "./data";
import { runStart } from "./data";
import { bigClass, Column, Dot, quiet, smallRow, subClass } from "./ui";

const taskHref = (lang: string, id: string) => `/${lang}/machine?task=${encodeURIComponent(id)}`;

function readinessOf(view: TasksView, t: Task): Readiness {
  return view.readiness?.[t.id] ?? { state: t.afterOpen.length ? "blocked" : "ready", missing: [] };
}

/** Column 2: this sprint, my tasks (with readiness and Start), then the team board. */
export function Now({
  lang,
  view,
  loading,
  onStarted,
}: {
  lang: Locale;
  view: TasksView | null;
  loading: boolean;
  onStarted: () => void;
}) {
  const t = tr(lang === "ar");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function start(id: string) {
    setBusy(id);
    try {
      await runStart(id);
      onStarted();
      router.push(taskHref(lang, id));
    } catch {
      setBusy(null);
    }
  }

  if (!view) {
    return (
      <Column title={t(copy.now)}>
        {loading ? <Skeleton /> : <p className={quiet}>{t(copy.tasksOffline)}</p>}
      </Column>
    );
  }
  const stateLabel = { ready: copy.ready, missing: copy.missing, blocked: copy.blocked };
  return (
    <Column title={t(copy.now)}>
      <p className="text-sm leading-snug text-muted-foreground">
        {view.sprint ? (
          <>
            <span className="font-medium">{view.sprint.title}</span>
            {view.sprint.goal ? ` — ${view.sprint.goal}` : ""}
          </>
        ) : (
          t(copy.noSprint)
        )}
      </p>

      <h3 className={subClass}>{t(copy.myTasks)}</h3>
      {view.mine.length === 0 && <p className={quiet}>{t(copy.noTasks)}</p>}
      <ul>
        {view.mine.map((task) => {
          const r = readinessOf(view, task);
          return (
            <li key={task.id} className="flex items-center gap-2">
              <span title={[t(stateLabel[r.state]), ...r.missing].join(" · ")} className="flex w-4 shrink-0 justify-center">
                <Dot kind={r.state === "ready" ? "solid" : r.state === "missing" ? "ring" : "lock"} />
                <span className="sr-only">{t(stateLabel[r.state])}</span>
              </span>
              <Link href={taskHref(lang, task.id)} dir="auto" className={`${bigClass} flex-1 ${r.state !== "ready" ? "text-muted-foreground hover:text-foreground" : ""}`}>
                {task.title}
              </Link>
              {r.state === "ready" && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void start(task.id)}
                  className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-medium transition-colors hover:bg-foreground hover:text-background disabled:opacity-50"
                >
                  {t(copy.start)}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <h3 className={subClass}>{t(copy.board)}</h3>
      {view.board.length === 0 && <p className={quiet}>{t(copy.noBoard)}</p>}
      <ul>
        {view.board.slice(0, 8).map((task) => (
          <li key={task.id} className={smallRow}>
            <span dir="auto" className="min-w-0 flex-1 truncate">
              {task.title}
            </span>
            <span className="shrink-0 text-muted-foreground">{task.holder ?? t(copy.unassigned)}</span>
          </li>
        ))}
      </ul>
    </Column>
  );
}

function Skeleton() {
  return (
    <ul aria-hidden className="space-y-3">
      {[80, 60, 70].map((w) => (
        <li key={w} className="h-5 animate-pulse rounded bg-muted" style={{ width: `${w}%` }} />
      ))}
    </ul>
  );
}
