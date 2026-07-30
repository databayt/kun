"use client";

// The composer primitives behind an agent prompt window, ported from the
// hogwarts sales block (hogwarts src/components/atom/prompt-input.tsx) so kun's
// agent windows are the same block, not a lookalike: the form and its
// attachment context, the textarea's Enter / Shift+Enter / IME behaviour, the
// action menu, the model select, and the submit button.
//
// Three deliberate departures from the original, all local:
//   · No `ai` package. `FileUIPart` and the submit status are declared here —
//     kun does not depend on the Vercel AI SDK and this file is the only reason
//     it would.
//   · No `nanoid`. `crypto.randomUUID()` is in every browser kun supports.
//   · No `syncHiddenInput`. It is dead in the original (a file input cannot be
//     assigned programmatically), and the page that used it hand-rolled a second
//     hidden input whose files went nowhere. Callers reach the real dialog
//     through `usePromptInputAttachments().openFileDialog()`.

import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEventHandler,
  type ComponentProps,
  type FormEvent,
  type FormEventHandler,
  type HTMLAttributes,
  type KeyboardEventHandler,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ImageIcon,
  Loader2Icon,
  PaperclipIcon,
  Plus,
  SendIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** One attached file, as the submit handler receives it. */
export interface FileUIPart {
  type: "file";
  /** Object URL — read it with `fetch(url)` / `.text()` / `.blob()`. */
  url: string;
  mediaType?: string;
  filename?: string;
}

/** Mirrors the `ai` package's ChatStatus without depending on it. */
export type PromptInputStatus =
  "ready" | "submitted" | "streaming" | "error" | undefined;

export interface PromptInputMessage {
  text?: string;
  files?: FileUIPart[];
}

type AttachedFile = FileUIPart & { id: string };

/** The id is this module's bookkeeping; consumers get the file part alone. */
function stripId({ id: _id, ...file }: AttachedFile): FileUIPart {
  return file;
}

interface AttachmentsContextValue {
  files: AttachedFile[];
  add: (files: File[] | FileList) => void;
  remove: (id: string) => void;
  clear: () => void;
  openFileDialog: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
}

const AttachmentsContext = createContext<AttachmentsContextValue | null>(null);

export function usePromptInputAttachments(): AttachmentsContextValue {
  const context = useContext(AttachmentsContext);
  if (!context) {
    throw new Error(
      "usePromptInputAttachments must be used within a PromptInput",
    );
  }
  return context;
}

export type PromptInputAttachmentProps = HTMLAttributes<HTMLDivElement> & {
  data: AttachedFile;
};

export function PromptInputAttachment({
  data,
  className,
  ...props
}: PromptInputAttachmentProps) {
  const attachments = usePromptInputAttachments();

  return (
    <div
      data-slot="prompt-input-attachment"
      className={cn("group relative h-14 w-14 rounded-md border", className)}
      {...props}
    >
      {data.mediaType?.startsWith("image/") && data.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- object URL, never optimizable
        <img
          alt={data.filename || "attachment"}
          className="size-full rounded-md object-cover"
          height={56}
          src={data.url}
          width={56}
        />
      ) : (
        <div className="text-muted-foreground flex size-full items-center justify-center">
          <PaperclipIcon className="size-4" />
        </div>
      )}
      {/* Always visible, not hogwarts's `opacity-0 group-hover:opacity-100`: a
          hover-only remove button has no equivalent on a touch screen, which is
          where an accidental attachment is most likely to happen. */}
      <Button
        aria-label="Remove attachment"
        className="absolute -end-1.5 -top-1.5 h-6 w-6 rounded-full"
        onClick={() => attachments.remove(data.id)}
        size="icon"
        type="button"
        variant="outline"
      >
        <XIcon className="h-3 w-3" />
      </Button>
    </div>
  );
}

export type PromptInputAttachmentsProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  children: (attachment: AttachedFile) => ReactNode;
};

export function PromptInputAttachments({
  className,
  children,
  ...props
}: PromptInputAttachmentsProps) {
  const attachments = usePromptInputAttachments();
  const [height, setHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setHeight(el.getBoundingClientRect().height);
    });
    ro.observe(el);
    setHeight(el.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      data-slot="prompt-input-attachments"
      aria-live="polite"
      className={cn(
        "overflow-hidden transition-[height] duration-200 ease-out",
        className,
      )}
      style={{ height: attachments.files.length ? height : 0 }}
      {...props}
    >
      <div className="flex flex-wrap gap-2 p-3" ref={contentRef}>
        {attachments.files.map((file) => (
          <Fragment key={file.id}>{children(file)}</Fragment>
        ))}
      </div>
    </div>
  );
}

export type PromptInputActionAddAttachmentsProps = ComponentProps<
  typeof DropdownMenuItem
> & {
  label?: string;
};

export function PromptInputActionAddAttachments({
  label = "Add photos or files",
  ...props
}: PromptInputActionAddAttachmentsProps) {
  const attachments = usePromptInputAttachments();

  return (
    <DropdownMenuItem
      data-slot="prompt-input-action-add-attachments"
      {...props}
      onSelect={(event) => {
        event.preventDefault();
        attachments.openFileDialog();
      }}
    >
      <ImageIcon className="me-2 size-4" /> {label}
    </DropdownMenuItem>
  );
}

export type PromptInputProps = Omit<
  HTMLAttributes<HTMLFormElement>,
  "onSubmit"
> & {
  /** e.g. "image/*", ".csv" — leave undefined for any. */
  accept?: string;
  multiple?: boolean;
  /** Accept drops anywhere on the document. Opt-in; drops on the form always work. */
  globalDrop?: boolean;
  maxFiles?: number;
  /** Bytes. */
  maxFileSize?: number;
  onError?: (err: {
    code: "max_files" | "max_file_size" | "accept";
    message: string;
  }) => void;
  /**
   * Awaited, so attachments can be read (their object URLs are still live) before
   * the form clears them.
   */
  onSubmit: (
    message: PromptInputMessage,
    event: FormEvent<HTMLFormElement>,
  ) => void | Promise<void>;
};

export function PromptInput({
  className,
  accept,
  multiple,
  globalDrop,
  maxFiles,
  maxFileSize,
  onError,
  onSubmit,
  ...props
}: PromptInputProps) {
  const [items, setItems] = useState<AttachedFile[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const openFileDialog = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const matchesAccept = useCallback(
    (file: File) => {
      if (!accept || accept.trim() === "") return true;
      if (accept.includes("image/*")) return file.type.startsWith("image/");
      return true;
    },
    [accept],
  );

  const add = useCallback(
    (files: File[] | FileList) => {
      const incoming = Array.from(files);
      const accepted = incoming.filter(matchesAccept);
      if (accepted.length === 0) {
        onError?.({
          code: "accept",
          message: "No files match the accepted types.",
        });
        return;
      }
      const sized = accepted.filter((file) =>
        maxFileSize ? file.size <= maxFileSize : true,
      );
      if (sized.length === 0) {
        onError?.({
          code: "max_file_size",
          message: "All files exceed the maximum size.",
        });
        return;
      }
      setItems((prev) => {
        const capacity =
          typeof maxFiles === "number"
            ? Math.max(0, maxFiles - prev.length)
            : undefined;
        const capped =
          typeof capacity === "number" ? sized.slice(0, capacity) : sized;
        if (typeof capacity === "number" && sized.length > capacity) {
          onError?.({
            code: "max_files",
            message: "Too many files. Some were not added.",
          });
        }
        return prev.concat(
          capped.map((file) => ({
            id: crypto.randomUUID(),
            type: "file" as const,
            url: URL.createObjectURL(file),
            mediaType: file.type,
            filename: file.name,
          })),
        );
      });
    },
    [matchesAccept, maxFiles, maxFileSize, onError],
  );

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const found = prev.find((file) => file.id === id);
      if (found?.url) URL.revokeObjectURL(found.url);
      return prev.filter((file) => file.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    setItems((prev) => {
      for (const file of prev) {
        if (file.url) URL.revokeObjectURL(file.url);
      }
      return [];
    });
    // The same file can be picked twice in a row only if the input is reset.
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  // Drops on the form itself.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types?.includes("Files")) event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
      if (event.dataTransfer?.types?.includes("Files")) event.preventDefault();
      if (event.dataTransfer?.files?.length) add(event.dataTransfer.files);
    };
    form.addEventListener("dragover", onDragOver);
    form.addEventListener("drop", onDrop);
    return () => {
      form.removeEventListener("dragover", onDragOver);
      form.removeEventListener("drop", onDrop);
    };
  }, [add]);

  useEffect(() => {
    if (!globalDrop) return;
    const onDragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types?.includes("Files")) event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
      if (event.dataTransfer?.types?.includes("Files")) event.preventDefault();
      if (event.dataTransfer?.files?.length) add(event.dataTransfer.files);
    };
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
  }, [add, globalDrop]);

  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    if (event.currentTarget.files) add(event.currentTarget.files);
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    const field = event.currentTarget.elements.namedItem("message");
    const text = field instanceof HTMLTextAreaElement ? field.value : "";
    await onSubmit({ text, files: items.map(stripId) }, event);
    // hogwarts leaves the attachments in place after a send, so the next ask
    // silently carries the last one's files. Clear after the handler resolves,
    // never before: clearing revokes the object URLs the handler is reading.
    clear();
  };

  const ctx = useMemo<AttachmentsContextValue>(
    () => ({
      files: items,
      add,
      remove,
      clear,
      openFileDialog,
      fileInputRef: inputRef,
    }),
    [items, add, remove, clear, openFileDialog],
  );

  return (
    <AttachmentsContext.Provider value={ctx}>
      <input
        accept={accept}
        className="hidden"
        multiple={multiple}
        onChange={handleChange}
        ref={inputRef}
        type="file"
      />
      <form
        data-slot="prompt-input"
        ref={formRef}
        className={cn(
          "bg-background w-full overflow-hidden rounded-xl border shadow-sm",
          className,
        )}
        onSubmit={handleSubmit}
        {...props}
      />
    </AttachmentsContext.Provider>
  );
}

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>;

export function PromptInputBody({ className, ...props }: PromptInputBodyProps) {
  return (
    <div
      data-slot="prompt-input-body"
      className={cn("flex flex-col", className)}
      {...props}
    />
  );
}

export type PromptInputTextareaProps = ComponentProps<typeof Textarea>;

export function PromptInputTextarea({
  onKeyDown,
  className,
  ...props
}: PromptInputTextareaProps) {
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
    <Textarea
      data-slot="prompt-input-textarea"
      name="message"
      className={cn(
        "field-sizing-content max-h-48 min-h-16 w-full resize-none rounded-none border-none bg-transparent shadow-none ring-0 outline-none dark:bg-transparent",
        "focus-visible:border-transparent focus-visible:ring-0",
        className,
      )}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}

export type PromptInputToolbarProps = HTMLAttributes<HTMLDivElement>;

export function PromptInputToolbar({
  className,
  ...props
}: PromptInputToolbarProps) {
  return (
    <div
      data-slot="prompt-input-toolbar"
      className={cn("flex items-center justify-between p-1", className)}
      {...props}
    />
  );
}

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

export function PromptInputTools({
  className,
  ...props
}: PromptInputToolsProps) {
  return (
    <div
      data-slot="prompt-input-tools"
      className={cn("flex items-center gap-1", className)}
      {...props}
    />
  );
}

export type PromptInputButtonProps = ComponentProps<typeof Button>;

export function PromptInputButton({
  className,
  variant = "ghost",
  size = "icon",
  ...props
}: PromptInputButtonProps) {
  return (
    <Button
      data-slot="prompt-input-button"
      type="button"
      variant={variant}
      size={size}
      className={cn(
        "shrink-0 gap-1.5 rounded-full",
        variant === "ghost" && "text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export type PromptInputActionMenuProps = ComponentProps<typeof DropdownMenu>;

export function PromptInputActionMenu(props: PromptInputActionMenuProps) {
  return <DropdownMenu {...props} />;
}

export type PromptInputActionMenuTriggerProps = ComponentProps<
  typeof PromptInputButton
>;

export function PromptInputActionMenuTrigger({
  className,
  children,
  ...props
}: PromptInputActionMenuTriggerProps) {
  return (
    <DropdownMenuTrigger asChild data-slot="prompt-input-action-menu-trigger">
      <PromptInputButton className={className} {...props}>
        {children ?? <Plus className="size-4" />}
      </PromptInputButton>
    </DropdownMenuTrigger>
  );
}

export type PromptInputActionMenuContentProps = ComponentProps<
  typeof DropdownMenuContent
>;

export function PromptInputActionMenuContent({
  className,
  ...props
}: PromptInputActionMenuContentProps) {
  return (
    <DropdownMenuContent
      data-slot="prompt-input-action-menu-content"
      align="start"
      className={cn(className)}
      {...props}
    />
  );
}

export type PromptInputActionMenuItemProps = ComponentProps<
  typeof DropdownMenuItem
>;

export function PromptInputActionMenuItem({
  className,
  ...props
}: PromptInputActionMenuItemProps) {
  return (
    <DropdownMenuItem
      data-slot="prompt-input-action-menu-item"
      className={cn(className)}
      {...props}
    />
  );
}

export type PromptInputSubmitProps = ComponentProps<typeof Button> & {
  status?: PromptInputStatus;
};

export function PromptInputSubmit({
  className,
  variant = "default",
  size = "icon",
  status,
  children,
  ...props
}: PromptInputSubmitProps) {
  let icon = <SendIcon className="size-4" />;
  if (status === "submitted") {
    icon = <Loader2Icon className="size-4 animate-spin" />;
  } else if (status === "streaming") {
    icon = <SquareIcon className="size-4" />;
  } else if (status === "error") {
    icon = <XIcon className="size-4" />;
  }

  return (
    <Button
      data-slot="prompt-input-submit"
      type="submit"
      variant={variant}
      size={size}
      className={cn("shrink-0 gap-1.5 rounded-full", className)}
      {...props}
    >
      {children ?? icon}
    </Button>
  );
}

export type PromptInputModelSelectProps = ComponentProps<typeof Select>;

export function PromptInputModelSelect(props: PromptInputModelSelectProps) {
  return <Select {...props} />;
}

export type PromptInputModelSelectTriggerProps = ComponentProps<
  typeof SelectTrigger
>;

export function PromptInputModelSelectTrigger({
  className,
  ...props
}: PromptInputModelSelectTriggerProps) {
  return (
    <SelectTrigger
      data-slot="prompt-input-model-select-trigger"
      className={cn(
        "text-muted-foreground border-none bg-transparent font-medium shadow-none transition-colors",
        'hover:bg-accent hover:text-foreground [&[aria-expanded="true"]]:bg-accent [&[aria-expanded="true"]]:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export type PromptInputModelSelectContentProps = ComponentProps<
  typeof SelectContent
>;

export function PromptInputModelSelectContent({
  className,
  ...props
}: PromptInputModelSelectContentProps) {
  return (
    <SelectContent
      data-slot="prompt-input-model-select-content"
      className={cn(className)}
      {...props}
    />
  );
}

export type PromptInputModelSelectItemProps = ComponentProps<typeof SelectItem>;

export function PromptInputModelSelectItem({
  className,
  ...props
}: PromptInputModelSelectItemProps) {
  return (
    <SelectItem
      data-slot="prompt-input-model-select-item"
      className={cn(className)}
      {...props}
    />
  );
}

export type PromptInputModelSelectValueProps = ComponentProps<
  typeof SelectValue
>;

export function PromptInputModelSelectValue({
  className,
  ...props
}: PromptInputModelSelectValueProps) {
  return (
    <SelectValue
      data-slot="prompt-input-model-select-value"
      className={cn(className)}
      {...props}
    />
  );
}
