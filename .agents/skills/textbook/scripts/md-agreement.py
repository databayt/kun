#!/usr/bin/env python3
"""md-agreement.py — grade a transcription by AGREEMENT between independent reads, on several axes.

Coverage counts characters and cannot tell clean text from confident nonsense — that is how a
47 %-coverage OCR twin was graded "A". This re-reads a sample of pages with a fresh transcriber and
measures how much the two reads agree. One number is not enough, though: on the first vision book every
sub-90 % page was diagram-LABEL ORDERING, which is noise, while a single dropped word on a prose page is
a real omission. So each page is scored on six axes and assigned a failure CLASS, and the classes — not
the mean — decide what the repair loop does next.

  seq     word-sequence agreement (difflib) — the legacy headline number, kept byte-identical
  bow     bag-of-words F1 — order-insensitive text agreement
  num     numeral-token F1 (Arabic-Indic and Latin digits, as printed)
  lat     Latin-token F1 (binomials, symbols, English glosses)
  labels  diagram-label set F1 (bullet items on figure pages)
  struct  structure-signature agreement (tables, dims, figures, headings, captions — md-structure.py)

  md-agreement.py <book> --sample 12 [--seed 7] [--risk-json lint.json] [--risk-cap 12] [--json]
  md-agreement.py <book> --score [--run-dir pages-md] [--audit-dir pages-md-audit] [--pages 5,42]
                         [--json] [--queue-out queue.json]

Classes (primary, by priority): structure > omission > numeric > latin > illegible > ordering > wording > clean.
Only `structure`, `omission`, `numeric`, `latin`, `illegible` and `wording` pages enter the repair queue;
`ordering` is reported but not repaired unless the contract defines a label order.
"""
import argparse, difflib, importlib.util, json, random, re, sys, unicodedata
from collections import Counter
from pathlib import Path


def _load(name):
    p = Path(__file__).with_name(name)
    spec = importlib.util.spec_from_file_location(name.replace('-', '_').replace('.py', ''), p)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m


STRUCT = _load('md-structure.py')

DIACRITICS = re.compile(r'[ً-ْٰـ]')
NONWORD = re.compile(r'[^\w\s]', re.U)
IMG = re.compile(r'!\[[^\]]*\]\([^)]*\)')
NUMERAL = re.compile(r'[0-9٠-٩]+(?:[.,][0-9٠-٩]+)?')
LATIN_WORD = re.compile(r'[A-Za-z][A-Za-z\-]{1,}')
ILLEGIBLE = STRUCT.ILLEGIBLE


def normalize(t: str) -> str:
    """The legacy normaliser — unchanged so `seq` stays comparable with earlier grades."""
    t = IMG.sub(' ', t)
    t = re.sub(r'^\s*[#>*\-|]+', ' ', t, flags=re.M)
    t = re.sub(r'<!--.*?-->', ' ', t, flags=re.S)
    t = unicodedata.normalize('NFKC', t)
    t = DIACRITICS.sub('', t)
    t = (t.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا')
           .replace('ى', 'ي').replace('ة', 'ه').replace('ؤ', 'و').replace('ئ', 'ي'))
    t = NONWORD.sub(' ', t)
    return ' '.join(t.split())


def f1(a: Counter, b: Counter) -> float:
    if not a and not b:
        return 1.0
    inter = sum((a & b).values())
    return round(2 * inter / (sum(a.values()) + sum(b.values())), 4) if (a or b) else 1.0


def spans(aw, bw, min_words=6):
    """Contiguous runs present in one read and absent from the other — omission/insertion candidates."""
    out = []
    sm = difflib.SequenceMatcher(None, aw, bw, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            continue
        na, nb = i2 - i1, j2 - j1
        if tag in ('delete', 'insert') and max(na, nb) >= min_words:
            out.append({'op': tag, 'words': max(na, nb), 'a': ' '.join(aw[i1:i2])[:120], 'b': ' '.join(bw[j1:j2])[:120]})
        elif tag == 'replace' and abs(na - nb) >= min_words:
            out.append({'op': 'replace', 'words': abs(na - nb), 'a': ' '.join(aw[i1:i2])[:120], 'b': ' '.join(bw[j1:j2])[:120]})
    return out


def page_metrics(a_text: str, b_text: str) -> dict:
    an, bn = normalize(a_text), normalize(b_text)
    aw, bw = an.split(), bn.split()
    if not aw and not bw:
        seq = bow = 1.0
    else:
        seq = round(difflib.SequenceMatcher(None, aw, bw).ratio(), 4)
        bow = f1(Counter(aw), Counter(bw))
    a_plain, b_plain = IMG.sub(' ', a_text), IMG.sub(' ', b_text)
    num = f1(Counter(NUMERAL.findall(a_plain)), Counter(NUMERAL.findall(b_plain)))
    lat = f1(Counter(w.lower() for w in LATIN_WORD.findall(a_plain)), Counter(w.lower() for w in LATIN_WORD.findall(b_plain)))
    sa, sb = STRUCT.signature(a_text), STRUCT.signature(b_text)
    la, lb = Counter(STRUCT.norm(x) for x in sa['labels']), Counter(STRUCT.norm(x) for x in sb['labels'])
    labels = f1(la, lb) if (la or lb) else None
    st = STRUCT.compare(sa, sb)
    n_num = max(len(NUMERAL.findall(a_plain)), len(NUMERAL.findall(b_plain)))
    n_lat = max(len(LATIN_WORD.findall(a_plain)), len(LATIN_WORD.findall(b_plain)))
    sp = spans(aw, bw)
    illeg_a, illeg_b = len(ILLEGIBLE.findall(a_text)), len(ILLEGIBLE.findall(b_text))

    classes = []
    if st['mismatches']:
        classes.append('structure')
    if sp:
        classes.append('omission')
    if n_num >= 3 and num < 0.95:
        classes.append('numeric')
    if n_lat >= 3 and lat < 0.90:
        classes.append('latin')
    if (illeg_a > 0) != (illeg_b > 0):
        classes.append('illegible')
    if bow >= 0.95 and bow - seq >= 0.05:
        classes.append('ordering')
    if seq < 0.97 and not classes:
        classes.append('wording')
    primary = classes[0] if classes else 'clean'
    return {'seq': seq, 'bow': bow, 'num': num, 'lat': lat, 'labels': labels, 'struct': st['score'],
            'structMismatches': st['mismatches'], 'illegible': [illeg_a, illeg_b], 'spans': sp[:4],
            'classes': classes, 'primary': primary,
            'queue': primary in ('structure', 'omission', 'numeric', 'latin', 'illegible', 'wording')}


def score(book: Path, run_dir: str, audit_dir: str, pages=None) -> dict:
    run, audit = book / run_dir, book / audit_dir
    if not audit.is_dir():
        sys.exit(f'no {audit} — run the audit transcription first')
    rows = []
    for f in sorted((p for p in audit.glob('*.md') if p.stem.isdigit()), key=lambda p: int(p.stem)):
        n = int(f.stem)
        if pages and n not in pages:
            continue
        orig = run / f'{n}.md'
        if not orig.exists():
            rows.append({'page': n, 'seq': 0.0, 'bow': 0.0, 'primary': 'missing', 'classes': ['missing'], 'queue': True,
                         'note': 'ORIGINAL MISSING'})
            continue
        m = page_metrics(orig.read_text(encoding='utf-8'), f.read_text(encoding='utf-8'))
        m['page'] = n
        rows.append(m)
    if not rows:
        return {'sampled': 0, 'meanAgreement': None, 'pages': []}

    def mean(k):
        vals = [r[k] for r in rows if r.get(k) is not None]
        return round(sum(vals) / len(vals), 4) if vals else None

    hist = Counter(r['primary'] for r in rows)
    return {'sampled': len(rows), 'meanAgreement': mean('seq'), 'meanBow': mean('bow'), 'meanNum': mean('num'),
            'meanLat': mean('lat'), 'meanLabels': mean('labels'), 'meanStruct': mean('struct'),
            'classes': dict(hist), 'queue': [r['page'] for r in rows if r['queue']],
            'weakPages': [r['page'] for r in rows if r['seq'] < 0.80], 'pages': rows}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('book')
    ap.add_argument('--sample', type=int)
    ap.add_argument('--seed', type=int, default=7)
    ap.add_argument('--risk-json', help='md-structure.py lint --json output; adds suspect/illegible/table pages')
    ap.add_argument('--risk-cap', type=int, default=12)
    ap.add_argument('--score', action='store_true')
    ap.add_argument('--run-dir', default='pages-md')
    ap.add_argument('--audit-dir', default='pages-md-audit')
    ap.add_argument('--pages', help='comma list — score only these pages')
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--queue-out', help='write the repair queue (page → classes) to this JSON file')
    a = ap.parse_args()
    book = Path(a.book).resolve()

    if a.sample:
        nums = sorted(int(p.stem) for p in (book / 'pages').glob('*.webp'))
        random.seed(a.seed)
        pick = sorted(random.sample(nums, min(a.sample, len(nums))))
        risk = []
        if a.risk_json:
            lint = json.loads(Path(a.risk_json).read_text(encoding='utf-8'))
            ordered = list(dict.fromkeys(lint.get('suspectPages', []) + lint.get('illegiblePages', []) + lint.get('tablePages', [])))
            risk = sorted([p for p in ordered if p not in pick][:a.risk_cap])
        if a.json:
            print(json.dumps({'random': pick, 'risk': risk, 'all': sorted(set(pick) | set(risk)), 'seed': a.seed}))
        else:
            print(' '.join(map(str, pick)))
            if risk:
                print('risk: ' + ' '.join(map(str, risk)))
        return

    if not a.score:
        sys.exit('pass --sample N or --score')
    pages = [int(x) for x in a.pages.split(',') if x.strip()] if a.pages else None
    res = score(book, a.run_dir, a.audit_dir, pages)
    if a.queue_out:
        Path(a.queue_out).write_text(json.dumps([{'page': r['page'], 'classes': r['classes'], 'primary': r['primary'],
                                                  'structMismatches': r.get('structMismatches', []), 'spans': r.get('spans', []),
                                                  'illegible': r.get('illegible')} for r in res['pages'] if r['queue']],
                                                ensure_ascii=False, indent=1), encoding='utf-8')
    if a.json:
        print(json.dumps(res, ensure_ascii=False)); return
    print(f'{"page":>6} {"seq":>6} {"bow":>6} {"num":>6} {"lat":>6} {"lab":>6} {"str":>5}  class')
    for r in res['pages']:
        lab = f"{r['labels']:.2f}" if r.get('labels') is not None else '   -'
        print(f"{r['page']:>6} {r['seq']:>6.1%} {r.get('bow', 0):>6.1%} {r.get('num', 0):>6.2f} {r.get('lat', 0):>6.2f} {lab:>6} "
              f"{r.get('struct', 0):>5.2f}  {r['primary']}{' ' + ','.join(r['classes'][1:]) if len(r['classes']) > 1 else ''}")
    print(f"\nsampled={res['sampled']}  mean agreement={res['meanAgreement']:.1%}  bow={res['meanBow']:.1%}  "
          f"struct={res['meanStruct']:.2f}  classes={res['classes']}\nqueue={res['queue'] or 'empty'}  below 80%: {res['weakPages'] or 'none'}")


if __name__ == '__main__':
    main()
