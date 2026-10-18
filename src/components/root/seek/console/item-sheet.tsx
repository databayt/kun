"use client";

// One card, opened: its facts, its history, and what the person can tell the
// loop to do with it. Actions only enqueue (enqueueSeekCommand) — the card
// moves on the board at the next tick, and the badge says so meanwhile.

import { useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";

import { enqueueSeekCommand, loadSeekNotes } from "@/actions/seek";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Locale } from "@/components/local/config";
import type { SeekCommand } from "@/lib/seek/commands";
import type { SeekItem } from "@/lib/seek/item";
import type { TrackDef } from "@/lib/seek/tracks/types";

import type { ConsoleDict } from "./dictionary";
import { humanize, stageLabel } from "./format";

export function ItemSheet({
  item,
  track,
  lang,
  t,
  pending,
  children,
}: {
  item: SeekItem;
  track: TrackDef;
  lang: Locale;
  t: ConsoleDict;
  pending: boolean;
  children: React.ReactNode;
}) {
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(item.notes);
  const [busy, start] = useTransition();
  const isRTL = lang === "ar";

  const send = (cmd: SeekCommand) =>
    start(async () => {
      const r = await enqueueSeekCommand(cmd);
      setMsg(r.ok ? t.queuedOk : r.error);
    });

  const facts: [string, string | null][] = [
    [t.stage, stageLabel(track, item.stage, lang)],
    [t.lane, humanize(item.lane)],
    [t.score, item.score == null ? null : String(item.score)],
    [t.country, [humanize(item.country), item.city].filter((v) => v && v !== "—").join(" · ") || null],
    [t.channel, item.channel && humanize(item.channel)],
    [t.deadline, item.deadline],
    [t.touch, item.touch ? String(item.touch) : null],
  ];

  return (
    <Sheet
      onOpenChange={(open) => {
        if (open && notes === null) loadSeekNotes(item.externalId).then(setNotes, () => undefined);
      }}
    >
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side={isRTL ? "left" : "right"}
        className="w-full overflow-y-auto sm:max-w-lg"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <SheetHeader>
          <SheetTitle className="px-6 text-start">{item.title}</SheetTitle>
          <SheetDescription className="text-start">{item.org ?? "—"}</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-8">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {facts
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted-foreground text-xs">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>

          {item.holdReason && (
            <p className="bg-muted/50 rounded-lg p-3 text-sm">
              <span className="text-muted-foreground">{t.holdReason}: </span>
              {item.holdReason}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {item.recordUrl && (
              <Button asChild size="sm" variant="outline">
                <a href={item.recordUrl} target="_blank" rel="noreferrer">
                  {t.open} <ExternalLink className="size-3" />
                </a>
              </Button>
            )}
            {item.sourceUrl && (
              <Button asChild size="sm" variant="outline">
                <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                  {t.posting} <ExternalLink className="size-3" />
                </a>
              </Button>
            )}
          </div>

          <section className="space-y-3 border-t pt-4">
            {pending && (
              <p className="text-muted-foreground text-xs">
                <Badge variant="secondary" className="me-2">{t.pending}</Badge>
                {t.pendingNote}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {item.track === "job" && item.stage === "HOLD" && (
                <Button size="sm" disabled={busy} onClick={() => send({ kind: "approve", externalId: item.externalId })}>
                  {t.approve}
                </Button>
              )}
              {item.track === "job" && item.stage === "QUEUED" && (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => send({ kind: "veto", externalId: item.externalId, reason: reason || undefined })}
                >
                  {t.veto}
                </Button>
              )}
              <Select
                onValueChange={(stage) => send({ kind: "move", externalId: item.externalId, stage })}
                disabled={busy}
              >
                <SelectTrigger size="sm" className="w-40">
                  <SelectValue placeholder={t.moveTo} />
                </SelectTrigger>
                <SelectContent>
                  {(track.stages ?? [])
                    .filter((s) => s.id !== item.stage)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label[lang]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {item.track === "job" && item.stage !== "HOLD" && (
              <div className="flex gap-2">
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t.reasonPlaceholder}
                  aria-label={t.reason}
                  className="h-8"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !reason.trim()}
                  onClick={() => send({ kind: "hold", externalId: item.externalId, reason })}
                >
                  {t.hold}
                </Button>
              </div>
            )}
            {msg && <p className="text-muted-foreground text-xs" role="status">{msg}</p>}
          </section>

          {notes && (
            <section className="space-y-2 border-t pt-4">
              <h3 className="text-sm font-medium">{t.notes}</h3>
              <pre className="text-muted-foreground font-sans text-xs whitespace-pre-wrap" dir="auto">
                {notes}
              </pre>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
