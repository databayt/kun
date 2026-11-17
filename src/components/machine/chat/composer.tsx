"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowUpIcon,
  PlusIcon,
  SquareIcon,
} from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Locale } from "@/components/local/config";
import type { QuickAction } from "../pack/types";
import { VoiceButton } from "../voice/content";
import { copy, tr } from "./config";

/** About six lines of text before the box scrolls. */
const MAX_HEIGHT_PX = 168;

/**
 * The chatgpt.com composer: one white pill with a soft shadow. `+` sits inside at the start (the quick
 * actions), the text grows to six lines, then the mic (dictation) and one dark round button at the end:
 * a send arrow (faded until there is text), or a stop square while a turn runs. Enter sends, Shift+Enter breaks a line.
 */
export function Composer({
  lang,
  onSend,
  onStop,
  busy,
  actions,
  autoFocus,
  initialText,
}: {
  lang: Locale;
  onSend: (text: string) => void;
  onStop: () => void;
  busy: boolean;
  actions: QuickAction[];
  autoFocus?: boolean;
  /** Fills the box without sending (a starter from the menu). */
  initialText?: string;
}) {
  const isAr = lang === "ar";
  const t = tr(isAr);
  const [text, setText] = useState(initialText ?? "");
  const [plus, setPlus] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  // `field-sizing: content` is not in Safari yet.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [text]);

  // A starter fills the box; the caret goes to its end so the person carries on typing.
  useEffect(() => {
    const el = ref.current;
    if (el && initialText)
      el.setSelectionRange(el.value.length, el.value.length);
  }, [initialText]);

  const hasText = !!text.trim();
  const submit = () => {
    if (busy || !hasText) return;
    onSend(text);
    setText("");
  };
  const icon =
    "flex size-10 shrink-0 items-center justify-center rounded-full transition-colors";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex min-h-[60px] w-full items-end gap-1 rounded-[30px] border border-border/60 bg-background p-2 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.18)] transition-shadow focus-within:shadow-[0_8px_30px_-10px_rgb(0_0_0/0.25)]"
    >
      {actions.length > 0 ? (
        <Popover open={plus} onOpenChange={setPlus}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t(copy.quick)}
              title={t(copy.quick)}
              className={cn(
                icon,
                "text-foreground hover:bg-muted",
                plus && "bg-muted",
              )}
            >
              <PlusIcon
                className={cn(
                  "size-6 transition-transform",
                  plus && "rotate-45",
                )}
                strokeWidth={1.5}
                aria-hidden
              />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            dir={isAr ? "rtl" : "ltr"}
            className="w-72 max-w-[calc(100vw-2rem)] rounded-2xl p-1.5"
          >
            <p className="px-3 pb-1 pt-2 text-sm font-semibold">
              {t(copy.quick)}
            </p>
            <ul>
              {actions.map((q) => (
                <li key={q.prompt}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setPlus(false);
                      onSend(q.prompt);
                    }}
                    className="w-full rounded-xl px-3 py-2.5 text-start text-[15px] transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    {isAr ? q.label_ar : q.label_en}
                  </button>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      ) : (
        <span className="w-2 shrink-0" aria-hidden />
      )}

      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        rows={1}
        maxLength={4000}
        autoFocus={autoFocus}
        enterKeyHint="send"
        dir="auto"
        placeholder={t(copy.placeholder)}
        aria-label={t(copy.placeholder)}
        className="min-w-0 flex-1 resize-none self-center bg-transparent px-1 py-2 text-[17px] leading-6 outline-none placeholder:text-muted-foreground"
      />

      {!busy && (
        <span className="contents">
          <VoiceButton
            lang={lang}
            onTranscript={(v) =>
              setText((prev) => (prev.trim() ? `${prev.trim()} ${v}` : v))
            }
          />
        </span>
      )}

      {busy ? (
        <button
          type="button"
          onClick={onStop}
          aria-label={t(copy.stop)}
          title={t(copy.stop)}
          className={cn(icon, "bg-foreground text-background")}
        >
          <SquareIcon className="size-3.5 fill-current" aria-hidden />
        </button>
      ) : (
        <button
          type="submit"
          aria-label={t(copy.send)}
          title={t(copy.send)}
          disabled={!hasText}
          className={cn(icon, "bg-foreground text-background hover:bg-foreground/85 disabled:bg-foreground/15 disabled:text-background")}
        >
          <ArrowUpIcon className="size-5" strokeWidth={2.5} aria-hidden />
        </button>
      )}
    </form>
  );
}
