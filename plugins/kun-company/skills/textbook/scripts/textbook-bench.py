#!/usr/bin/env python3
"""textbook-bench.py — the benchmark: a small, tough, versioned page corpus with objective assertions.

A fresh gold read by the same model is the same hand as the candidate, so gold TEXT is secondary here.
The primary scored items are per-page ASSERTIONS that a human (or a crop) can verify against the scan:
  mustContain / mustNotContain   raw substrings — printed typos the run must reproduce, captions,
                                 interpretive words it must not add (never hamza-folded)
  numerals / latin               tokens that must appear, as printed
  labels (+labelsMin)            order-insensitive diagram label set, token-level F1 vs the run
  tables[{rows, cols, rightmost}] count, dimensions, and the crop-verified rightmost printed column
  noTable                        a diagram page must not become a Markdown table
  figures / captions             figure count, printed captions present
  illegibleMin / illegibleMax    the never-guess discipline: marks where the scan is unreadable

  textbook-bench.py propose --manifest M --book-id ID --source DIR --pages 5,42,… [--classes-json F]
                            [--audit-dir pages-md-audit] [--pages-url URL]
  textbook-bench.py score   --manifest M --book-id ID --run DIR [--label L] [--model M] [--json] [--out F]
  textbook-bench.py freeze  --manifest M --book-id ID            # hash the gold + assertions
  textbook-bench.py persist --scores F (--result F | --run-result F --book-id ID) [--date D] [--invalid WHY]
  textbook-bench.py report  --scores F

propose derives candidate assertions from the reads already on disk (what two independent reads BOTH
contain is a safe assertion; what only one contains is listed under `disputed` for adjudication) and
copies the current page into gold/ with goldStatus "candidate". Gold becomes "adjudicated" only after
the adjudicate agent has resolved every dispute against the scan, and "human" when a person checked it.
score never reads anything but the run directory, the manifest and the gold directory.
"""
import argparse, datetime, hashlib, importlib.util, json, re, shutil, sys, unicodedata
from collections import Counter
from pathlib import Path


def _load(name):
    p = Path(__file__).with_name(name)
    spec = importlib.util.spec_from_file_location(name.replace('-', '_').replace('.py', ''), p)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m


STRUCT = _load('md-structure.py')
AGREE = _load('md-agreement.py')
NUMERAL, LATIN_WORD, IMG = AGREE.NUMERAL, AGREE.LATIN_WORD, AGREE.IMG


def ws(s: str) -> str:
    return ' '.join(unicodedata.normalize('NFC', s).split())


def sha(paths, extra: str = '') -> str:
    h = hashlib.sha1()
    for p in sorted(paths):
        h.update(Path(p).name.encode()); h.update(Path(p).read_bytes())
    h.update(extra.encode('utf-8'))
    return 'sha1:' + h.hexdigest()[:12]


def load_manifest(path: Path) -> dict:
    if path.exists():
        return json.loads(path.read_text(encoding='utf-8'))
    return {'$schema': 'kun-textbook-bench-v1', 'updated': '', 'classes': {}, 'books': []}


def save_manifest(path: Path, m: dict, date: str):
    m['updated'] = date
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(m, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')


def book_entry(m: dict, book_id: str, create=False):
    for b in m['books']:
        if b['id'] == book_id:
            return b
    if not create:
        sys.exit(f'book {book_id} not in manifest')
    b = {'id': book_id, 'source': '', 'pagesUrl': '', 'lang': 'ar', 'pdfMd5': '', 'renderWidth': 1000,
         'contract': 'pages-md/_CONTRACT.md', 'gold': f'{book_id}/gold', 'goldHash': '', 'cases': []}
    m['books'].append(b)
    return b


# ── propose ──────────────────────────────────────────────────────────────────
def propose(a):
    mpath = Path(a.manifest).resolve()
    m = load_manifest(mpath)
    src = Path(a.source).resolve()
    b = book_entry(m, a.book_id, create=True)
    b['source'] = str(src)
    if a.pages_url:
        b['pagesUrl'] = a.pages_url
    struct = json.loads((src / 'structure.json').read_text(encoding='utf-8')) if (src / 'structure.json').exists() else {}
    b['lang'] = struct.get('lang', b.get('lang', 'ar'))
    pdf = src / 'textbook.pdf'
    if pdf.exists():
        b['pdfMd5'] = hashlib.md5(pdf.read_bytes()).hexdigest()
    classes = json.loads(Path(a.classes_json).read_text(encoding='utf-8')) if a.classes_json else {}
    gold_dir = mpath.parent / b['gold']
    gold_dir.mkdir(parents=True, exist_ok=True)
    by_page = {c['page']: c for c in b['cases']}
    for n in [int(x) for x in a.pages.split(',') if x.strip()]:
        run = src / 'pages-md' / f'{n}.md'
        if not run.exists():
            print(f'page {n}: no pages-md/{n}.md — skipped', file=sys.stderr); continue
        ta = run.read_text(encoding='utf-8')
        audit = src / a.audit_dir / f'{n}.md'
        tb = audit.read_text(encoding='utf-8') if audit.exists() else None
        sa = STRUCT.signature(ta)
        plain_a = IMG.sub(' ', ta)
        num_a = set(NUMERAL.findall(plain_a)); lat_a = set(w.lower() for w in LATIN_WORD.findall(plain_a) if len(w) >= 3)
        lab_a = [ws(x) for x in sa['labels']]
        disputed = {}
        if tb is not None:
            sb = STRUCT.signature(tb)
            plain_b = IMG.sub(' ', tb)
            num_b = set(NUMERAL.findall(plain_b)); lat_b = set(w.lower() for w in LATIN_WORD.findall(plain_b) if len(w) >= 3)
            nb = {STRUCT.norm(x) for x in sb['labels']}
            disputed = {'numerals': sorted(num_a ^ num_b), 'latin': sorted(lat_a ^ lat_b),
                        'labelsOnlyInA': [x for x in lab_a if STRUCT.norm(x) not in nb],
                        'labelsOnlyInB': [ws(x) for x in sb['labels'] if STRUCT.norm(x) not in {STRUCT.norm(y) for y in lab_a}],
                        'tables': [len(sa['tables']), len(sb['tables'])], 'figures': [len(sa['figures']), len(sb['figures'])]}
            num_a &= num_b; lat_a &= lat_b
            lab_a = [x for x in lab_a if STRUCT.norm(x) in nb]
        tables = []
        right = src / 'tables-audit' / f'{n}.right.json'
        rj = json.loads(right.read_text(encoding='utf-8')).get('tables', []) if right.exists() else []
        for i, t in enumerate(sa['tables']):
            spec = {'rows': t['rows'], 'cols': t['cols']}
            if i < len(rj) and rj[i].get('rightmostFirstCell'):
                spec['rightmost'] = rj[i]['rightmostFirstCell']
            tables.append(spec)
        case = by_page.get(n) or {'page': n, 'classes': [], 'why': '', 'goldStatus': 'candidate', 'assert': {}}
        case['classes'] = classes.get(str(n), {}).get('classes', case.get('classes', []))
        case['why'] = classes.get(str(n), {}).get('why', case.get('why', ''))
        asr = case['assert']
        asr.setdefault('mustContain', [])
        for c in sa['captions']:
            if c not in asr['mustContain']:
                asr['mustContain'].append(c)
        asr.setdefault('mustNotContain', [])
        asr['numerals'] = sorted(num_a)
        asr['latin'] = sorted(lat_a)
        asr['labels'] = lab_a
        asr.setdefault('labelsMin', 0.8)
        asr['tables'] = tables
        asr['figures'] = len(sa['figures'])
        asr.setdefault('illegibleMin', 0)
        asr['illegibleMax'] = max(sa['illegible'], asr.get('illegibleMax', 0))
        if disputed and any(disputed.get(k) for k in ('numerals', 'latin', 'labelsOnlyInA', 'labelsOnlyInB')) \
                or (disputed and (disputed['tables'][0] != disputed['tables'][1] or disputed['figures'][0] != disputed['figures'][1])):
            case['disputed'] = disputed
        elif 'disputed' in case:
            del case['disputed']
        if n not in by_page:
            b['cases'].append(case); by_page[n] = case
        gold = gold_dir / f'{n}.md'
        if not gold.exists() or a.overwrite_gold:
            shutil.copy(run, gold)
    b['cases'].sort(key=lambda c: c['page'])
    b['renderWidth'] = a.render_width
    save_manifest(mpath, m, a.date)
    print(json.dumps({'book': a.book_id, 'cases': len(b['cases']), 'disputed': [c['page'] for c in b['cases'] if c.get('disputed')],
                      'gold': str(gold_dir)}, ensure_ascii=False))


# ── score ────────────────────────────────────────────────────────────────────
def eval_case(case: dict, text: str, gold_text: str):
    asr = case.get('assert', {})
    sig = STRUCT.signature(text)
    plain = IMG.sub(' ', text)
    raw = ws(text)
    nums = set(NUMERAL.findall(plain)); lats = set(w.lower() for w in LATIN_WORD.findall(plain))
    checks = []
    add = lambda kind, name, ok, detail='': checks.append({'kind': kind, 'name': name, 'pass': bool(ok), 'detail': detail})
    for s in asr.get('mustContain', []):
        add('mustContain', s, ws(s) in raw)
    for s in asr.get('mustNotContain', []):
        add('mustNotContain', s, ws(s) not in raw)
    for t in asr.get('numerals', []):
        add('numerals', t, t in nums)
    for t in asr.get('latin', []):
        add('latin', t, t.lower() in lats)
    if asr.get('labels'):
        f = STRUCT.label_f1(asr['labels'], sig['labels'])
        add('labels', f'label set F1 ≥ {asr.get("labelsMin", 0.8)}', (f or 0) >= asr.get('labelsMin', 0.8), f'f1={round(f or 0, 3)} run={len(sig["labels"])} gold={len(asr["labels"])}')
    if asr.get('noTable'):
        add('noTable', 'no markdown table', not sig['tables'], f'tables={len(sig["tables"])}')
    if 'tables' in asr and not asr.get('noTable'):
        exp = asr['tables']
        add('tables', f'{len(exp)} table(s)', len(sig['tables']) == len(exp), f'run={len(sig["tables"])}')
        for i, t in enumerate(exp):
            if i >= len(sig['tables']):
                break
            got = sig['tables'][i]
            add('tables', f'table{i} cols={t["cols"]}', got['cols'] == t['cols'], f'run={got["cols"]}')
            add('tables', f'table{i} rows≈{t["rows"]}', abs(got['rows'] - t['rows']) <= 1, f'run={got["rows"]}')
            if t.get('rightmost'):
                first = got['first'][0] if got['first'] else ''
                ok = STRUCT.norm(first).startswith(STRUCT.norm(t['rightmost'])[:12]) or STRUCT.norm(t['rightmost']).startswith(STRUCT.norm(first)[:12]) if STRUCT.norm(first) else False
                add('direction', f'table{i} rightmost="{t["rightmost"][:20]}"', ok, f'run col1="{first[:30]}"')
    if 'figures' in asr:
        add('figures', f'{asr["figures"]} figure(s)', len(sig['figures']) == asr['figures'], f'run={len(sig["figures"])}')
    for c in asr.get('captions', []):
        add('captions', c, ws(c) in raw)
    if 'illegibleMax' in asr:
        add('illegible', f'illegible ≤ {asr["illegibleMax"]}', sig['illegible'] <= asr['illegibleMax'], f'run={sig["illegible"]}')
    if asr.get('illegibleMin', 0) > 0:
        add('illegible', f'illegible ≥ {asr["illegibleMin"]} (never guess)', sig['illegible'] >= asr['illegibleMin'], f'run={sig["illegible"]}')
    text_metrics = AGREE.page_metrics(text, gold_text) if gold_text is not None else None
    return checks, text_metrics


def score(a):
    mpath = Path(a.manifest).resolve()
    m = load_manifest(mpath)
    b = book_entry(m, a.book_id)
    run = Path(a.run).resolve()
    gold_dir = mpath.parent / b['gold']
    contract = Path(b['source']) / b.get('contract', 'pages-md/_CONTRACT.md')
    if a.contract:
        contract = Path(a.contract)
    contract_hash = sha([contract]) if contract.exists() else ''
    gold_hash = compute_gold_hash(b, gold_dir)
    pages, kinds, classes = [], {}, {}
    missing = []
    for c in b['cases']:
        n = c['page']
        f = run / f'{n}.md'
        if not f.exists():
            missing.append(n); continue
        text = f.read_text(encoding='utf-8')
        g = gold_dir / f'{n}.md'
        gold_text = g.read_text(encoding='utf-8') if g.exists() else None
        checks, tm = eval_case(c, text, gold_text)
        passed = sum(1 for k in checks if k['pass'])
        row = {'page': n, 'classes': c.get('classes', []), 'goldStatus': c.get('goldStatus', 'candidate'),
               'assertPass': passed, 'assertTotal': len(checks), 'failed': [k for k in checks if not k['pass']],
               'text': {k: tm[k] for k in ('seq', 'bow', 'num', 'lat', 'labels', 'struct', 'primary')} if tm else None}
        pages.append(row)
        for k in checks:
            d = kinds.setdefault(k['kind'], {'pass': 0, 'total': 0}); d['total'] += 1; d['pass'] += k['pass']
        for cl in c.get('classes', []):
            d = classes.setdefault(cl, {'pass': 0, 'total': 0, 'pages': 0}); d['total'] += len(checks); d['pass'] += passed; d['pages'] += 1
    tot = sum(r['assertTotal'] for r in pages); ok = sum(r['assertPass'] for r in pages)
    text_rows = [r['text'] for r in pages if r['text']]
    mean = lambda k: round(sum(t[k] for t in text_rows if t[k] is not None) / max(1, sum(1 for t in text_rows if t[k] is not None)), 4) if text_rows else None
    res = {'book': a.book_id, 'label': a.label, 'model': a.model, 'run': str(run), 'cases': len(b['cases']), 'scored': len(pages),
           'missing': missing, 'assertPass': ok, 'assertTotal': tot, 'assertRate': round(ok / tot, 4) if tot else None,
           'perKind': {k: {**v, 'rate': round(v['pass'] / v['total'], 4)} for k, v in sorted(kinds.items())},
           'perClass': {k: {**v, 'rate': round(v['pass'] / v['total'], 4) if v['total'] else None} for k, v in sorted(classes.items())},
           'textVsGold': {'seq': mean('seq'), 'bow': mean('bow'), 'num': mean('num'), 'lat': mean('lat'), 'struct': mean('struct')} if text_rows else None,
           'goldHash': gold_hash, 'goldHashDeclared': b.get('goldHash', ''), 'comparable': gold_hash == b.get('goldHash', '') and b.get('goldHash', '') != '',
           'contractHash': contract_hash, 'renderWidth': b.get('renderWidth', 1000),
           'goldStatus': dict(Counter(c.get('goldStatus', 'candidate') for c in b['cases'])),
           'degraded': bool(missing), 'pages': pages}
    if a.out:
        Path(a.out).write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding='utf-8')
    if a.json:
        print(json.dumps(res, ensure_ascii=False)); return
    print(f"{a.book_id} · run {run.name} · {res['scored']}/{res['cases']} pages · assertions {ok}/{tot} = {res['assertRate']:.1%}"
          f" · comparable={res['comparable']} · gold {res['goldStatus']}")
    for k, v in res['perKind'].items():
        print(f"  {k:>14}: {v['pass']:>3}/{v['total']:<3} {v['rate']:.0%}")
    print('  per class: ' + ', '.join(f"{k} {v['rate']:.0%} ({v['pages']}p)" for k, v in res['perClass'].items()))
    if res['textVsGold']:
        print('  text vs gold: ' + ', '.join(f'{k}={v}' for k, v in res['textVsGold'].items()))
    for r in pages:
        if r['failed']:
            print(f"  p{r['page']:<4} {r['assertPass']}/{r['assertTotal']}  " + ' | '.join(f"{f['kind']}:{f['name'][:28]}{(' ' + f['detail']) if f['detail'] else ''}" for f in r['failed'][:4]))
    if missing:
        print(f'  MISSING in run: {missing} — DEGRADED')


def compute_gold_hash(b: dict, gold_dir: Path) -> str:
    files = [gold_dir / f"{c['page']}.md" for c in b['cases'] if (gold_dir / f"{c['page']}.md").exists()]
    return sha(files, json.dumps([c.get('assert', {}) for c in b['cases']], ensure_ascii=False, sort_keys=True))


def freeze(a):
    mpath = Path(a.manifest).resolve(); m = load_manifest(mpath); b = book_entry(m, a.book_id)
    b['goldHash'] = compute_gold_hash(b, mpath.parent / b['gold'])
    save_manifest(mpath, m, a.date)
    print(json.dumps({'book': a.book_id, 'goldHash': b['goldHash'], 'cases': len(b['cases'])}))


# ── persist / report ─────────────────────────────────────────────────────────
def load_scores(p: Path) -> dict:
    if p.exists():
        return json.loads(p.read_text(encoding='utf-8'))
    return {'$schema': 'kun-textbook-scores-v1',
            '$comment': 'MEASURED state of the textbook pipeline — written only by textbook-bench.py persist (the workflows\' Persist phase). Declared policy lives in engine.json → textbook; a score has no declared counterpart, so health checks only that this file is current.',
            'last_updated': '', 'books': {}, 'benchmark': {'current': None, 'history': []}}


def persist(a):
    sp = Path(a.scores).resolve(); s = load_scores(sp)
    if a.result:
        r = json.loads(Path(a.result).read_text(encoding='utf-8'))
        entry = {'date': a.date, 'label': r.get('label'), 'book': r['book'], 'model': r.get('model'), 'contractHash': r.get('contractHash'),
                 'goldHash': r.get('goldHash'), 'comparable': r.get('comparable'), 'assertRate': r.get('assertRate'),
                 'assertPass': r.get('assertPass'), 'assertTotal': r.get('assertTotal'), 'perKind': {k: v['rate'] for k, v in r.get('perKind', {}).items()},
                 'perClass': {k: v['rate'] for k, v in r.get('perClass', {}).items()}, 'textVsGold': r.get('textVsGold'),
                 'goldStatus': r.get('goldStatus'), 'degraded': r.get('degraded', False)}
        # A delta is a claim that two runs measured the same thing: same book, same frozen gold,
        # same contract, both clean. Anything else is two numbers, not a trend.
        prev = [h for h in s['benchmark']['history'] if h.get('book') == r['book'] and h.get('comparable') and not h.get('invalid')
                and h.get('goldHash') == entry.get('goldHash') and h.get('contractHash') == entry.get('contractHash')]
        entry['delta'] = round(entry['assertRate'] - prev[-1]['assertRate'], 4) if prev and entry['assertRate'] is not None and entry.get('comparable') else None
        entry['deltaVs'] = prev[-1].get('label') if prev and entry['delta'] is not None else None
        if a.invalid:
            entry['invalid'] = True; entry['reason'] = a.invalid
        s['benchmark']['history'].append(entry)
        if not a.invalid:
            s['benchmark']['current'] = entry
    if a.run_result:
        r = json.loads(Path(a.run_result).read_text(encoding='utf-8'))
        book = s['books'].setdefault(a.book_id, {'current': None, 'history': []})
        r = {'date': a.date, **r}
        if a.invalid:
            r['invalid'] = True; r['reason'] = a.invalid
        book['history'].append(r)
        if not a.invalid:
            book['current'] = r
    s['last_updated'] = a.date
    sp.parent.mkdir(parents=True, exist_ok=True)
    sp.write_text(json.dumps(s, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(json.dumps({'scores': str(sp), 'benchmarkRuns': len(s['benchmark']['history']), 'books': list(s['books'])}))


def report(a):
    s = load_scores(Path(a.scores).resolve())
    print(f"textbook scores · updated {s.get('last_updated')}")
    for bid, b in s['books'].items():
        c = b.get('current') or {}
        print(f"  {bid}: agreement {c.get('agreement')} (n={c.get('agreementN')}) risk {c.get('riskAgreement')} classes {c.get('classes')} repaired {c.get('repaired')} · {len(b['history'])} runs")
    for h in s['benchmark']['history']:
        flag = ' INVALID' if h.get('invalid') else ('' if h.get('comparable') else ' (not comparable)')
        print(f"  bench {h['date']} {h.get('label')} {h.get('book')} model={h.get('model')} assert={h.get('assertRate')} Δ={h.get('delta')}{flag}")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    today = datetime.date.today().isoformat()
    p = sub.add_parser('propose'); p.add_argument('--manifest', required=True); p.add_argument('--book-id', required=True)
    p.add_argument('--source', required=True); p.add_argument('--pages', required=True); p.add_argument('--classes-json')
    p.add_argument('--audit-dir', default='pages-md-audit'); p.add_argument('--pages-url', default='')
    p.add_argument('--render-width', type=int, default=1000); p.add_argument('--overwrite-gold', action='store_true'); p.add_argument('--date', default=today)
    p = sub.add_parser('score'); p.add_argument('--manifest', required=True); p.add_argument('--book-id', required=True); p.add_argument('--run', required=True)
    p.add_argument('--label', default=''); p.add_argument('--model', default=''); p.add_argument('--contract'); p.add_argument('--json', action='store_true'); p.add_argument('--out')
    p = sub.add_parser('freeze'); p.add_argument('--manifest', required=True); p.add_argument('--book-id', required=True); p.add_argument('--date', default=today)
    p = sub.add_parser('persist'); p.add_argument('--scores', required=True); p.add_argument('--result'); p.add_argument('--run-result'); p.add_argument('--book-id')
    p.add_argument('--date', default=today); p.add_argument('--invalid')
    p = sub.add_parser('report'); p.add_argument('--scores', required=True)
    a = ap.parse_args()
    {'propose': propose, 'score': score, 'freeze': freeze, 'persist': persist, 'report': report}[a.cmd](a)


if __name__ == '__main__':
    main()
