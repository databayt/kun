#!/usr/bin/env python3
"""Check Markdown table column order against the printed page (RTL sources).

Under `dir="rtl"` Markdown column 1 renders at the RIGHT edge, so for an RTL
book the first Markdown column must be the RIGHTMOST printed column — otherwise
the rendered table is mirrored against the book.

Ground truth comes from tables-audit/<N>.right.json, produced by reading a CROP
of the page's right side (see tables-audit/_TASK.md). Cropping is deliberate:
asked to judge column direction on a full page, transcribers get it wrong — the
same confusion that causes the bug in the first place.

  md-table-direction.py <book>          # report
  md-table-direction.py <book> --fix    # reverse columns of MIRRORED tables only
"""
import argparse, difflib, json, re, sys, unicodedata
from pathlib import Path

DIA = re.compile(r'[ً-ْٰـ]')


def norm(s):
    s = re.sub(r'\$([^$]*)\$', r'\1', s or '')
    s = s.replace('\\times', 'x').replace('\\', '')
    s = unicodedata.normalize('NFKC', s)
    s = DIA.sub('', s)
    s = (s.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا')
          .replace('ى', 'ي').replace('ة', 'ه'))
    s = re.sub(r'[^\w\s]', ' ', s)
    return ' '.join(s.split()).lower()


def sim(a, b):
    a, b = norm(a), norm(b)
    if not a and not b: return 1.0
    if not a or not b:  return 0.0
    if a.startswith(b) or b.startswith(a): return 1.0
    return difflib.SequenceMatcher(None, a, b).ratio()


def md_tables(text):
    lines, out, i = text.splitlines(), [], 0
    while i < len(lines):
        if lines[i].strip().startswith('|'):
            j = i
            while j < len(lines) and lines[j].strip().startswith('|'):
                j += 1
            out.append((i, j, [[c.strip() for c in l.strip().strip('|').split('|')]
                               for l in lines[i:j]]))
            i = j
        else:
            i += 1
    return out


def is_sep(cells):
    return all(c and set(c.replace(' ', '')) <= set('-:') for c in cells)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('book'); ap.add_argument('--fix', action='store_true')
    ap.add_argument('--margin', type=float, default=0.15)
    a = ap.parse_args()
    book = Path(a.book).resolve()
    md_dir, audit = book / 'pages-md', book / 'tables-audit'

    res = {'ok': [], 'mirrored': [], 'unclear': []}
    fixed = 0
    for f in sorted(audit.glob('*.right.json'), key=lambda p: int(p.stem.split('.')[0])):
        n = int(f.stem.split('.')[0])
        try:
            spec = json.loads(f.read_text(encoding='utf-8'))
        except json.JSONDecodeError:
            res['unclear'].append((n, 'bad json')); continue
        printed = spec.get('tables', [])
        mdf = md_dir / f'{n}.md'
        if not mdf.exists() or not printed: continue
        text = mdf.read_text(encoding='utf-8')
        tables = [t for t in md_tables(text) if max((len(r) for r in t[2]), default=0) >= 2]
        if len(tables) != len(printed):
            res['unclear'].append((n, f'{len(tables)} md vs {len(printed)} printed')); continue

        lines = text.splitlines(); changed = False
        for (start, end, rows), pt in zip(tables, printed):
            data = [r for r in rows if not is_sep(r)]
            # a blank header row carries no signal — fall through to real content
            while data and not any(norm(c) for c in data[0]):
                data = data[1:]
            right = pt.get('rightmostFirstCell')
            left  = pt.get('nextToItsLeft')
            if not data or right is None:
                res['unclear'].append((n, 'no printed cell')); continue
            first = data[0]
            if len(first) < 2:
                res['unclear'].append((n, 'single column')); continue
            # md col 1 renders rightmost -> it should match the printed rightmost cell
            s_ok  = sim(first[0],  right)
            s_mir = sim(first[-1], right)
            if left:                       # corroborate with the neighbour
                s_ok  = (s_ok  + sim(first[1],  left)) / 2
                s_mir = (s_mir + sim(first[-2], left)) / 2
            # an exact match on one end decides it even when both ends look alike
            # (e.g. "القائمة (أ)" vs "القائمة (ب)" score ~0.89 against each other)
            decisive = (s_ok >= 0.999) != (s_mir >= 0.999)
            if not decisive and abs(s_ok - s_mir) < a.margin:
                res['unclear'].append((n, f'ambiguous ok={s_ok:.2f} mir={s_mir:.2f} right={right!r}'))
                continue
            if s_ok > s_mir:
                res['ok'].append((n, f'{s_ok:.2f}'))
            else:
                res['mirrored'].append((n, f'{s_mir:.2f}'))
                if a.fix:
                    for li in range(start, end):
                        cells = [c.strip() for c in lines[li].strip().strip('|').split('|')]
                        lines[li] = '| ' + ' | '.join(reversed(cells)) + ' |'
                    changed = True
        if a.fix and changed:
            mdf.write_text('\n'.join(lines) + '\n', encoding='utf-8'); fixed += 1

    for k in ('ok', 'mirrored', 'unclear'):
        print(f'{k.upper():>9}: {len(res[k]):>3}  pages {sorted({p for p,_ in res[k]})}')
    for n, why in res['unclear']:
        print(f'   unclear p{n}: {why}')
    if a.fix:
        print(f'\nrewrote {fixed} page files')


if __name__ == '__main__':
    main()
