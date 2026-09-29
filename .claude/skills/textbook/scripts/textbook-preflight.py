#!/usr/bin/env python3
"""textbook-preflight.py <book-dir> [--json]

Deterministic facts a run needs BEFORE it spends a token, all measured from the
PDF itself. Three questions that were answered by hand, per book, at real cost:

  1. Is this a VECTOR pdf or a SCAN?  A scan is raster-capped, so a higher-DPI
     render only upscales. A vector page renders genuinely sharper, and the
     1000 px page images throw away detail that small limits, subscripts and
     diacritics live in. `textbook-crop.py native` cannot answer this: it only
     inspects EMBEDDED RASTERS, so it reports zoomHelps:false on a vector page
     whose text would read perfectly at 3x.

  2. Does this book store reference numbers REVERSED from how they are drawn?
     `(17-1)` drawn with 17 leftmost is stored "1 – 17" in chemistry (chapter
     first) but math-specialized draws `تمرين ( ٧ – ١ )` already chapter-first.
     The difference tracks the digit script: Latin digits are bidi class EN,
     Arabic-Indic digits are AN, and they resolve differently. GUESSING WRONG
     REVERSES EVERY REFERENCE IN THE BOOK.

  3. Is there a usable text layer at all? When there is, it is ground truth for
     logical order and beats any number of vision re-reads.

Exit code is always 0 — this reports, it never blocks.
"""
import sys, os, json, re, argparse


def classify(doc, sample=(20, 40)):
    """VECTOR vs SCAN from images-per-page and the largest embedded raster."""
    lo, hi = sample
    hi = min(hi, len(doc))
    lo = min(lo, max(0, hi - 20))
    pages = max(1, hi - lo)
    total, biggest = 0, (0, 0)
    for i in range(lo, hi):
        for im in doc[i].get_images(full=True):
            total += 1
            if im[2] * im[3] > biggest[0] * biggest[1]:
                biggest = (im[2], im[3])
    per = total / pages
    # The reliable discriminator is the TEXT LAYER, not the images: a true scan
    # has no extractable text at all (physics: 0 chars), while a vector book has
    # thousands even when its Arabic is glyph-index mojibake. Images alone
    # mislead — chemistry averages 0.2 images/page (so most pages are pure text)
    # yet carries one 1575px figure, and agriculture averages 1.9 (figures, not
    # one full-page raster).
    txt = sum(len(doc[i].get_text()) for i in range(lo, hi))
    full_page_raster = 0.7 <= per <= 1.3 and biggest[0] >= 900
    is_scan = txt < 200 * pages and full_page_raster
    return {
        "kind": "scan" if is_scan else "vector",
        "text_chars_sampled": txt,
        "images_per_page": round(per, 2),
        "largest_image": list(biggest),
        "render_scale_for_small_glyphs": 1 if is_scan else 3,
        "note": (
            "raster-capped: a higher-DPI render only upscales; use textbook-crop.py native/zoom"
            if is_scan
            else "vector text: re-render the PAGE at 3x to read small limits/subscripts "
            "instead of marking them illegible"
        ),
    }


REF = re.compile(r"(\d{1,3})\s*[-–]\s*(\d{1,3})")


def reference_order(doc, max_pages=150):
    """Is a reference STORED in the reverse of the order it is DRAWN?

    Judged on the digit run itself, never on the whole line: find a stored
    (number, dash, number) triple and compare the x of its first and last
    token. In an RTL page the first LOGICAL character is drawn rightmost, so
    x(first) > x(last) means storage is logical — a reference drawn "17 - 1"
    is stored "1 - 17" and MEANS (1-17), chapter first.

    An earlier version compared whole lines and returned 0.54 on a book that is
    provably reversed: the Arabic tokens around the digits do not reverse
    cleanly, so they drowned the signal.
    """
    import fitz

    logical = visualish = 0
    samples = []
    for pno in range(min(len(doc), max_pages)):
        page = doc[pno]
        words = page.get_text("words")
        if not words:
            continue
        m = page.rotation_matrix
        lines = {}
        for w in words:
            pt = fitz.Point(w[0], w[1]) * m
            lines.setdefault(round(pt.y, 0), []).append((pt.x, w[4].strip()))
        for y, items in lines.items():
            for i in range(len(items) - 2):
                a, dash, b = items[i], items[i + 1], items[i + 2]
                if not (a[1].isdigit() and b[1].isdigit()):
                    continue
                if dash[1] not in ("-", "\u2013", "\u2014"):
                    continue
                if a[0] == b[0]:
                    continue  # rotated/overlapping: no horizontal evidence
                if a[0] > b[0]:
                    logical += 1   # stored first token sits to the RIGHT
                    if len(samples) < 5:
                        samples.append(
                            {"page": pno + 1,
                             "stored": f"{a[1]} - {b[1]}",
                             "drawn_left_to_right": f"{b[1]} - {a[1]}"}
                        )
                else:
                    visualish += 1
    total = logical + visualish
    # A handful of runs is not evidence. math-specialized yielded 2 runs and a
    # "confidence 1.0" that contradicted what a 3x render plainly showed; below
    # this floor the honest answer is "settle it visually".
    MIN_RUNS = 8
    if 0 < total < MIN_RUNS:
        return {
            "verdict": "unknown",
            "reason": f"only {total} digit run(s) in the text layer — below the {MIN_RUNS} needed "
                      "to call direction; a confident-looking ratio on this little data has "
                      "already been wrong once",
            "how_to_settle": "on a 3x render find a reference whose meaning is unambiguous — an "
                             "exercise number inside a known unit, e.g. تمرين (٧-١) in unit 7 — "
                             "and read which component is the chapter.",
            "runs_compared": total,
            "samples": [],
        }
    if total == 0:
        return {
            "verdict": "unknown",
            "reason": "no usable text layer carrying digit references "
                      "(glyph-index encoded, or a pure scan)",
            "how_to_settle": "on a 3x render find a reference whose meaning is unambiguous — an "
                             "exercise number inside a known unit, e.g. تمرين (٧-١) in unit 7 — "
                             "and read which component is the chapter. Do NOT carry another "
                             "book's answer over: it tracks the digit script.",
            "samples": [],
        }
    frac = logical / total
    return {
        "verdict": "stored-reversed-from-drawn" if frac > 0.6 else "stored-matches-drawn",
        "confidence": round(max(frac, 1 - frac), 2),
        "runs_compared": total,
        "transcribe_as": (
            "CHAPTER-FIRST — the drawn order is reversed; a reference drawn '17 - 1' is written (1-17)"
            if frac > 0.6
            else "AS DRAWN — stored order already equals drawn order; do not reverse"
        ),
        "samples": samples,
    }


def digit_script(doc, max_pages=60):
    """Latin (EN) vs Arabic-Indic (AN) digits — they resolve differently under bidi."""
    latin = arabic = 0
    for pno in range(min(len(doc), max_pages)):
        t = doc[pno].get_text()
        latin += sum(c.isdigit() and c.isascii() for c in t)
        arabic += sum("٠" <= c <= "٩" for c in t)
    if latin == arabic == 0:
        return {"script": "unknown", "latin": 0, "arabic_indic": 0}
    return {
        "script": "latin" if latin >= arabic else "arabic-indic",
        "latin": latin,
        "arabic_indic": arabic,
        "note": "bidi class EN" if latin >= arabic else "bidi class AN — resolves differently from EN",
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("book")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    pdf = os.path.join(a.book, "textbook.pdf")
    if not os.path.exists(pdf):
        print(json.dumps({"error": f"no textbook.pdf in {a.book}"}))
        return 0
    import fitz

    doc = fitz.open(pdf)
    text_chars = sum(len(doc[i].get_text()) for i in range(min(len(doc), 40)))
    out = {
        "book": os.path.abspath(a.book),
        "pages": len(doc),
        "render": classify(doc),
        "digits": digit_script(doc),
        "references": reference_order(doc),
        "text_layer_chars_first40": text_chars,
        "text_layer_usable": text_chars > 500,
    }
    doc.close()
    print(json.dumps(out, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
