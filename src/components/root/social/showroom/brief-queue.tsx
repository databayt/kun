"use client";

// The seat lane's surface — the Media stage's first piece of in-app state.
//
// The other two lanes write to disk: Higgsfield downloads to ~/Downloads, the
// carousel engine renders to a file. Neither needs a queue. This lane's renderer
// is a person holding a ChatGPT seat, and a seat has no API key, so no server
// can call it. What a person needs instead is a work list and a way back in —
// which is this component, built to be used on a phone standing up, because
// that is where the ChatGPT app is.
//
// The image is re-encoded to WebP in the browser before it is sent. A 1792x1024
// PNG off GPT Image 2 runs 2-4MB, over the Server Action body limit and far more
// than a social image needs; the canvas hop lands it around 300KB with no
// visible loss, so the upload path never has to think about size again.

import { useRef, useState, useTransition } from "react";
import { Check, Copy, Loader2, Upload, X } from "lucide-react";
import { useSocial } from "@/components/root/social/provider";
import {
  dismissMediaBrief,
  fileMediaBrief,
  submitMediaRender,
} from "@/actions/post-social";
import type { BriefRow } from "@/lib/social-media-brief";

const WEBP_QUALITY = 0.92;

/**
 * Decode → draw → re-encode. Returns the original untouched if anything in the
 * chain fails: a browser that cannot do this should still be able to upload,
 * and the action's own size check is the backstop.
 */
async function toWebp(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", WEBP_QUALITY),
    );
    if (!blob || blob.size === 0) return file;
    return new File([blob], file.name.replace(/\.\w+$/, ".webp"), {
      type: "image/webp",
    });
  } catch {
    return file;
  }
}

export function BriefQueue({
  briefs,
  types,
  typesByBrand,
  brand: initialBrand,
}: {
  briefs: BriefRow[];
  types?: { id: string; use: string }[];
  typesByBrand?: Record<string, { id: string; use: string }[]>;
  brand?: string;
}) {
  const { t, product } = useSocial();
  const activeBrand = product || initialBrand || "mkan";
  const activeTypes =
    types ||
    (typesByBrand
      ? typesByBrand[activeBrand] ||
        typesByBrand.mkan ||
        typesByBrand.hogwarts ||
        []
      : []);

  // Optimistic local list: the server component above only re-reads on a route
  // change, and a renderer working through four briefs should see each one
  // leave as they finish it.
  const [rows, setRows] = useState(briefs);
  const [error, setError] = useState<string | null>(null);

  const drop = (id: string) => setRows((r) => r.filter((b) => b.id !== id));

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          {t.briefQueueTitle}
        </h4>
        {rows.length > 0 && (
          <span className="text-muted-foreground font-mono text-xs">
            {rows.length}
          </span>
        )}
      </div>
      <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed font-light">
        {t.briefQueueIntro}
      </p>

      {error && (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t.briefQueueEmpty}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((b) => (
            <BriefCard key={b.id} brief={b} onDone={drop} onError={setError} />
          ))}
        </ul>
      )}

      <FileBriefForm
        brand={activeBrand}
        types={activeTypes}
        onFiled={(b) => setRows((r) => [...r, b])}
        onError={setError}
      />
    </div>
  );
}

function BriefCard({
  brief,
  onDone,
  onError,
}: {
  brief: BriefRow;
  onDone: (id: string) => void;
  onError: (msg: string | null) => void;
}) {
  const { t } = useSocial();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const copy = async () => {
    await navigator.clipboard.writeText(brief.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const upload = async (file: File) => {
    onError(null);
    setBusy(true);
    const encoded = await toWebp(file);
    const form = new FormData();
    form.set("briefId", brief.id);
    form.set("file", encoded);
    const res = await submitMediaRender(form);
    setBusy(false);
    if (!res.ok) {
      onError(res.error ?? "Upload failed.");
      return;
    }
    onDone(brief.id);
  };

  return (
    <li className="border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="bg-muted px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase">
          {brief.assetType}
        </span>
        <span className="text-muted-foreground font-mono text-[10px]" dir="ltr">
          {brief.size}
        </span>
        <span className="text-muted-foreground font-mono text-[10px]">
          {brief.brand}
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed">{brief.subject}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={copy}
          className="hover:bg-muted flex items-center justify-center gap-2 border px-3 py-2 text-sm transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-green-600" /> {t.briefCopied}
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" /> {t.briefCopyPrompt}
            </>
          )}
        </button>

        <button
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          className="hover:bg-muted flex items-center justify-center gap-2 border px-3 py-2 text-sm transition-colors disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {t.briefUploading}
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" /> {t.briefUpload}
            </>
          )}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            // Reset so re-picking the same file after a failure still fires.
            e.target.value = "";
            if (f) void upload(f);
          }}
        />

        <button
          onClick={async () => {
            const res = await dismissMediaBrief({ id: brief.id });
            if (res.ok) onDone(brief.id);
            else onError(res.error ?? null);
          }}
          disabled={busy}
          className="text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 px-2 py-2 text-sm transition-colors disabled:opacity-50"
        >
          <X className="h-4 w-4" /> {t.briefDismiss}
        </button>
      </div>
    </li>
  );
}

function FileBriefForm({
  brand,
  types,
  onFiled,
  onError,
}: {
  brand: string;
  types: { id: string; use: string }[];
  onFiled: (b: BriefRow) => void;
  onError: (msg: string | null) => void;
}) {
  const { t } = useSocial();
  const [assetType, setAssetType] = useState(types[0]?.id ?? "hero");
  const [subject, setSubject] = useState("");
  const [pending, start] = useTransition();

  const effectiveType = types.some((ty) => ty.id === assetType)
    ? assetType
    : types[0]?.id ?? "hero";

  const submit = () => {
    onError(null);
    start(async () => {
      const res = await fileMediaBrief({ brand, assetType: effectiveType, subject });
      if (!res.ok || !res.brief) {
        onError(res.error ?? "Could not file the brief.");
        return;
      }
      onFiled(res.brief);
      setSubject("");
    });
  };

  return (
    <div className="border-t pt-4">
      <h5 className="text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase">
        {t.briefFileTitle}
      </h5>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={effectiveType}
          onChange={(e) => setAssetType(e.target.value)}
          aria-label={t.briefTypeLabel}
          className="bg-background border px-3 py-2 text-sm"
        >
          {types.map((ty) => (
            <option key={ty.id} value={ty.id}>
              {ty.id}
            </option>
          ))}
        </select>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && subject.trim().length >= 8) submit();
          }}
          placeholder={t.briefFileSubject}
          className="bg-background flex-1 border px-3 py-2 text-sm"
        />
        <button
          onClick={submit}
          disabled={pending || subject.trim().length < 8}
          className="hover:bg-muted flex items-center justify-center gap-2 border px-4 py-2 text-sm transition-colors disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {t.briefFiling}
            </>
          ) : (
            t.briefFileSubmit
          )}
        </button>
      </div>
    </div>
  );
}
