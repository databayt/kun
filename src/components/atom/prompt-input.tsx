"use client";

// Trimmed port of the hogwarts sales-block composer primitives
// (hogwarts src/components/atom/prompt-input.tsx): the form, the textarea's
// Enter / Shift+Enter / IME behaviour, and the submit button. The attachment
// machinery, action menus, and model-select scaffolding stayed behind — which
// also drops that file's `ai`-package type dependency and its hidden-input bug.

import { Loader2, Send } from "lucide-react";
import type {
  ComponentProps,
  FormEventHandler,
  FormHTMLAttributes,
  KeyboardEventHandler,
  TextareaHTMLAttributes,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PromptInputMessage {
  text: string;
}

export type PromptInputStatus = "ready" | "streaming";

export interface PromptInputProps extends Omit<
  FormHTMLAttributes<HTMLFormElement>,
  "onSubmit"
> {
  onSubmit: (message: PromptInputMessage) => void;
}

export function PromptInput({
  className,
  onSubmit,
  ...props
}: PromptInputProps) {
  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    const field = event.currentTarget.elements.namedItem("message");
    const text = field instanceof HTMLTextAreaElement ? field.value : "";
    onSubmit({ text });
  };

  return (
    <form
      data-slot="prompt-input"
      className={cn(
        "bg-background w-full overflow-hidden border shadow-sm",
        className,
      )}
      onSubmit={handleSubmit}
      {...props}
    />
  );
}

export function PromptInputTextarea({
  className,
  onKeyDown,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === "Enter") {
      // An Enter that ends IME composition is not a submit.
      if (event.nativeEvent.isComposing) return;
      // Shift+Enter keeps its newline.
      if (event.shiftKey) return;
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
    onKeyDown?.(event);
  };

  return (
    <textarea
      data-slot="prompt-input-textarea"
      name="message"
      className={cn(
        "field-sizing-content max-h-48 w-full resize-none bg-transparent text-sm outline-none",
        "placeholder:text-muted-foreground",
        className,
      )}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}

export function PromptInputButton({
  className,
  variant = "ghost",
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="prompt-input-button"
      type="button"
      variant={variant}
      size="icon"
      className={cn(
        "shrink-0 rounded-full",
        variant === "ghost" && "text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function PromptInputSubmit({
  className,
  status = "ready",
  ...props
}: ComponentProps<typeof Button> & { status?: PromptInputStatus }) {
  return (
    <Button
      data-slot="prompt-input-submit"
      type="submit"
      size="icon"
      className={cn("shrink-0 rounded-full", className)}
      {...props}
    >
      {status === "streaming" ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Send className="size-4" />
      )}
    </Button>
  );
}
