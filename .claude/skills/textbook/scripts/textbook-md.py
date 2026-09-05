#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""textbook-md.py — give a textbook.pdf its Markdown twin (textbook.md), honestly graded.

Pipeline per subject directory (a dir holding textbook.pdf, optionally structure.json):

  1. MarkItDown (Microsoft, pdfminer.six engine) via `uvx --from 'markitdown[pdf]' markitdown`.
     The CLI is used, not the MCP, so a 400-page book never lands in the model's context.
  2. RTL post-processing of what MarkItDown returns — the part that makes Arabic PDFs usable:
       - Arabic presentation-form glyphs (U+FB50–FDFF, U+FE70–FEFF) → standard letters; a glyph
         that expands to several letters (lam-meem, lam-alef…) is pre-flipped on lines that
         will be reversed, or it comes out swapped ("املناهج").
       - pdfminer emits Arabic in VISUAL order → each line is reversed back to logical order
         when a vote over common words says the line is backwards; digits/Latin runs are kept
         LTR and brackets swapped.
       - "(cid:NN)" tokens (fonts without a Unicode map) are stripped — they carry no text.
  3. Quality grade from measured facts (chars per page, unmapped letters, glyph tokens):
     A clean · B readable with defects · C fragments · EMPTY (scan or unmapped font).
  4. OCR fallback (--ocr auto, the default): when the text layer grades EMPTY or C, pages are
     rendered with PyMuPDF and read by tesseract (ara/eng/fra from structure.json lang); the
     better of the two results is kept and the front matter says which engine produced it.
     tesseract is free and offline (brew install tesseract tesseract-lang) — the only OCR lane
     compatible with the subscription-only billing posture; MarkItDown's own OCR needs an
     Azure Document Intelligence endpoint (paid) and is not used here.
  5. textbook.md = YAML front matter (title, dbSlug, edition, source md5/pages, generator,
     extraction, quality, coverage, stats, notes) + "# title" + body. Never invents text.

Usage:
  textbook-md.py <subject-dir> [<subject-dir> ...] [--ocr auto|off|force] [--dpi 200]
                 [--psm 3] [--jobs 6] [--lang ara] [--keep-raw] [--quiet]
  textbook-md.py curriculum/sd/g12/*/            # a whole grade
Exit code 0; one JSON line per subject on stdout (subject, quality, coverage, engine, bytes).

Requires: python3 with PyMuPDF (pip install pymupdf), uv (for uvx), tesseract (+ tesseract-lang).
"""
import argparse, concurrent.futures, datetime, hashlib, json, os, re, shutil, subprocess, sys, tempfile, unicodedata

try:
    import fitz  # PyMuPDF
except ImportError:  # pragma: no cover
    sys.exit("PyMuPDF missing: pip3 install pymupdf")

AR = re.compile("[\\u0600-\\u06FF]")
PRES = re.compile("[\uFB50-\uFDFF\uFE70-\uFEFF]")
COMMON = ["في", "من", "على", "التي", "الذي", "هذا", "هذه", "إلى", "عن", "أن", "كان", "ذلك", "بين", "هو",
          "هي", "مع", "كل", "عند", "بعد", "قبل", "أو", "ثم", "حتى", "لأن", "عليه", "الله", "وهي", "وهو"]
BRACKETS = str.maketrans("()[]{}<>«»", ")(][}{><»«")
LTR_RUN = re.compile(r"[A-Za-z0-9٠-٩][A-Za-z0-9٠-٩.,:%/+\-]*")
TESS_LANG = {"ar": "ara", "en": "eng", "fr": "fra"}
MARKITDOWN = ["uvx", "--from", "markitdown[pdf]", "markitdown"]


# ────────────────────────── MarkItDown + RTL post-processing ──────────────────────────
def run_markitdown(pdf: str) -> str:
    with tempfile.NamedTemporaryFile(suffix=".md", delete=False) as tmp:
        out = tmp.name
    try:
        subprocess.run(MARKITDOWN + [pdf, "-o", out], check=True, capture_output=True, timeout=1800)
        return open(out, encoding="utf-8", errors="replace").read()
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:  # pragma: no cover
        return f"<!-- markitdown failed: {e} -->\n"
    finally:
        try: os.unlink(out)
        except OSError: pass


def reverse_line(line: str) -> str:
    rev = line[::-1].translate(BRACKETS)
    return LTR_RUN.sub(lambda m: m.group(0)[::-1], rev)


def votes(line: str):
    words = set(re.findall("[\\u0600-\\u06FF]{2,}", line))
    return sum(1 for w in COMMON if w in words), sum(1 for w in COMMON if w[::-1] in words)


def normalize_pres(line: str, for_reversal: bool) -> str:
    def one(m):
        exp = unicodedata.normalize("NFKC", m.group(0))
        return exp[::-1] if (for_reversal and len(exp) > 1) else exp
    return PRES.sub(one, line)


def rtl_post(raw: str):
    cid = len(re.findall(r"\(cid:\d+\)", raw))
    text = re.sub(r"\(cid:\d+\)", "", raw)
    pres_chars = len(PRES.findall(text))
    fwd_doc, rev_doc = votes(normalize_pres(text, False))
    doc_reversed = rev_doc > fwd_doc
    fixed, out = 0, []
    for line in text.split("\n"):
        if AR.search(line) or PRES.search(line):
            f, r = votes(normalize_pres(line, False))
            reverse = (r > f) if (f or r) else doc_reversed
            line = normalize_pres(line, reverse)
            if reverse:
                line = reverse_line(line); fixed += 1
        out.append(line)
    text = re.sub(r"[ \t]+\n", "\n", "\n".join(out))
    text = re.sub(r"\n{3,}", "\n\n", text).strip() + "\n"
    return text, dict(cid=cid, pres=pres_chars, reordered=fixed)


# ────────────────────────────────── OCR fallback ──────────────────────────────────
def ocr_page(args):
    pdf, i, dpi, lang, psm = args
    doc = fitz.open(pdf); page = doc[i]
    pix = page.get_pixmap(matrix=fitz.Matrix(dpi / 72, dpi / 72), colorspace=fitz.csGRAY, alpha=False)
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        pix.save(tmp.name); png = tmp.name
    try:
        r = subprocess.run(["tesseract", png, "stdout", "-l", lang, "--psm", str(psm)],
                           capture_output=True, text=True, timeout=300)
        return i, (r.stdout or "")
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return i, ""
    finally:
        try: os.unlink(png)
        except OSError: pass


def run_ocr(pdf: str, lang: str, dpi: int, psm: int, jobs: int) -> str:
    n = fitz.open(pdf).page_count
    pages = [""] * n
    with concurrent.futures.ThreadPoolExecutor(max_workers=jobs) as ex:
        for i, txt in ex.map(ocr_page, [(pdf, i, dpi, lang, psm) for i in range(n)]):
            pages[i] = txt
    parts = []
    for i, txt in enumerate(pages, 1):
        txt = re.sub(r"[ \t]+\n", "\n", txt).strip()
        txt = re.sub(r"\n{3,}", "\n\n", txt)
        parts.append(f"<!-- page {i} -->\n\n{txt}\n" if txt else f"<!-- page {i}: no text recognised -->\n")
    return "\n".join(parts)


# ─────────────────────────────────── grading ───────────────────────────────────
def grade(text: str, pages: int, lang: str, cid: int):
    ar = len(AR.findall(text)); lat = len(re.findall(r"[A-Za-z]", text)); repl = text.count("�")
    main = lat if lang in ("en", "fr") else ar
    per_page = main / max(1, pages)
    if per_page < 40:
        q = "EMPTY"
    elif repl > main / 20 or cid > main / 5 or per_page < 120:
        q = "C"
    elif repl > main / 100:
        q = "B"
    else:
        q = "A"
    coverage = min(100, round(100 * per_page / 1200))
    return dict(quality=q, coverage=coverage, arabicChars=ar, latinChars=lat, unmappedLetters=repl)


RANK = {"EMPTY": 0, "C": 1, "B": 2, "A": 3}


def process(sdir: str, opt) -> dict:
    sdir = sdir.rstrip("/")
    pdf = os.path.join(sdir, "textbook.pdf")
    if not os.path.isfile(pdf):
        return dict(subject=os.path.basename(sdir), error="no textbook.pdf")
    st = {}
    sp = os.path.join(sdir, "structure.json")
    if os.path.isfile(sp):
        st = json.load(open(sp, encoding="utf-8"))
    lang = st.get("lang", "ar")
    pages = fitz.open(pdf).page_count
    subject = os.path.basename(sdir); grade_dir = os.path.basename(os.path.dirname(sdir))

    # 1–3: MarkItDown + RTL + grade
    raw = run_markitdown(pdf)
    text, ps = rtl_post(raw)
    g = grade(text, pages, lang, ps["cid"])
    engine, notes = "markitdown 0.1.7 (pdfminer.six) + rtl post-processing", []
    if ps["pres"]: notes.append(f"{ps['pres']} presentation-form glyphs normalised to standard letters")
    if ps["reordered"]: notes.append(f"{ps['reordered']} lines re-ordered from visual to logical Arabic order")
    if ps["cid"]: notes.append(f"{ps['cid']} unmapped glyph tokens removed (font has no Unicode map)")
    if g["unmappedLetters"]: notes.append(f"{g['unmappedLetters']} letters the font did not map (shown as U+FFFD)")
    extraction = "text-layer" if g["quality"] != "EMPTY" else ("glyph-ids-without-unicode-map" if ps["cid"] > 1000 else "none-scanned")

    # 4: OCR fallback
    want_ocr = opt.ocr == "force" or (opt.ocr == "auto" and g["quality"] in ("EMPTY", "C"))
    if want_ocr:
        if shutil.which("tesseract") is None:
            notes.append("OCR wanted but tesseract is not installed (brew install tesseract tesseract-lang)")
        else:
            tl = opt.lang or TESS_LANG.get(lang, "ara")
            ocr_text = run_ocr(pdf, tl, opt.dpi, opt.psm, opt.jobs)
            g2 = grade(ocr_text, pages, lang, 0)
            if RANK[g2["quality"]] > RANK[g["quality"]] or (g2["quality"] == g["quality"] and g2["coverage"] > g["coverage"]):
                text_layer_grade = g["quality"]
                text, g = ocr_text, g2
                engine = f"tesseract {tesseract_version()} (lang={tl}, {opt.dpi} dpi, psm {opt.psm}) on PyMuPDF renders"
                extraction = "ocr"
                notes = [f"MarkItDown's text-layer result graded {text_layer_grade}; OCR used instead",
                         "OCR text is machine-read: expect occasional wrong letters, especially in tables and diagrams"]
            else:
                notes.append(f"OCR tried (tesseract, {tl}) but did not beat the text layer — kept MarkItDown output")
    if g["quality"] == "EMPTY":
        notes.append("no usable text — needs OCR (run with --ocr force after installing tesseract) or a better scan")

    title = st.get("subjectAr") or st.get("subject") or subject
    title_en = st.get("subjectEn", "")
    md5 = hashlib.md5(open(pdf, "rb").read()).hexdigest()
    fm = ["---", f'title: "{title}"', f'titleEn: "{title_en}"', f"curriculum: {st.get('curriculum', '')}",
          f"grade: {st.get('grade', grade_dir)}", f"subject: {subject}", f"dbSlug: {st.get('dbSlug', '')}",
          f"lang: {lang}", f'edition: "{st.get("edition", "")}"', "source: textbook.pdf", f"sourceMd5: {md5}",
          f"sourcePages: {pages}", f'generator: "{engine}"', f"generatedOn: {datetime.date.today().isoformat()}",
          f"extraction: {extraction}", f"quality: {g['quality']}",
          f"coverage: {g['coverage']}  # extracted text per page vs ~1200 chars of prose",
          f"stats: {{arabicChars: {g['arabicChars']}, latinChars: {g['latinChars']}, unmappedLetters: {g['unmappedLetters']}, glyphTokensRemoved: {ps['cid']}, linesReordered: {ps['reordered']}}}",
          "notes:" if notes else "notes: []", *[f'  - "{n}"' for n in notes], "---", "", f"# {title}", ""]
    body = text if g["quality"] != "EMPTY" else "_(no extractable text — see front matter)_\n"
    out = os.path.join(sdir, "textbook.md")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write("\n".join(fm) + body)
    if opt.keep_raw:
        with open(os.path.join(sdir, "textbook.markitdown-raw.md"), "w", encoding="utf-8") as fh:
            fh.write(raw)
    return dict(subject=subject, quality=g["quality"], coverage=g["coverage"], engine=engine.split(" (")[0],
                extraction=extraction, bytes=os.path.getsize(out))


def tesseract_version() -> str:
    try:
        return subprocess.run(["tesseract", "--version"], capture_output=True, text=True).stdout.split()[1]
    except Exception:  # pragma: no cover
        return "?"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("dirs", nargs="+")
    ap.add_argument("--ocr", choices=["auto", "off", "force"], default="auto")
    ap.add_argument("--dpi", type=int, default=200)
    ap.add_argument("--psm", type=int, default=3)
    ap.add_argument("--jobs", type=int, default=6)
    ap.add_argument("--lang", help="tesseract language override (default from structure.json lang: ara/eng/fra)")
    ap.add_argument("--keep-raw", action="store_true", help="also keep MarkItDown's raw output next to the twin")
    ap.add_argument("--quiet", action="store_true")
    opt = ap.parse_args()
    for d in opt.dirs:
        if not os.path.isdir(d):
            continue
        r = process(d, opt)
        print(json.dumps(r, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
