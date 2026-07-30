"use client";

// The agent window — the hogwarts sales-block prompt UI, repurposed: describe
// the post, Claude drafts it server-side (the decided per-draft spend lane in
// actions/post-social.ts), and the copy drops into the composer below. Single
// turn by design, like the original: one brief, one bilingual draft, no chat
// history. The "reasoning" theatre of the original was deliberately not
// ported — the only status shown is the true one.

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { draftSocialCopy } from "@/actions/post-social";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/atom/prompt-input";
import { Button } from "@/components/ui/button";
import type { SocialDict } from "@/components/root/social/dictionary";
import type { ProductId } from "@/components/root/social/products";
import { cn } from "@/lib/utils";

interface DraftAgentProps {
  product: ProductId;
  /** Hands a chosen draft to the composer. */
  onUse: (text: string) => void;
  isRTL: boolean;
  t: SocialDict;
}

interface DraftPair {
  ar: string;
  en: string;
}

// Character-interval reveal — presentation only, the text is already complete.
function StreamingText({
  text,
  dir,
  onDone,
}: {
  text: string;
  dir: "rtl" | "ltr";
  onDone?: () => void;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);
    const id = setInterval(() => {
      setCount((current) => {
        if (current >= text.length) {
          clearInterval(id);
          return current;
        }
        return Math.min(current + 3, text.length);
      });
    }, 12);
    return () => clearInterval(id);
  }, [text]);

  const done = count >= text.length;
  useEffect(() => {
    if (done) onDone?.();
  }, [done, onDone]);

  return (
    <p
      dir={dir}
      className="text-start text-sm leading-relaxed whitespace-pre-wrap"
    >
      {text.slice(0, count)}
    </p>
  );
}

export function DraftAgent({ product, onUse, isRTL, t }: DraftAgentProps) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState<DraftPair | null>(null);
  const [arDone, setArDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async ({ text }: PromptInputMessage) => {
    const brief = text.trim();
    if (!brief || busy) return;
    setBusy(true);
    setHasInteracted(true);
    setError(null);
    setDraft(null);
    setArDone(false);
    try {
      const res = await draftSocialCopy({ product, brief });
      if (res.ok && res.ar && res.en) {
        setDraft({ ar: res.ar, en: res.en });
        setPrompt("");
      } else {
        setError(res.error ?? "Unknown error.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const useDraft = (text: string) => {
    onUse(text);
    document
      .getElementById("composer")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const reset = () => {
    setDraft(null);
    setError(null);
    setArDone(false);
    setHasInteracted(false);
    setPrompt("");
  };

  const collapsed = hasInteracted && !focused;

  return (
    <section className="border-border bg-card/40 rounded-xl border p-6 shadow-lg backdrop-blur-md">
      {!hasInteracted && (
        <div className="mb-5 text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <span className="rounded-lg bg-amber-500/10 p-2 text-amber-500">
              <Sparkles className="h-5 w-5" />
            </span>
            <h3 className="text-primary text-base font-medium">
              {t.agentTitle}
            </h3>
          </div>
          <p className="text-muted-foreground mx-auto max-w-md text-sm leading-relaxed font-light">
            {t.agentHint}
          </p>
        </div>
      )}

      {hasInteracted && (
        <div
          className={cn(
            "mb-4 space-y-4 overflow-y-auto transition-all",
            focused ? "max-h-[200px]" : "max-h-[500px]",
          )}
        >
          {busy && (
            <p className="text-muted-foreground animate-pulse text-sm">
              {t.agentDrafting}
            </p>
          )}
          {error && (
            <p className="text-destructive text-sm">
              {t.agentError} {error}
            </p>
          )}
          {draft && (
            <div className="space-y-4">
              <StreamingText
                text={draft.ar}
                dir="rtl"
                onDone={() => setArDone(true)}
              />
              {arDone && <StreamingText text={draft.en} dir="ltr" />}
              {arDone && (
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <Button size="sm" onClick={() => useDraft(draft.ar)}>
                    {t.agentUseAr}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => useDraft(draft.en)}
                  >
                    {t.agentUseEn}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => useDraft(`${draft.ar}\n\n—\n\n${draft.en}`)}
                  >
                    {t.agentUseBoth}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={reset}>
                    {t.agentStartNew}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <PromptInput
        onSubmit={handleSubmit}
        className={cn(
          "border-border mx-auto max-w-2xl rounded-[2rem] transition-all",
          collapsed ? "flex h-14 flex-row items-center gap-2 px-3" : "p-4",
        )}
      >
        <PromptInputTextarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={collapsed ? t.agentPlaceholderMore : t.agentPlaceholder}
          disabled={busy}
          className={collapsed ? "min-h-0 py-1" : "min-h-16"}
        />
        <div
          className={cn(
            "flex items-center",
            collapsed ? "shrink-0" : "justify-end pt-2",
          )}
        >
          <PromptInputSubmit
            status={busy ? "streaming" : "ready"}
            disabled={busy || !prompt.trim()}
            aria-label={isRTL ? "أرسل" : "Send"}
          />
        </div>
      </PromptInput>
    </section>
  );
}
