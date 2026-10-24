#!/usr/bin/env python3
"""textbook-triage.py <book-dir> [--out page-plan.json] [--json]

Per-page facts from the PDF, before a token is spent — the page-level companion of
textbook-preflight.py (which answers per BOOK). Each page gets a kind and a route:

  blank       no text layer and almost no ink               → stamp <!-- blank -->, no read
  image-only  one raster covers the page, no text layer     → model read + model witness
  text        a text layer exists                           → model read; the free text-layer
                                                              witness (md-agreement.py --witness)
                                                              may clear it after transcription

`layer` is the page's text-layer state: none | latin | arabic | garbled | mojibake (Latin code
points in an Arabic book — glyph indices, unusable even as a witness). `garbled` = Arabic
code points that are mostly junk-interleaved (fonts with a wrong glyph map, «ا5ستعداد»); such
a layer can still feed the skeleton witness, never the transcription.

Free and deterministic (PyMuPDF). Exit code is always 0 — it reports, it never blocks.
"""
import argparse, json, re, sys
from pathlib import Path

AR = re.compile(r'[ء-ي]')
LAT = re.compile(r'[A-Za-z]')
JUNK_IN_WORD = re.compile(r'[ء-ي][0-9|{}~\'y�]+[ء-ي]')


def page_row(page, lang: str) -> dict:
    text = page.get_text()
    chars = len(text.strip())
    ar, lat = len(AR.findall(text)), len(LAT.findall(text))
    words = [w for w in text.split() if AR.search(w)]
    junk = sum(1 for w in words if JUNK_IN_WORD.search(w))
    area = abs(page.rect)
    cover = 0.0
    for img in page.get_images(full=True):
        for r in page.get_image_rects(img[0]):
            cover = max(cover, abs(r & page.rect) / area if area else 0.0)
    ink = len(page.get_drawings()) if chars < 20 else None

    if chars < 20 and cover < 0.05 and (ink or 0) < 5:
        kind = 'blank'
    elif chars < 20:
        kind = 'image-only'
    else:
        kind = 'text'
    if chars < 20:
        layer = 'none'
    elif ar >= lat:
        layer = 'garbled' if words and junk / len(words) > 0.05 else 'arabic'
    else:
        # Latin code points in an Arabic book are glyph-index mojibake (g10 physics: 162/163 pages)
        layer = 'mojibake' if lang == 'ar' else 'latin'
    return {'chars': chars, 'arabic': ar, 'latin': lat, 'junkWords': junk,
            'imageCover': round(cover, 2), 'kind': kind, 'layer': layer}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('book')
    ap.add_argument('--out', help='write the full plan here (default <book>/pages-md-verify/page-plan.json)')
    ap.add_argument('--json', action='store_true', help='print the summary as JSON')
    a = ap.parse_args()
    book = Path(a.book).resolve()
    pdf = book / 'textbook.pdf'
    if not pdf.exists():
        print(json.dumps({'error': f'no textbook.pdf in {book}'})); return 0
    import fitz  # PyMuPDF

    lang = 'ar'
    sj = book / 'structure.json'
    if sj.exists():
        lang = (json.loads(sj.read_text(encoding='utf-8')).get('lang') or 'ar').split('-')[0]
    doc = fitz.open(pdf)
    pages = {}
    for i in range(len(doc)):
        try:
            pages[i + 1] = page_row(doc[i], lang)
        except Exception as e:  # a damaged page stream must not sink the plan
            pages[i + 1] = {'kind': 'image-only', 'layer': 'none', 'error': str(e)[:120]}
    doc.close()

    def count(key):
        out = {}
        for r in pages.values():
            out[r[key]] = out.get(r[key], 0) + 1
        return out

    summary = {'book': str(book), 'pages': len(pages), 'kinds': count('kind'), 'layers': count('layer'),
               'blank': [n for n, r in pages.items() if r['kind'] == 'blank']}
    out = Path(a.out) if a.out else book / 'pages-md-verify' / 'page-plan.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({**summary, 'perPage': pages}, ensure_ascii=False, indent=1), encoding='utf-8')
    summary['plan'] = str(out)
    if a.json:
        print(json.dumps(summary, ensure_ascii=False))
    else:
        print(f"{summary['pages']} pages · kinds {summary['kinds']} · layers {summary['layers']}\nplan → {out}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
