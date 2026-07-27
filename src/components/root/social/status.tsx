"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { EgressStatus, TransportStatus } from "@/lib/social-status";
import type { SocialDict } from "@/components/root/social/dictionary";

interface StatusIndicatorProps {
  state?: TransportStatus;
  checking: boolean;
  t: SocialDict;
}

function StatusIndicator({ state, checking, t }: StatusIndicatorProps) {
  if (checking || !state) {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </span>
        <span className="text-xs font-medium text-amber-500">{t.checking}</span>
      </div>
    );
  }
  if (state.connected) {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-xs font-medium text-emerald-500">
          {t.connected} {state.detail && <span dir="ltr">{state.detail}</span>}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
      <span className="text-xs font-medium text-rose-500">
        {t.disconnected}
      </span>
    </div>
  );
}

interface StatusProps {
  status: EgressStatus | null;
  checking: boolean;
  onRefresh: () => void;
  t: SocialDict;
}

/** Facebook leads: it's the per-brand transport, so it's the row that changes
 *  meaning when the product selector changes. */
const transportRows = (
  status: EgressStatus | null,
  t: SocialDict,
): Array<{ key: string; label: string; state?: TransportStatus }> => [
  { key: "facebook", label: t.facebookRow, state: status?.facebook },
  { key: "hermes", label: t.hermesRow, state: status?.hermes },
  { key: "telegram", label: t.telegramRow, state: status?.telegram },
];

function StatusBody({ status, checking, onRefresh, t }: StatusProps) {
  const rows = transportRows(status, t);

  return (
    <div className="space-y-4">
      <div className="border-border/40 flex items-center justify-between border-b pb-3">
        <span className="text-muted-foreground text-xs">{t.apiUrl}</span>
        <span className="max-w-[180px] truncate font-mono text-xs select-all">
          {process.env.NEXT_PUBLIC_HERMES_API_URL || t.notConfigured}
        </span>
      </div>

      {rows.map((row, index) => (
        <div
          key={row.key}
          className={`flex items-center justify-between py-2 ${
            index > 0 ? "border-border/40 border-t" : ""
          }`}
        >
          <span className="text-muted-foreground text-xs">{row.label}</span>
          <StatusIndicator state={row.state} checking={checking} t={t} />
        </div>
      ))}

      {/* Hermes cannot be reached from a cloud deployment — it listens on
          localhost — so its row is red in production no matter how healthy the
          gateway is. The heartbeat, written whenever it polls the queue, is the
          signal that actually means something. */}
      {!checking && status?.hermes.lastSeen && (
        <p className="text-muted-foreground border-border/40 border-t pt-3 text-xs">
          {t.hermesRow}: {t.lastSeen}{" "}
          <span dir="ltr">
            {new Date(status.hermes.lastSeen).toLocaleString()}
          </span>
        </p>
      )}

      {!checking &&
        rows.map(
          (row) =>
            row.state?.error && (
              <p
                key={`${row.key}-error`}
                className="text-xs leading-relaxed break-words rounded-lg border border-rose-500/10 bg-rose-500/5 p-3 text-rose-500"
              >
                {row.label}: {row.state.error}
              </p>
            ),
        )}

      <Button
        onClick={onRefresh}
        disabled={checking}
        variant="outline"
        size="sm"
        className="mt-2 flex w-full items-center justify-center gap-2"
      >
        <RefreshCw className={`h-3 w-3 ${checking ? "animate-spin" : ""}`} />
        <span>{t.testConnection}</span>
      </Button>
    </div>
  );
}

/**
 * Egress health behind a toolbar button, not a permanent sidebar — the dot
 * carries the one bit that matters at rest (is anything down?), and the dialog
 * carries the per-transport detail only when asked for.
 */
export function StatusDialog({ status, checking, onRefresh, t }: StatusProps) {
  const rows = transportRows(status, t);
  const allConnected =
    !checking && status !== null && rows.every((row) => row.state?.connected);

  return (
    <Dialog>
      <DialogTrigger
        aria-label={t.status}
        className="focus-visible:ring-ring/50 flex h-8 w-auto items-center justify-start gap-2 rounded-md border-0 bg-transparent px-3 text-sm shadow-none outline-none focus-visible:ring-[3px]"
      >
        <span className="relative flex h-2 w-2">
          {checking || !status ? (
            <>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </>
          ) : allConnected ? (
            <>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </>
          ) : (
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
          )}
        </span>
        <span>{t.status}</span>
      </DialogTrigger>
      {/* No description: the rows below are the content, and an sr-only sentence
          would just duplicate the title. */}
      <DialogContent aria-describedby={undefined} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">{t.status}</DialogTitle>
        </DialogHeader>
        <StatusBody
          status={status}
          checking={checking}
          onRefresh={onRefresh}
          t={t}
        />
      </DialogContent>
    </Dialog>
  );
}
