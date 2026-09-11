#!/usr/bin/env python3
"""textbook-contract.py — write (or extend) a book's transcription contract from its own structure.

The contract is the single lever for systematic transcription quality: every transcriber and every
adjudicator reads pages-md/_CONTRACT.md before touching a page. This templates it from structure.json
(titles, language, chapter headings, page offset) plus the generic clauses that earned their place on
the first vision-transcribed book, and keeps a per-book "Observed in this book" section that the
adjudicate phase appends to with NAMED cases — on that book the abstract rule alone did not hold; the
named example did.

  textbook-contract.py <book> [--lang ar] [--furniture "running footer text"] [--force]
  textbook-contract.py <book> --observe "body reference (الصورة 51) whose caption reads (15) — transcribe 51"
  textbook-contract.py <book> --print

Nothing here is subject-specific: headings come from structure.json, the language decides direction,
the illegible marker and the digit rule, and the observations come from the book itself.
Exit 0; prints the contract path (or the contract with --print).
"""
import argparse, json, re, sys
from pathlib import Path

RTL_LANGS = {"ar", "fa", "ur", "he", "ps", "ku"}
MARK = {"ar": "[غير مقروء]", "fa": "[ناخوانا]", "ur": "[ناقابل مطالعہ]", "he": "[לא קריא]"}
BLANK = "<!-- blank -->"
OBS_BEGIN, OBS_END = "<!-- observed:begin -->", "<!-- observed:end -->"


def illegible_marker(lang: str) -> str:
    return MARK.get(lang, "[illegible]")


def load_structure(book: Path) -> dict:
    p = book / "structure.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


def existing_observations(path: Path) -> list:
    if not path.exists():
        return []
    m = re.search(re.escape(OBS_BEGIN) + r"(.*?)" + re.escape(OBS_END), path.read_text(encoding="utf-8"), re.S)
    if not m:
        return []
    return [l[2:].strip() for l in m.group(1).splitlines() if l.startswith("- ")]


def render(book: Path, struct: dict, lang: str, furniture: str, observations: list) -> str:
    rtl = lang in RTL_LANGS
    mark = illegible_marker(lang)
    title = struct.get("subjectAr") or struct.get("subject") or book.name
    title_en = struct.get("subjectEn", "")
    grade, curriculum = struct.get("grade", ""), struct.get("curriculum", "")
    offset = struct.get("pageOffset")
    chapters = [c.get("title", "") for c in struct.get("chapters", []) if c.get("title")]
    lessons = [l.get("title", "") for c in struct.get("chapters", []) for l in c.get("lessons", []) if l.get("title")]
    ident = f"{curriculum}/{grade}/{book.name}" if curriculum and grade else book.name

    out = []
    out.append(f"# Transcription contract — {ident}")
    out.append("")
    out.append("You transcribe scanned textbook pages into Markdown. One input image, one output file.")
    out.append("")
    out.append(f"Book: {title}" + (f" — {title_en}" if title_en else "") + (f" ({curriculum} curriculum, {grade})" if curriculum else "") + ".")
    out.append(f"Language: {lang}" + (" (RTL — right-to-left)" if rtl else " (LTR)") + ". Terms printed in another script stay inline, in place, as printed.")
    if isinstance(offset, int):
        out.append(f"Printed book page = PDF page number − {offset}.")
    out.append("")
    out.append("## For each page N you are assigned")
    out.append("")
    out.append("1. Read the image `pages/<N>.webp` (relative to the book directory). Read the image BEFORE anything else.")
    out.append("2. Write the transcription to the output file your caller names (normally `pages-md/<N>.md`).")
    out.append("")
    out.append("## The rules")
    out.append("")
    out.append("**Transcribe. Do not correct, normalize, modernize, translate or summarize.** Reproduce what is printed, "
               "including the book's own digits exactly as they appear" + (" (Arabic-Indic ٣٤، ١٠٠٠ stay Arabic-Indic; Latin digits stay Latin)" if lang == "ar" else "") +
               ". Do not fix the book's spelling or punctuation. Do not add explanation, notes or commentary of your own.")
    out.append("")
    out.append("**Do not repair the book.** Printed books contain real errors: wrong figure numbers, reversed dates, "
               "non-standard spellings, mismatched labels. Transcribe them as printed. Cross-referencing another page to "
               "\"establish\" the right value is out of scope and produces a file that disagrees with the scan. If you notice "
               "an apparent error, transcribe it as printed and say so in your final status line. Never silently fix it. "
               "The cases already observed in THIS book are listed at the end of this contract — every one of them was "
               "\"corrected\" by a transcriber once and had to be reverted.")
    out.append("")
    out.append(f"**Never guess.** If a word or span is genuinely illegible, write `{mark}` in its place. If a whole page is "
               f"unreadable, write `{mark}` and nothing else. Plausible-looking invented text is the single worst failure "
               "here: it is undetectable later. Marking uncertainty is always the correct choice and is never penalised. "
               "A later pass re-reads illegible spans from a higher-resolution crop; it can only do that if you marked them.")
    out.append("")
    if rtl:
        out.append("**Reading order.** Follow the logical reading order of the page: right to left, top to bottom. On a "
                   "two-column layout the right column is read fully before the left. Never interleave columns.")
    else:
        out.append("**Reading order.** Follow the logical reading order of the page: left to right, top to bottom. On a "
                   "two-column layout the left column is read fully before the right. Never interleave columns.")
    out.append("")
    out.append("**Headings.** " + (f"These are the book's {len(chapters)} chapter titles. When a line on the page is one of "
               "them, or clearly a chapter opener, mark it `## `:" if chapters else
               "Mark a chapter opener `## ` and a numbered section heading `### `. Do not invent a heading for a page that has none."))
    if chapters:
        out.append("")
        out.append(" · ".join(chapters))
        out.append("")
        out.append("Numbered section headings inside a chapter get `### `." +
                   (f" The {len(lessons)} lesson titles from the book's contents are ordinary `### ` candidates when printed as headings." if lessons else "") +
                   " Do not invent a heading for a page that has none, and do not promote a bold run-in label to a heading.")
    out.append("")
    out.append("**Tables** become real Markdown tables, with the columns in printed order" +
               (" (rightmost printed column = leftmost Markdown column, so the rendered RTL table matches the book)" if rtl else "") +
               ". Never flatten a table into prose. Numbers inside tables are the highest-value content — read them carefully. "
               "**A table is a ruled or shaded grid only.** A cross, a flow chart, a genetics diagram, a labelled drawing or any "
               "arrangement of labels joined by arrows is a FIGURE, not a table: transcribe its labels as a list (below), never "
               "as a Markdown table. Every table row must have the same number of cells.")
    out.append("")
    out.append("**Figures and diagrams.** Emit the image reference with the PRINTED caption as its alt text, then the caption "
               "as a bold line, then every label inside the figure as a bullet list, in reading order:")
    out.append("")
    out.append("```")
    out.append("![<printed caption>](pages/<N>.webp)")
    out.append("")
    out.append("**<printed caption>**")
    out.append("")
    out.append("- <label exactly as printed>")
    out.append("- <label exactly as printed>")
    out.append("```")
    out.append("")
    out.append("Labels are reproduced verbatim — the printed words only. Do not describe what a label points at, do not group "
               "labels under headings you composed, do not add words that are not printed. A printed arrow chain may be written "
               "on one bullet with `←` / `→` between its labels. When the print has NO caption, the alt text is the single word "
               "`شكل` (or `figure` for a non-Arabic book) and no bold caption line follows — never compose a description. Labels "
               "inside diagrams are real teaching content: a page that is nothing but a diagram still yields a full label list.")
    out.append("")
    out.append("**Terms in another script** stay inline exactly as printed, in place (a binomial, a chemical symbol, an English "
               "gloss after the term).")
    out.append("")
    out.append("**Notation** uses LaTeX where the print uses super/subscripts or symbols (`$I^A I^B$`, `$H_2O$`, `$x^2$`). "
               "Crosses, ratios and formulas keep their printed form (`AB x A`, `1 : 2 : 1`).")
    out.append("")
    out.append("**Page furniture is dropped.**" + (f" Do not transcribe the running footer/header (`{furniture}`), the page-number "
               "mark, or decorative rules." if furniture else " Do not transcribe running headers/footers, the page-number mark, or decorative rules."))
    out.append("")
    out.append("**Do not write a `<!-- page N -->` marker.** The assembler adds those.")
    out.append("")
    out.append(f"**Blank or purely decorative page**: write the single line `{BLANK}`.")
    out.append("")
    out.append("## Independence")
    out.append("")
    out.append("When your caller says the read is independent (an audit read, a benchmark run, or an adjudication), you must "
               "not open any earlier transcription of the page — not `pages-md/<N>.md`, not `pages-md-audit/`, not `gold/`, not "
               "`textbook.md`. Reading them turns a measurement into a copy. The image and this contract are your only inputs.")
    out.append("")
    out.append("## When you finish")
    out.append("")
    out.append("Reply with ONE line only: `done <first>-<last>, <count> files, illegible: <page list or \"none\">, "
               "printed-errors: <page: what, or \"none\">`. Do not paste any transcribed text back. It all lives in the files.")
    out.append("")
    out.append("## Observed in this book (do not repair)")
    out.append("")
    out.append("Each line names a real case a transcriber once \"fixed\". Transcribe these exactly as printed.")
    out.append("")
    out.append(OBS_BEGIN)
    for o in observations:
        out.append(f"- {o}")
    if not observations:
        out.append("- (none recorded yet — the adjudicate phase appends named cases here)")
    out.append(OBS_END)
    out.append("")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("book")
    ap.add_argument("--lang")
    ap.add_argument("--furniture", default="")
    ap.add_argument("--force", action="store_true", help="rewrite the contract (the observed section is preserved)")
    ap.add_argument("--observe", action="append", default=[], help="append a named case to the observed section")
    ap.add_argument("--out", default="pages-md/_CONTRACT.md")
    ap.add_argument("--print", action="store_true")
    a = ap.parse_args()

    book = Path(a.book).resolve()
    struct = load_structure(book)
    lang = a.lang or struct.get("lang") or "ar"
    out = book / a.out
    out.parent.mkdir(parents=True, exist_ok=True)

    observations = existing_observations(out)
    for o in a.observe:
        o = " ".join(o.split())
        if o and o not in observations:
            observations.append(o)
    observations = [o for o in observations if not o.startswith("(none recorded")]

    if out.exists() and not a.force and not a.observe and not a.print:
        print(str(out))
        return

    if out.exists() and a.observe and not a.force:
        # surgical update of the observed section only — the rest of the contract is someone's edited prose
        text = out.read_text(encoding="utf-8")
        block = OBS_BEGIN + "\n" + "\n".join(f"- {o}" for o in observations) + "\n" + OBS_END
        if OBS_BEGIN in text:
            text = re.sub(re.escape(OBS_BEGIN) + r".*?" + re.escape(OBS_END), lambda _: block, text, flags=re.S)
        else:
            text = text.rstrip("\n") + "\n\n## Observed in this book (do not repair)\n\n" + block + "\n"
        out.write_text(text, encoding="utf-8")
        print(str(out))
        return

    text = render(book, struct, lang, a.furniture, observations)
    if a.print:
        print(text)
        return
    out.write_text(text, encoding="utf-8")
    print(str(out))


if __name__ == "__main__":
    main()
