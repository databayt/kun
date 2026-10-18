"use client";

// The media team's shelf — finished work in, no brief first.
//
// The seat lane needed a pending brief before anything could be uploaded, so
// a video someone had already cut, or a screenshot of a real screen, had no
// way into the library. This is that way: pick the file, say what it shows,
// tag the feature (or leave it brand-wide), and it waits in the library and
// in Publish's recommendations until a post — with a draft, or alone — takes
// it. Images re-encode to WebP and ride the server action; videos PUT
// straight to S3 on a presigned URL, because they are far past the 4MB body
// limit and a Worker should not spend its CPU copying them.

import { useRef, useState } from "react";
import { Check, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  confirmMediaUpload,
  presignMediaUpload,
  uploadMedia,
} from "@/actions/post-social";
import { useSocial } from "@/components/root/social/provider";
import { ANY_FEATURE } from "@/components/root/social/post-settings";
import { mediaKind } from "@/lib/media-kind";
import { toWebp } from "./brief-queue";
import { ASSET_TYPES, typeLabel } from "./taxonomy";

const IMAGE_TYPES = ["image/webp", "image/png", "image/jpeg"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

export function UploadShelf() {
  const { t, isRTL, product, feature, brandFeatures } = useSocial();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [tag, setTag] = useState<string>(
    feature !== ANY_FEATURE ? feature : ANY_FEATURE,
  );
  const [assetType, setAssetType] = useState<string>("product");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const isVideo = file ? VIDEO_TYPES.includes(file.type) : false;
  const ready = file !== null && caption.trim().length >= 2 && !busy;

  const pick = (f: File | undefined) => {
    setDone(false);
    setError(null);
    if (!f) return setFile(null);
    if (![...IMAGE_TYPES, ...VIDEO_TYPES].includes(f.type)) {
      setError(`Unsupported file type: ${f.type || "unknown"}.`);
      return setFile(null);
    }
    setFile(f);
  };

  const submit = async () => {
    if (!file || !ready) return;
    setBusy(true);
    setError(null);
    const featureTag = tag !== ANY_FEATURE ? tag : null;
    try {
      if (isVideo) {
        const signed = await presignMediaUpload({
          product,
          contentType: file.type,
          size: file.size,
        });
        if (!signed.ok || !signed.uploadUrl || !signed.key) {
          throw new Error(signed.error ?? "Could not start the upload.");
        }
        const put = await fetch(signed.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
          body: file,
        });
        if (!put.ok)
          throw new Error(`Storage refused the upload (${put.status}).`);
        const saved = await confirmMediaUpload({
          product,
          key: signed.key,
          feature: featureTag,
          caption,
        });
        if (!saved.ok)
          throw new Error(saved.error ?? "Could not record the upload.");
      } else {
        const form = new FormData();
        form.set("product", product);
        form.set("caption", caption);
        form.set("assetType", assetType);
        if (featureTag) form.set("feature", featureTag);
        form.set("file", await toWebp(file));
        const res = await uploadMedia(form);
        if (!res.ok) throw new Error(res.error ?? "Upload failed.");
      }
      setDone(true);
      setFile(null);
      setCaption("");
      if (fileRef.current) fileRef.current.value = "";
      // The showroom grid below is a server read — refresh it so the new
      // asset appears without a manual reload.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 border p-4 text-start sm:p-6">
      <div>
        <h3 className="text-primary text-base font-medium">{t.uploadTitle}</h3>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed font-light">
          {t.uploadIntro}
        </p>
      </div>

      <label className="hover:bg-muted/40 flex cursor-pointer items-center gap-3 border border-dashed p-4 transition-colors">
        <Upload className="text-muted-foreground size-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm">
          {file ? file.name : t.uploadChoose}
        </span>
        {file && (
          <span className="text-muted-foreground font-mono text-[10px] uppercase">
            {mediaKind(file.name)} · {(file.size / 1024 / 1024).toFixed(1)}MB
          </span>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={[...IMAGE_TYPES, ...VIDEO_TYPES].join(",")}
          className="sr-only"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </label>

      <div className="grid gap-2 sm:grid-cols-3">
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={t.uploadCaption}
          aria-label={t.uploadCaption}
          dir="auto"
          className="bg-background border px-3 py-2 text-sm sm:col-span-3"
        />
        <select
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          aria-label={t.uploadFeature}
          className="bg-background border px-3 py-2 text-sm"
        >
          <option value={ANY_FEATURE}>{t.uploadAnyFeature}</option>
          {brandFeatures.map((f) => (
            <option key={f.id} value={f.id}>
              {isRTL ? f.ar : f.en}
            </option>
          ))}
        </select>
        {!isVideo && (
          <select
            value={assetType}
            onChange={(e) => setAssetType(e.target.value)}
            aria-label={t.uploadType}
            className="bg-background border px-3 py-2 text-sm"
          >
            {ASSET_TYPES.filter((a) => a !== "reel" && a !== "story").map(
              (a) => (
                <option key={a} value={a}>
                  {typeLabel(a, isRTL)}
                </option>
              ),
            )}
          </select>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={!ready}
          className="hover:bg-muted flex items-center justify-center gap-2 border px-4 py-2 text-sm transition-colors disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" /> {t.uploadBusy}
            </>
          ) : (
            t.uploadSubmit
          )}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {done && (
        <p
          role="status"
          className="text-muted-foreground flex items-center gap-1.5 text-sm"
        >
          <Check className="size-4" /> {t.uploadDone}
        </p>
      )}
    </div>
  );
}
