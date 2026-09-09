#!/usr/bin/env python3
"""Grade a vision transcription by AGREEMENT, not by coverage.

Coverage counts characters and cannot tell clean text from confident nonsense —
that is how a 47%-coverage OCR twin was graded "A". This re-reads a random
sample of pages with a fresh transcriber and measures how much the two runs
agree. Disagreement localises exactly where the transcription is unreliable.

  md-agreement.py <book> --sample 12 [--seed 7]   # print pages to re-transcribe
  md-agreement.py <book> --score                  # compare pages-md vs pages-md-audit
"""
import argparse, difflib, json, random, re, sys, unicodedata
from pathlib import Path

DIACRITICS = re.compile(r'[ً-ْٰـ]')
NONWORD = re.compile(r'[^\w\s]', re.U)


def normalize(t: str) -> str:
    t = re.sub(r'!\[[^\]]*\]\([^)]*\)', ' ', t)      # image refs
    t = re.sub(r'^\s*[#>*\-|]+', ' ', t, flags=re.M)  # md furniture
    t = re.sub(r'<!--.*?-->', ' ', t, flags=re.S)
    t = unicodedata.normalize('NFKC', t)
    t = DIACRITICS.sub('', t)
    t = (t.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا')
           .replace('ى', 'ي').replace('ة', 'ه').replace('ؤ', 'و').replace('ئ', 'ي'))
    t = NONWORD.sub(' ', t)
    return ' '.join(t.split())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('book')
    ap.add_argument('--sample', type=int)
    ap.add_argument('--seed', type=int, default=7)
    ap.add_argument('--score', action='store_true')
    a = ap.parse_args()

    book = Path(a.book).resolve()
    md, audit = book / 'pages-md', book / 'pages-md-audit'

    if a.sample:
        nums = sorted(int(p.stem) for p in (book / 'pages').glob('*.webp'))
        random.seed(a.seed)
        pick = sorted(random.sample(nums, min(a.sample, len(nums))))
        print(' '.join(map(str, pick)))
        return

    if not a.score:
        sys.exit('pass --sample N or --score')
    if not audit.is_dir():
        sys.exit(f'no {audit} — run the audit transcription first')

    rows = []
    for f in sorted(audit.glob('*.md'), key=lambda p: int(p.stem)):
        n = int(f.stem)
        orig = md / f'{n}.md'
        if not orig.exists():
            rows.append((n, 0.0, 'ORIGINAL MISSING'))
            continue
        a_, b_ = normalize(orig.read_text(encoding='utf-8')), normalize(f.read_text(encoding='utf-8'))
        if not a_ and not b_:
            rows.append((n, 1.0, 'both blank'))
            continue
        r = difflib.SequenceMatcher(None, a_.split(), b_.split()).ratio()
        note = ''
        if r < 0.80:
            sm = difflib.SequenceMatcher(None, a_.split(), b_.split())
            diffs = [f'{" ".join(a_.split()[i1:i2])!r}≠{" ".join(b_.split()[j1:j2])!r}'
                     for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag != 'equal'][:2]
            note = ' | '.join(d[:90] for d in diffs)
        rows.append((n, r, note))

    mean = sum(r for _, r, _ in rows) / len(rows) if rows else 0.0
    print(f'{"page":>6}  {"agree":>6}  note')
    for n, r, note in rows:
        print(f'{n:>6}  {r:>6.1%}  {note}')
    weak = [n for n, r, _ in rows if r < 0.80]
    print(f'\nsampled={len(rows)}  mean agreement={mean:.1%}  below 80%: {weak or "none"}')
    print(json.dumps({'sampled': len(rows), 'meanAgreement': round(mean, 4),
                      'weakPages': weak}, ensure_ascii=False))


if __name__ == '__main__':
    main()
