"use client";

// The collapsible "Thinking… / Thought for N seconds" panel above an agent's
// answer — ported from the hogwarts sales block (hogwarts
// src/components/atom/reasoning.tsx). Opens while the answer is in flight,
// closes itself a beat after it lands, and stays reopenable.
//
// One departure: hogwarts pulls `useControllableState` from
// @radix-ui/react-use-controllable-state, which kun does not install for this
// one call site. The eight lines it needs live at the bottom of this file.

import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
} from "react";
import { BrainIcon, ChevronDownIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Response } from "@/components/atom/response";
import { cn } from "@/lib/utils";

interface ReasoningContextValue {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration: number;
}

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

export interface ReasoningLabels {
  /** While the answer is in flight. */
  thinking: string;
  /** Takes {seconds}. */
  thought: string;
}

const DEFAULT_LABELS: ReasoningLabels = {
  thinking: "Working…",
  thought: "Worked for {seconds} seconds",
};

const ReasoningLabelsContext = createContext<ReasoningLabels>(DEFAULT_LABELS);

function useReasoning(): ReasoningContextValue {
  const context = useContext(ReasoningContext);
  if (!context) {
    throw new Error("Reasoning components must be used within Reasoning");
  }
  return context;
}

export type ReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean;
  duration?: number;
  /** Copy for the trigger, so the panel speaks the caller's language. */
  labels?: ReasoningLabels;
};

const AUTO_CLOSE_DELAY = 1000;
const MS_IN_S = 1000;

export const Reasoning = memo(function Reasoning({
  className,
  isStreaming = false,
  open,
  defaultOpen = true,
  onOpenChange,
  duration: durationProp,
  labels = DEFAULT_LABELS,
  children,
  ...props
}: ReasoningProps) {
  const [isOpen, setIsOpen] = useControllableState({
    prop: open,
    defaultProp: defaultOpen,
    onChange: onOpenChange,
  });
  const [duration, setDuration] = useControllableState({
    prop: durationProp,
    defaultProp: 0,
  });

  const [hasAutoClosed, setHasAutoClosed] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Time the wait, so the trigger can report it once the answer lands.
  useEffect(() => {
    if (isStreaming) {
      if (startTime === null) setStartTime(Date.now());
    } else if (startTime !== null) {
      setDuration(Math.ceil((Date.now() - startTime) / MS_IN_S));
      setStartTime(null);
    }
  }, [isStreaming, startTime, setDuration]);

  // Close once, a beat after streaming ends — long enough to have been seen,
  // and never again so a reader who reopens it keeps it open.
  useEffect(() => {
    if (defaultOpen && !isStreaming && isOpen && !hasAutoClosed) {
      const timer = setTimeout(() => {
        setIsOpen(false);
        setHasAutoClosed(true);
      }, AUTO_CLOSE_DELAY);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, isOpen, defaultOpen, setIsOpen, hasAutoClosed]);

  return (
    <ReasoningContext.Provider
      value={{ isStreaming, isOpen, setIsOpen, duration }}
    >
      <ReasoningLabelsContext.Provider value={labels}>
        <Collapsible
          className={cn("mb-4", className)}
          onOpenChange={setIsOpen}
          open={isOpen}
          {...props}
        >
          {children}
        </Collapsible>
      </ReasoningLabelsContext.Provider>
    </ReasoningContext.Provider>
  );
});

export type ReasoningTriggerProps = ComponentProps<typeof CollapsibleTrigger>;

export const ReasoningTrigger = memo(function ReasoningTrigger({
  className,
  children,
  ...props
}: ReasoningTriggerProps) {
  const { isStreaming, isOpen, duration } = useReasoning();
  const labels = useContext(ReasoningLabelsContext);

  return (
    <CollapsibleTrigger
      className={cn(
        "text-muted-foreground hover:text-foreground flex w-full items-center gap-2 text-sm transition-colors",
        className,
      )}
      {...props}
    >
      {children ?? (
        <>
          <BrainIcon className="size-4 shrink-0" />
          <p>
            {isStreaming || duration === 0
              ? labels.thinking
              : labels.thought.replace("{seconds}", String(duration))}
          </p>
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 transition-transform",
              isOpen ? "rotate-180" : "rotate-0",
            )}
          />
        </>
      )}
    </CollapsibleTrigger>
  );
});

export type ReasoningContentProps = ComponentProps<
  typeof CollapsibleContent
> & {
  children: string;
};

export const ReasoningContent = memo(function ReasoningContent({
  className,
  children,
  ...props
}: ReasoningContentProps) {
  return (
    <CollapsibleContent
      className={cn(
        "text-muted-foreground mt-4 text-sm outline-none",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    >
      {/* hogwarts passes `grid gap-2` here because Streamdown emits block
          children (paragraphs, list items) that want to be grid rows. This
          Response emits inline nodes, so a grid would put every text run and
          every <strong> on its own row — the line breaks already come from the
          text's own newlines. */}
      <Response labels={null}>{children}</Response>
    </CollapsibleContent>
  );
});

/**
 * The five lines of @radix-ui/react-use-controllable-state this file uses:
 * a value that is controlled when `prop` is supplied and internal otherwise.
 */
function useControllableState<T>({
  prop,
  defaultProp,
  onChange,
}: {
  prop?: T;
  defaultProp: T;
  onChange?: (value: T) => void;
}): [T, (value: T) => void] {
  const [uncontrolled, setUncontrolled] = useState(defaultProp);
  const isControlled = prop !== undefined;
  const value = isControlled ? prop : uncontrolled;

  const setValue = useCallback(
    (next: T) => {
      if (!isControlled) setUncontrolled(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  return [value, setValue];
}
