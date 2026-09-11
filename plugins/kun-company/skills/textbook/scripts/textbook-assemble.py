#!/usr/bin/env python3
"""Stitch per-page vision transcriptions into one graded textbook.md.

Reads <book>/pages-md/<N>.md for every page render in <book>/pages/,
emits <book>/textbook.md with provenance front matter and page markers.

Usage: textbook-assemble.py <book-dir> [--model NAME] [--out textbook.md]
"""
import argparse, hashlib, json, re, sys, datetime
from pathlib import Path

AR = re.compile(r'[؀-ۿݐ-ݿ]')
LATIN = re.compile(r'[A-Za-z]')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('book')
    ap.add_argument('--model', default='claude-opus-5')
    ap.add_argument('--out', default='textbook.md')
    ap.add_argument('--agreement', type=float, help='mean agreement from md-agreement.py --score')
    ap.add_argument('--agreement-n', type=int, default=0, help='pages sampled for that score')
    ap.add_argument('--note', action='append', default=[], help='extra front-matter note (repeatable)')
    a = ap.parse_args()

    book = Path(a.book).resolve()
    pages_dir, md_dir = book / 'pages', book / 'pages-md'
    if not pages_dir.is_dir():
        sys.exit(f'no pages/ in {book}')
    if not md_dir.is_dir():
        sys.exit(f'no pages-md/ in {book}')

    nums = sorted(int(p.stem) for p in pages_dir.glob('*.webp'))
    total = len(nums)

    struct = {}
    sp = book / 'structure.json'
    if sp.exists():
        struct = json.loads(sp.read_text(encoding='utf-8'))

    pdf = book / 'textbook.pdf'
    md5 = hashlib.md5(pdf.read_bytes()).hexdigest() if pdf.exists() else ''

    body, missing, blank = [], [], []
    ar = lat = illeg = figs = tbl = 0

    for n in nums:
        f = md_dir / f'{n}.md'
        if not f.exists():
            missing.append(n)
            body.append(f'<!-- page {n}: NOT TRANSCRIBED -->')
            continue
        txt = f.read_text(encoding='utf-8').strip()
        if not txt or txt == '<!-- blank -->':
            blank.append(n)
            body.append(f'<!-- page {n}: blank -->')
            continue
        ar += len(AR.findall(txt))
        lat += len(LATIN.findall(txt))
        illeg += txt.count('[غير مقروء]')
        figs += len(re.findall(r'^!\[', txt, re.M))
        tbl += len(re.findall(r'^\|.+\|$', txt, re.M))
        body.append(f'<!-- page {n} -->\n\n{txt}')

    done = total - len(missing)
    fm = {
        'title': struct.get('subjectAr', ''),
        'titleEn': struct.get('subjectEn', ''),
        'curriculum': struct.get('curriculum', ''),
        'grade': struct.get('grade', ''),
        'subject': struct.get('subject', ''),
        'dbSlug': struct.get('dbSlug', ''),
        'lang': struct.get('lang', 'ar'),
        'source': 'textbook.pdf',
        'sourceMd5': md5,
        'sourcePages': total,
        'extraction': 'vision',
        'generator': f'vision transcription ({a.model}) on 1000px page renders',
        'generatedOn': datetime.date.today().isoformat(),
    }
    if a.agreement is not None:
        # Quality is the AGREEMENT between two independent reads, never a
        # character count. A coverage-based grade called a 47%-complete OCR
        # twin "A"; that mistake is not repeatable here.
        fm['agreement'] = round(a.agreement, 4)
        fm['agreementSample'] = a.agreement_n
        fm['quality'] = ('A' if a.agreement >= 0.95 else
                         'B' if a.agreement >= 0.90 else
                         'C' if a.agreement >= 0.80 else 'D')
    lines = ['---']
    for k, v in fm.items():
        lines.append(f'{k}: {json.dumps(v, ensure_ascii=False) if isinstance(v, str) else v}')
    lines.append('stats: ' + json.dumps({
        'pagesTranscribed': done, 'pagesBlank': len(blank), 'pagesMissing': len(missing),
        'arabicChars': ar, 'latinChars': lat, 'illegibleMarks': illeg,
        'figures': figs, 'tableRows': tbl,
    }, ensure_ascii=False))
    lines.append('notes:')
    lines.append('  - "Transcribed from page images by a vision model, not OCR."')
    lines.append('  - "Figures reference pages/<N>.webp; diagram labels are transcribed as lists."')
    lines.append('  - "[غير مقروء] marks spans the transcriber could not read. Never a guess."')
    for n_ in a.note:
        lines.append(f'  - {json.dumps(n_, ensure_ascii=False)}')
    if missing:
        lines.append(f'  - "MISSING pages: {missing}"')
    lines.append('---')
    lines.append('')
    lines.append(f"# {fm['title']}")
    lines.append('')

    (book / a.out).write_text('\n'.join(lines) + '\n' + '\n\n'.join(body) + '\n', encoding='utf-8')

    print(json.dumps({
        'book': book.name, 'pages': total, 'transcribed': done, 'blank': len(blank),
        'missing': missing, 'arabicChars': ar, 'illegible': illeg,
        'figures': figs, 'tableRows': tbl,
        'arPerPage': round(ar / max(done - len(blank), 1)),
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()
