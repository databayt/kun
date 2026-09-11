#!/usr/bin/env python3
"""textbook-crop.py — crops that turn judgement into observation.

Two measured facts drive this tool. (1) Asked to judge RTL table direction on a full page, transcribers
get it backwards, and get it backwards AGAIN when asked to audit it; shown only the right edge of the
page they cannot. (2) Figures are embedded at their native resolution but the 1000 px page render paints
them small — on sd/g12/biology page 60 a 1237 px flower diagram is drawn at ~350 px, which is why its
labels read as [غير مقروء]. Re-rendering the figure's rectangle at native density recovers what the
scan actually holds; when the native image is no larger than the render, nothing can, and this tool
says so instead of letting a retry loop spin.

  textbook-crop.py right <book> --pages 42,168 [--frac 0.45]     # tables-audit/<N>.right.webp + _TASK.md
  textbook-crop.py zoom  <book> --pages 60,196 [--max-zoom 6]    # crops/<N>.img<k>.webp at native density,
                                                                 #   plus crops/<N>.tile<k>.webp (3 bands, 2400 px)
  textbook-crop.py native <book> --pages 60,196                  # JSON: embedded image sizes vs painted sizes
Requires PyMuPDF + Pillow. Output paths are printed as JSON, one line per page.
"""
import argparse, io, json, sys
from pathlib import Path
import fitz  # PyMuPDF
from PIL import Image

TASK_RIGHT = """# Task: read the RIGHTMOST table column from a crop

You are given a CROP showing only the RIGHT ~{pct}% of a textbook page. Everything you can see was
physically on the right-hand side of the page.

You are NOT judging direction, and you are NOT transcribing the page. You report what is inside the
crop, nothing more.

## For each assigned page N

1. Read the image `tables-audit/<N>.right.webp`.
2. Find each table in the crop (a ruled or shaded grid). Work top to bottom.
3. For each table, report the text of the **first row's cell that is nearest the RIGHT edge of the
   crop** — that is the rightmost printed column of that table. If the table has a header row, this is
   its header. If not, it is the topmost data cell of the rightmost column.
4. Also report the cell immediately to its LEFT, when one is visible.

Write `tables-audit/<N>.right.json`:

```json
{{
  "page": 42,
  "tables": [
    {{ "rightmostFirstCell": "…", "nextToItsLeft": "…", "note": "" }}
  ]
}}
```

- Copy text as printed, a few words is enough. Do not translate or normalise.
- A visually empty cell is `""`.
- Columns may be cut off at the crop's left edge — that is expected and fine. Only the RIGHT edge matters.
- A rounded box around a diagram, a cross, or a flow chart is NOT a table: report `"tables": []` for it.
- No table in the crop: `{{"page": N, "tables": []}}`.

Reply with one line: `done <pages>, <n> files`.
"""


def save_webp(pix: fitz.Pixmap, out: Path, quality: int = 80) -> int:
    im = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=quality, method=4)
    out.write_bytes(buf.getvalue()); return len(buf.getvalue())


def pages_arg(s: str):
    return [int(x) for x in s.split(',') if x.strip()]


def native_report(doc, n: int, render_width: int) -> dict:
    page = doc[n - 1]
    scale = render_width / page.rect.width  # px per pt at the page render
    items = []
    for im in page.get_images(full=True):
        xref = im[0]
        try:
            info = doc.extract_image(xref)
        except Exception:
            continue
        for r in page.get_image_rects(xref):
            if r.width < 40 or r.height < 40:
                continue  # rules, bullets, glyph fragments
            painted = (round(r.width * scale), round(r.height * scale))
            gain = round(info['width'] / max(painted[0], 1), 2)
            items.append({'xref': xref, 'native': [info['width'], info['height']], 'paintedAtRender': list(painted),
                          'rect': [round(v) for v in r], 'gain': gain, 'zoomHelps': gain >= 1.3})
    return {'page': n, 'images': items, 'zoomHelps': any(i['zoomHelps'] for i in items)}


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    for name in ('right', 'zoom', 'native'):
        s = sub.add_parser(name); s.add_argument('book'); s.add_argument('--pages', required=True)
        s.add_argument('--render-width', type=int, default=1000)
    sub.choices['right'].add_argument('--frac', type=float, default=0.45)
    sub.choices['zoom'].add_argument('--max-zoom', type=float, default=6.0)
    sub.choices['zoom'].add_argument('--tiles', type=int, default=3)
    sub.choices['zoom'].add_argument('--tile-width', type=int, default=2400)
    a = ap.parse_args()

    book = Path(a.book).resolve()
    pdf = book / 'textbook.pdf'
    if not pdf.exists():
        sys.exit(f'no textbook.pdf in {book}')
    doc = fitz.open(pdf)

    for n in pages_arg(a.pages):
        if n < 1 or n > doc.page_count:
            print(json.dumps({'page': n, 'error': 'out of range'})); continue
        page = doc[n - 1]
        if a.cmd == 'native':
            print(json.dumps(native_report(doc, n, a.render_width))); continue

        if a.cmd == 'right':
            out_dir = book / 'tables-audit'; out_dir.mkdir(exist_ok=True)
            task = out_dir / '_TASK.md'
            if not task.exists():
                task.write_text(TASK_RIGHT.format(pct=int(a.frac * 100)), encoding='utf-8')
            r = page.rect
            clip = fitz.Rect(r.x1 - r.width * a.frac, r.y0, r.x1, r.y1)
            z = 1600 / r.width  # crops are read for text, give them more pixels than the page render
            pix = page.get_pixmap(matrix=fitz.Matrix(z, z), clip=clip, alpha=False)
            out = out_dir / f'{n}.right.webp'
            size = save_webp(pix, out)
            print(json.dumps({'page': n, 'crop': str(out.relative_to(book)), 'px': [pix.width, pix.height], 'bytes': size}))
            continue

        # zoom: native-density crops of every embedded image + full-page bands
        out_dir = book / 'crops'; out_dir.mkdir(exist_ok=True)
        rep = native_report(doc, n, a.render_width)
        files = []
        for k, im in enumerate(rep['images']):
            r = fitz.Rect(*im['rect'])
            z = min(a.max_zoom, max(2.0, im['native'][0] / max(r.width, 1)))
            pad = 6
            clip = fitz.Rect(max(0, r.x0 - pad), max(0, r.y0 - pad), min(page.rect.x1, r.x1 + pad), min(page.rect.y1, r.y1 + pad))
            pix = page.get_pixmap(matrix=fitz.Matrix(z, z), clip=clip, alpha=False)
            out = out_dir / f'{n}.img{k}.webp'
            save_webp(pix, out)
            files.append({'file': str(out.relative_to(book)), 'px': [pix.width, pix.height], 'zoom': round(z, 2), 'gain': im['gain']})
        z = a.tile_width / page.rect.width
        band = page.rect.height / a.tiles
        for k in range(a.tiles):
            clip = fitz.Rect(page.rect.x0, page.rect.y0 + k * band, page.rect.x1, page.rect.y0 + (k + 1) * band)
            pix = page.get_pixmap(matrix=fitz.Matrix(z, z), clip=clip, alpha=False)
            out = out_dir / f'{n}.tile{k}.webp'
            save_webp(pix, out)
            files.append({'file': str(out.relative_to(book)), 'px': [pix.width, pix.height], 'zoom': round(z, 2)})
        print(json.dumps({'page': n, 'zoomHelps': rep['zoomHelps'], 'crops': files}))


if __name__ == '__main__':
    main()
