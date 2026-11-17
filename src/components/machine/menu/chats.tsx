"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SquarePenIcon, Trash2Icon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Locale } from "@/components/local/config";
import { tr } from "../chat/config";
import { listSessions, removeSession } from "../sessions/actions";
import { groupSessions } from "../sessions/group";
import type { Session } from "../sessions/types";
import { CHAT_DELETED_EVENT, copy, NEW_CHAT_EVENT } from "./config";
import { rowClass, Section, subClass } from "./section";

/** New chat (the big black pill) and the chats under day heads. Delete is inline on each row. */
export function Chats({
  lang,
  activeId,
  open,
}: {
  lang: Locale;
  activeId: string | null;
  open: boolean;
}) {
  const t = tr(lang === "ar");
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  // Fresh on every open; the last list shows meanwhile.
  useEffect(() => {
    if (!open) return;
    let live = true;
    setConfirm(null);
    listSessions()
      .then((rows) => live && setSessions(rows))
      .catch(() => live && setSessions((prev) => prev ?? []));
    return () => {
      live = false;
    };
  }, [open]);

  const groups = useMemo(() => groupSessions(sessions ?? []), [sessions]);

  const remove = async (id: string) => {
    setConfirm(null);
    setSessions((rows) => rows?.filter((s) => s.id !== id) ?? rows);
    await removeSession(id).catch(() => {});
    window.dispatchEvent(new CustomEvent(CHAT_DELETED_EVENT, { detail: id }));
  };

  return (
    <Section title={t(copy.chats)}>
      <Link
        href={`/${lang}/machine`}
        onClick={() => window.dispatchEvent(new Event(NEW_CHAT_EVENT))}
        className={cn(rowClass, "mb-2")}
      >
        <SquarePenIcon className="size-6 shrink-0" aria-hidden />
        {t(copy.newChat)}
      </Link>

      {!sessions && (
        <ul aria-hidden className="space-y-2 px-3 pt-3">
          {[70, 55, 80, 45].map((w) => (
            <li
              key={w}
              className="h-4 animate-pulse rounded bg-muted"
              style={{ width: `${w}%` }}
            />
          ))}
        </ul>
      )}
      {sessions?.length === 0 && (
        <p className="px-3 py-2 text-sm text-muted-foreground">
          {t(copy.noChats)}
        </p>
      )}

      {groups.map(({ group, rows }) => (
        <div key={group} className="pt-2">
          <h3 className={subClass}>{t(copy.groups[group])}</h3>
          <ul>
            {rows.map((s) => (
              <li key={s.id} className="group/row flex items-center">
                {confirm === s.id ? (
                  <div
                    role="group"
                    aria-label={t(copy.deleteConfirm)}
                    className="flex min-h-11 w-full items-center gap-2 px-3 text-sm"
                  >
                    <span className="flex-1">{t(copy.deleteConfirm)}</span>
                    <button
                      type="button"
                      onClick={() => void remove(s.id)}
                      className="rounded-full bg-destructive px-3 py-1 font-medium text-background"
                    >
                      {t(copy.delete)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirm(null)}
                      className="rounded-full bg-muted px-3 py-1 font-medium"
                    >
                      {t(copy.cancel)}
                    </button>
                  </div>
                ) : (
                  <>
                    <Link
                      href={`/${lang}/machine?s=${encodeURIComponent(s.id)}`}
                      aria-current={s.id === activeId ? "page" : undefined}
                      className={cn(
                        rowClass,
                        "min-w-0 flex-1",
                        s.id === activeId && "text-muted-foreground",
                      )}
                    >
                      <span dir="auto" className="truncate">
                        {s.title || t(copy.newChat)}
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setConfirm(s.id)}
                      aria-label={`${t(copy.deleteChat)}: ${s.title}`}
                      title={t(copy.deleteChat)}
                      className="flex size-9 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2Icon className="size-4" aria-hidden />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Section>
  );
}
