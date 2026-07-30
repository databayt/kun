"use client";

// An agent's answer, revealed a character at a time — ported from the hogwarts
// sales block (hogwarts src/components/atom/response.tsx): the same `status`
// lifecycle, the same `streamDelay` reveal, the same status pip in the corner,
// the same auto-scroll of the enclosing response container.
//
// What did NOT come across is the renderer. hogwarts pipes the answer through
// Streamdown with remark-gfm, remark-math and rehype-katex behind a
// `@ts-nocheck`; it needs that because its answers are generated Markdown
// reports (## headings, tables, LaTeX). kun's agent answers are prose — social
// post copy, a queue explanation — so the four packages and the KaTeX stylesheet
// would be bundle weight for markup that never arrives. This renders the text
// with its own line breaks preserved, and a `**bold**` span for emphasis, which
// is the whole of the syntax kun's callers actually emit.

import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ResponseStatus =
  "streaming" | "done" | "failed" | "rejected" | null;

export interface ResponseLabels {
  streaming: string;
  done: string;
  failed: string;
  rejected: string;
}

const DEFAULT_LABELS: ResponseLabels = {
  streaming: "Generating…",
  done: "Complete",
  failed: "Failed",
  rejected: "Rejected",
};

interface ResponseProps {
  children?: string;
  className?: string;
  status?: ResponseStatus;
  onStatusChange?: (status: ResponseStatus) => void;
  /** Milliseconds between characters while status is "streaming". */
  streamDelay?: number;
  /** Overrides the corner pip's wording; omit to hide the pip entirely. */
  labels?: ResponseLabels | null;
  /** "rtl" forces direction; omit to inherit from the document. */
  dir?: "rtl" | "ltr";
  /** id of the scroll container to keep pinned to the bottom while streaming. */
  scrollContainerId?: string;
}

/** `**bold**` — the only inline syntax kun's agents emit. */
function renderEmphasis(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((chunk, index) =>
    chunk.startsWith("**") && chunk.endsWith("**") && chunk.length > 4 ? (
      <strong key={index} className="text-foreground font-semibold">
        {chunk.slice(2, -2)}
      </strong>
    ) : (
      chunk
    ),
  );
}

export const Response = memo(function Response({
  children,
  className,
  status = null,
  onStatusChange,
  streamDelay = 10,
  labels = DEFAULT_LABELS,
  dir,
  scrollContainerId,
}: ResponseProps) {
  const content = String(children ?? "");
  const [shown, setShown] = useState("");
  const [currentStatus, setCurrentStatus] = useState<ResponseStatus>(status);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reveal. A non-streaming status means the text is already whole.
  useEffect(() => {
    if (!content) {
      setShown("");
      return;
    }
    if (status !== "streaming") {
      setShown(content);
      return;
    }

    let index = 0;
    setShown("");
    setCurrentStatus("streaming");
    const timer = setInterval(() => {
      if (index < content.length) {
        index += 1;
        setShown(content.slice(0, index));
      } else {
        clearInterval(timer);
        setCurrentStatus("done");
        onStatusChange?.("done");
      }
    }, streamDelay);

    return () => clearInterval(timer);
  }, [content, status, streamDelay, onStatusChange]);

  // Follow the text down while it arrives.
  useEffect(() => {
    if (currentStatus !== "streaming") return;
    const scroller = scrollContainerId
      ? document.getElementById(scrollContainerId)
      : containerRef.current?.closest(".overflow-y-auto");
    scroller?.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
  }, [shown, currentStatus, scrollContainerId]);

  // A status handed down from the caller wins over the local reveal state.
  useEffect(() => {
    if (status && status !== currentStatus) setCurrentStatus(status);
    // currentStatus is deliberately not a dependency: reacting to our own
    // writes here would fight the reveal effect for control of the status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <div className="relative" ref={containerRef}>
      {labels && currentStatus && (
        <div className="absolute -end-2 -top-2 z-10">
          {currentStatus === "streaming" && (
            <div className="text-primary flex animate-pulse items-center gap-1 text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>{labels.streaming}</span>
            </div>
          )}
          {currentStatus === "done" && (
            <div className="text-muted-foreground flex items-center gap-1 text-xs">
              <CheckCircle2 className="h-3 w-3" />
              <span>{labels.done}</span>
            </div>
          )}
          {currentStatus === "failed" && (
            <div className="text-destructive flex items-center gap-1 text-xs">
              <XCircle className="h-3 w-3" />
              <span>{labels.failed}</span>
            </div>
          )}
          {currentStatus === "rejected" && (
            <div className="text-muted-foreground flex items-center gap-1 text-xs">
              <AlertCircle className="h-3 w-3" />
              <span>{labels.rejected}</span>
            </div>
          )}
        </div>
      )}

      <div
        dir={dir}
        className={cn(
          "text-start text-sm leading-relaxed whitespace-pre-wrap",
          className,
        )}
      >
        {renderEmphasis(shown)}
      </div>
    </div>
  );
});
