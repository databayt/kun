"use client";

// The loop's switches and the add-a-posting form. Like every console action
// these only enqueue; pull.ts applies them through adopt.ts's walls next tick.

import { useState, useTransition } from "react";

import { enqueueSeekCommand } from "@/actions/seek";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SeekCommand } from "@/lib/seek/commands";

import type { ConsoleDict } from "./dictionary";
import { humanize } from "./format";

export function LoopPanel({
  t,
  sendOff,
  dailyCap,
  lanes,
  pausedLanes,
  pendingKinds,
}: {
  t: ConsoleDict;
  sendOff: boolean;
  dailyCap: number | undefined;
  lanes: string[];
  pausedLanes: string[];
  pendingKinds: string[];
}) {
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [cap, setCap] = useState(String(dailyCap ?? ""));
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const paused = new Set(pausedLanes);

  const send = (cmd: SeekCommand, after?: () => void) =>
    start(async () => {
      const r = await enqueueSeekCommand(cmd);
      setMsg(r.ok ? t.queuedOk : r.error);
      if (r.ok) after?.();
    });

  const pendingBadge = (kind: string) =>
    pendingKinds.includes(kind) && (
      <Badge variant="secondary" className="ms-2 text-[10px]">
        {t.pending}
      </Badge>
    );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3 rounded-xl border p-4">
        <h3 className="text-sm font-medium">
          {t.sending}
          {pendingBadge("send")}
        </h3>
        <p className="text-muted-foreground text-sm">{sendOff ? t.sendingOffLabel : t.sendingOn}</p>
        <Button
          size="sm"
          variant={sendOff ? "default" : "destructive"}
          disabled={busy}
          onClick={() => send({ kind: "send", on: sendOff })}
        >
          {sendOff ? t.turnOn : t.turnOff}
        </Button>

        <div className="space-y-2 border-t pt-3">
          <label htmlFor="seek-cap" className="text-sm font-medium">
            {t.dailyCap}
            {pendingBadge("dailyCap")}
          </label>
          <div className="flex gap-2">
            <Input
              id="seek-cap"
              type="number"
              min={0}
              max={40}
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              className="h-8 w-24"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={busy || cap === "" || Number(cap) === dailyCap}
              onClick={() => send({ kind: "dailyCap", n: Number(cap) })}
            >
              {t.save}
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border p-4">
        <h3 className="text-sm font-medium">
          {t.lanes}
          {pendingBadge("pauseLane")}
        </h3>
        <ul className="divide-y">
          {lanes.map((lane) => {
            const isPaused = paused.has(lane);
            return (
              <li key={lane} className="flex items-center justify-between py-1.5 text-sm">
                <span>
                  {humanize(lane)}
                  {isPaused && (
                    <Badge variant="outline" className="ms-2 text-[10px]">
                      {t.paused}
                    </Badge>
                  )}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  disabled={busy}
                  onClick={() => send({ kind: "pauseLane", lane, paused: !isPaused })}
                >
                  {isPaused ? t.resume : t.pause}
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border p-4 lg:col-span-2">
        <h3 className="text-sm font-medium">
          {t.addTitle}
          {pendingBadge("ingest")}
        </h3>
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t.addUrl} type="url" dir="ltr" />
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t.addText} rows={4} dir="auto" />
        <Button
          size="sm"
          disabled={busy || (!url.trim() && !text.trim())}
          onClick={() =>
            send({ kind: "ingest", url: url.trim() || undefined, text: text.trim() || undefined }, () => {
              setUrl("");
              setText("");
            })
          }
        >
          {t.addSubmit}
        </Button>
      </section>

      {msg && (
        <p className="text-muted-foreground text-xs lg:col-span-2" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
