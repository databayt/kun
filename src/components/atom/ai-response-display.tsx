"use client";

// An agent's answer with its reasoning above it — ported from the hogwarts sales
// block (hogwarts src/components/atom/ai-response-display.tsx): the collapsible
// reasoning panel, then the answer in a bordered card.
//
// One departure: hogwarts seeds the panel's duration from `Math.random()` to
// "simulate 2-5 seconds thinking". Nothing here invents a number — the panel
// times the real wait itself, which for kun is a genuine wait (the ask sits in a
// queue until a Claude Code session answers it), so there is nothing to fake.

import { useEffect, useState } from "react";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
  type ReasoningLabels,
} from "@/components/atom/reasoning";
import {
  Response,
  type ResponseLabels,
  type ResponseStatus,
} from "@/components/atom/response";
import { cn } from "@/lib/utils";

interface AIResponseDisplayProps {
  response?: string;
  reasoning?: string;
  isStreaming?: boolean;
  className?: string;
  showReasoning?: boolean;
  streamDelay?: number;
  onStreamComplete?: () => void;
  reasoningLabels?: ReasoningLabels;
  responseLabels?: ResponseLabels | null;
  dir?: "rtl" | "ltr";
  scrollContainerId?: string;
}

export function AIResponseDisplay({
  response = "",
  reasoning = "",
  isStreaming = false,
  className,
  showReasoning = true,
  streamDelay = 8,
  onStreamComplete,
  reasoningLabels,
  responseLabels,
  dir,
  scrollContainerId,
}: AIResponseDisplayProps) {
  const [responseStatus, setResponseStatus] = useState<ResponseStatus>(null);

  useEffect(() => {
    if (isStreaming && response) {
      setResponseStatus("streaming");
    } else if (!isStreaming && response) {
      // A beat, so a reveal that is still running is not cut short.
      const timer = setTimeout(() => {
        setResponseStatus("done");
        onStreamComplete?.();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, response, onStreamComplete]);

  return (
    <div className={cn("space-y-4", className)}>
      {showReasoning && reasoning && (
        <Reasoning
          isStreaming={isStreaming}
          // Stable `true`, not hogwarts's `isStreaming`. There, `defaultOpen`
          // both seeds the open state and gates the auto-close, so passing a
          // value that has already flipped to false by the time the answer lands
          // means the panel opens and then never closes itself.
          defaultOpen
          labels={reasoningLabels}
        >
          <ReasoningTrigger />
          <ReasoningContent>{reasoning}</ReasoningContent>
        </Reasoning>
      )}

      {response && (
        <div className="bg-card rounded-lg border p-4">
          <Response
            status={responseStatus}
            streamDelay={streamDelay}
            labels={responseLabels}
            dir={dir}
            scrollContainerId={scrollContainerId}
            onStatusChange={(status) => {
              setResponseStatus(status);
              if (status === "done") onStreamComplete?.();
            }}
          >
            {response}
          </Response>
        </div>
      )}
    </div>
  );
}
