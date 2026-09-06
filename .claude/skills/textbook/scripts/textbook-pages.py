#!/usr/bin/env python3
"""textbook-pages.py — render every PDF page of a textbook to WebP for the
in-app reader's "original page" view.

    python3 textbook-pages.py <subject dir>... [--width 1000] [--quality 70]
                              [--jobs 6] [--force]

Writes <dir>/pages/<N>.webp where N is the 1-based PDF page — the SAME number
the Markdown twin's `<!-- page N -->` markers use — so the reader can put each
page image beside its text. Existing files are kept unless --force. Upload with
`aws s3 sync <dir>/pages s3://<bucket>/catalog/textbooks/<dbSlug>/pages/`
(both buckets: databayt-cdn for cdn.databayt.org and the app bucket).
"""
import argparse, concurrent.futures, io, os, sys
import fitz  # PyMuPDF
from PIL import Image


def render(args):
    pdf, i, out, width, quality = args
    doc = fitz.open(pdf)
    page = doc[i]
    z = width / page.rect.width
    pix = page.get_pixmap(matrix=fitz.Matrix(z, z), alpha=False)
    im = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=quality, method=4)
    data = buf.getvalue()
    with open(out, "wb") as fh:
        fh.write(data)
    return len(data)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dirs", nargs="+")
    ap.add_argument("--width", type=int, default=1000)
    ap.add_argument("--quality", type=int, default=70)
    ap.add_argument("--jobs", type=int, default=6)
    ap.add_argument("--force", action="store_true")
    opt = ap.parse_args()
    for d in opt.dirs:
        d = d.rstrip("/")
        pdf = os.path.join(d, "textbook.pdf")
        if not os.path.isfile(pdf):
            print(f"{d}: no textbook.pdf", file=sys.stderr)
            continue
        outdir = os.path.join(d, "pages")
        os.makedirs(outdir, exist_ok=True)
        n = fitz.open(pdf).page_count
        jobs = []
        for i in range(n):
            out = os.path.join(outdir, f"{i + 1}.webp")
            if opt.force or not os.path.isfile(out):
                jobs.append((pdf, i, out, opt.width, opt.quality))
        total = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=opt.jobs) as ex:
            for size in ex.map(render, jobs):
                total += size
        print(f"{d}: {n} pages, {len(jobs)} rendered, {total / 1e6:.1f} MB new")


if __name__ == "__main__":
    main()
