#!/usr/bin/env python3
"""md-structure.py — structure fidelity: parse page Markdown with the READER's grammar, then lint it.

The in-app reader (hogwarts textbook/parse.ts) recognises only `<!-- page N -->` markers, `#` headings,
`-`/`*`/`•` bullets, `1.`/`١.` numbered items, `|` table rows, `---` rules and blank-line paragraphs.
The regexes below are ported from it verbatim, so "table", "list" and "heading" here mean exactly what
a student sees. Figures (`![alt](path)`) are additionally recognised because they carry the diagram
labels this pipeline is measured on.

  md-structure.py signature <page.md>                 # one page's structure signature as JSON
  md-structure.py lint <book> [--json] [--grid]       # coverage, blank pages, table/figure/heading lint;
                                                      # --grid adds table-without-grid suspects (PIL)
  md-structure.py grid <book> --pages 42,150          # the ruled/shaded-grid detector alone

The grid detector is a deterministic heuristic (long dark runs = rules, light-grey bands = shading) that
flags a Markdown table on a page that shows no printed grid. It produces SUSPECTS for adjudication,
never verdicts: a cross diagram drawn inside a rounded box has two rules on each axis, a real table has
three or more, and a shaded-header table may have none — hence the thresholds below.
"""
import argparse, json, re, sys, unicodedata
from pathlib import Path

# ── ported from parse.ts ────────────────────────────────────────────────────
PAGE_MARKER = re.compile(r'^<!--\s*page\s+(\d+)\s*(?::\s*([^>]*?))?\s*-->\s*$', re.I)
HEADING = re.compile(r'^(#{1,4})\s+(.+?)\s*#*\s*$')
BULLET = re.compile(r'^\s*[-*•]\s+(.+)$')
NUMBERED = re.compile(r'^\s*(?:\d+|[٠-٩]+)[.)]\s+(.+)$')
TABLE_ROW = re.compile(r'^\s*\|.*\|\s*$')
TABLE_SEP = re.compile(r'^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$')
RULE = re.compile(r'^\s*(?:-{3,}|\*{3,}|_{3,})\s*$')
# ── ours ─────────────────────────────────────────────────────────────────────
FIGURE = re.compile(r'^\s*!\[([^\]]*)\]\(([^)]*)\)\s*$')
CAPTION_REF = re.compile(r'(?:الشكل|الصورة|الجدول|Figure|Fig\.|Table)\s*\(?\s*[0-9٠-٩]+\s*[أ-يa-z]?\s*\)?')
ILLEGIBLE = re.compile(r'\[(?:غير مقروء|illegible|ناخوانا|לא קריא|ناقابل مطالعہ)\]')
AR = re.compile(r'[\u0600-\u06FF]')
LATIN_WORD = re.compile(r'[A-Za-z][A-Za-z\-]{1,}')
NUMERAL = re.compile(r'[0-9٠-٩]+(?:[.,][0-9٠-٩]+)?')
DIACRITICS = re.compile(r'[ً-ْٰـ]')


def clean_inline(t: str) -> str:
    t = re.sub(r'\\([*_`\[\]#>\\])', r'\1', t)
    t = re.sub(r'\*\*(.+?)\*\*', r'\1', t)
    t = re.sub(r'__(.+?)__', r'\1', t)
    t = re.sub(r'(^|[^*\w])\*(?!\s)([^*]+?)\*(?!\w)', r'\1\2', t)
    return ' '.join(t.split())


def norm(t: str) -> str:
    t = unicodedata.normalize('NFKC', t)
    t = DIACRITICS.sub('', t)
    t = (t.replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا')
          .replace('ى', 'ي').replace('ة', 'ه').replace('ؤ', 'و').replace('ئ', 'ي'))
    t = re.sub(r'[^\w\s]', ' ', t)
    return ' '.join(t.split()).lower()


def parse_blocks(lines):
    """Reader-grammar block list for one page. Figures become their own block kind."""
    blocks, para = [], []

    def flush():
        if para:
            text = clean_inline(' '.join(para))
            if text:
                blocks.append({'kind': 'paragraph', 'text': text})
            para.clear()

    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            flush(); i += 1; continue
        if PAGE_MARKER.match(line):
            flush(); blocks.append({'kind': 'marker', 'text': line.strip()}); i += 1; continue
        m = FIGURE.match(line)
        if m:
            flush(); blocks.append({'kind': 'figure', 'alt': clean_inline(m.group(1)), 'src': m.group(2).strip()}); i += 1; continue
        if RULE.match(line):
            flush(); blocks.append({'kind': 'rule'}); i += 1; continue
        m = HEADING.match(line)
        if m:
            flush(); blocks.append({'kind': 'heading', 'level': min(len(m.group(1)), 4), 'text': clean_inline(m.group(2))}); i += 1; continue
        if TABLE_ROW.match(line):
            flush(); rows = []
            while i < len(lines) and TABLE_ROW.match(lines[i]):
                if not TABLE_SEP.match(lines[i]):
                    cells = [clean_inline(c) for c in lines[i].strip().strip('|').split('|')]
                    if any(cells):
                        rows.append(cells)
                i += 1
            if rows:
                blocks.append({'kind': 'table', 'rows': rows})
            continue
        if BULLET.match(line) or NUMBERED.match(line):
            flush()
            ordered = bool(NUMBERED.match(line)) and not BULLET.match(line)
            items = []
            while i < len(lines):
                mm = NUMBERED.match(lines[i]) if ordered else BULLET.match(lines[i])
                if not mm:
                    break
                it = clean_inline(mm.group(1))
                if it:
                    items.append(it)
                i += 1
            if items:
                blocks.append({'kind': 'list', 'ordered': ordered, 'items': items})
            continue
        para.append(line); i += 1
    flush()
    return blocks


def signature(text: str) -> dict:
    """What the page IS, structurally — the thing two independent reads must agree on."""
    blocks = parse_blocks(text.splitlines())
    blank = text.strip() == '<!-- blank -->'
    tables = [b for b in blocks if b['kind'] == 'table']
    figures = [b for b in blocks if b['kind'] == 'figure']
    lists = [b for b in blocks if b['kind'] == 'list']
    heads = [b for b in blocks if b['kind'] == 'heading']
    # labels: bullet items on a page that carries a figure — the diagram content
    labels = [it for b in lists if not b['ordered'] for it in b['items']] if figures else []
    return {
        'blank': blank,
        'blocks': len(blocks),
        'headings': [[b['level'], b['text']] for b in heads],
        'tables': [{'rows': len(t['rows']), 'cols': max(len(r) for r in t['rows']),
                    'ragged': len({len(r) for r in t['rows']}) > 1,
                    'first': t['rows'][0]} for t in tables],
        'figures': [{'alt': f['alt'], 'src': f['src']} for f in figures],
        'captions': sorted(set(m.group(0).strip() for m in CAPTION_REF.finditer(text))),
        'lists': [{'ordered': b['ordered'], 'items': len(b['items'])} for b in lists],
        'labels': labels,
        'paragraphs': sum(1 for b in blocks if b['kind'] == 'paragraph'),
        'markers': sum(1 for b in blocks if b['kind'] == 'marker'),
        'illegible': len(ILLEGIBLE.findall(text)),
        'latex': text.count('$') // 2,
        'arabicChars': len(AR.findall(text)),
        'latinTokens': sorted(set(w.lower() for w in LATIN_WORD.findall(re.sub(r'!\[[^\]]*\]\([^)]*\)', ' ', text)))),
        'numerals': sorted(set(NUMERAL.findall(re.sub(r'!\[[^\]]*\]\([^)]*\)', ' ', text)))),
    }


def compare(sa: dict, sb: dict) -> dict:
    """Structure agreement between two signatures: 1 − mismatches/checks, with the mismatch list."""
    checks, miss = 0, []

    def chk(name, x, y):
        nonlocal checks
        checks += 1
        if x != y:
            miss.append({'check': name, 'a': x, 'b': y})

    chk('blank', sa['blank'], sb['blank'])
    chk('tables', len(sa['tables']), len(sb['tables']))
    for i, (ta, tb) in enumerate(zip(sa['tables'], sb['tables'])):
        chk(f'table{i}.cols', ta['cols'], tb['cols'])
        chk(f'table{i}.rows', ta['rows'], tb['rows'])
    chk('figures', len(sa['figures']), len(sb['figures']))
    chk('headings', len(sa['headings']), len(sb['headings']))
    chk('captions', sorted(set(caption_key(c) for c in sa['captions'])), sorted(set(caption_key(c) for c in sb['captions'])))
    f1 = label_f1(sa['labels'], sb['labels'])
    if f1 is not None:
        checks += 1
        if f1 < 0.8:
            miss.append({'check': 'labels', 'a': len(sa['labels']), 'b': len(sb['labels']), 'f1': round(f1, 3)})
    return {'score': round(1 - len(miss) / checks, 4) if checks else 1.0, 'mismatches': miss, 'checks': checks}


def caption_key(c: str) -> str:
    """`الجدول (1)` and `الجدول(1)` are the same printed caption."""
    return re.sub(r'[\s()]+', '', unicodedata.normalize('NFKC', c))


def label_f1(la, lb):
    """Token-level F1 over the words of all labels — chunk-insensitive, so a nested list and a flat list
    of the same printed labels agree, while missing or invented label words still cost."""
    from collections import Counter
    ca = Counter(w for x in la for w in norm(x).split())
    cb = Counter(w for x in lb for w in norm(x).split())
    if not ca and not cb:
        return None
    inter = sum((ca & cb).values())
    return 2 * inter / (sum(ca.values()) + sum(cb.values()))


# ── grid detector (PIL only) ─────────────────────────────────────────────────
def grid_features(img_path: Path, width: int = 500) -> dict:
    from PIL import Image
    im = Image.open(img_path).convert('L')
    w, h = im.size
    s = width / w
    im = im.resize((width, max(1, int(h * s))))
    px = im.load(); W, H = im.size
    top, bottom = int(H * 0.05), int(H * 0.82)   # skip the running head and the footer rule

    def runs_h():
        n, prev = 0, False
        for y in range(top, bottom):
            best = run = 0
            for x in range(W):
                if px[x, y] < 140:
                    run += 1
                    if run > best: best = run
                else:
                    run = 0
            is_rule = best >= 0.30 * W
            if is_rule and not prev: n += 1
            prev = is_rule
        return n

    def runs_v():
        n, prev = 0, False
        span = bottom - top
        for x in range(int(W * 0.05), int(W * 0.95)):
            best = run = 0
            for y in range(top, bottom):
                if px[x, y] < 140:
                    run += 1
                    if run > best: best = run
                else:
                    run = 0
            is_rule = best >= 0.12 * span
            if is_rule and not prev: n += 1
            prev = is_rule
        return n

    def bands():
        # a shaded header keeps its ink; what marks it is a long CONTINUOUS non-white run whose
        # non-ink pixels are grey. Text rows break into short runs at every word gap; a shaded
        # band does not. Needs 4 consecutive rows so a rule's anti-aliased edge cannot count.
        n, run = 0, 0
        for y in range(top, bottom):
            vals = [px[x, y] for x in range(0, W, 2)]
            best = cur = 0; start = bstart = 0
            for i, v in enumerate(vals):
                if v <= 235:
                    if cur == 0: start = i
                    cur += 1
                    if cur > best: best, bstart = cur, start
                else:
                    cur = 0
            is_band = False
            if best >= 0.35 * len(vals):
                seg = vals[bstart:bstart + best]
                nonink = [v for v in seg if v >= 100]
                grey = sum(1 for v in nonink if 150 <= v <= 235)
                is_band = len(nonink) >= 0.5 * len(seg) and grey >= 0.7 * len(nonink)
            run = run + 1 if is_band else 0
            if run == 4: n += 1
        return n

    def grouped(count_fn):
        return count_fn()

    h, v, b = runs_h(), runs_v(), bands()
    # A box around a diagram contributes two rules per axis; a ruled table has many rows or three
    # verticals; a shaded table may have no rules at all. Thresholds set on sd/g12/biology pages
    # 42/137/7/168/211 (tables) vs 102/150/184/146 (boxed prose and diagrams).
    return {'hRules': h, 'vRules': v, 'shadedBands': b,
            'gridLikely': (h >= 5 or v >= 3 or (h >= 3 and v >= 3) or b >= 1)}


# ── lint ─────────────────────────────────────────────────────────────────────
def lint(book: Path, md_dir: str, want_grid: bool) -> dict:
    pages_dir, md = book / 'pages', book / md_dir
    nums = sorted(int(p.stem) for p in pages_dir.glob('*.webp')) if pages_dir.is_dir() else []
    have = {int(p.stem) for p in md.glob('*.md') if p.stem.isdigit()} if md.is_dir() else set()
    struct = {}
    sp = book / 'structure.json'
    if sp.exists():
        struct = json.loads(sp.read_text(encoding='utf-8'))
    chapter_titles = {norm(c.get('title', '')) for c in struct.get('chapters', [])}
    lesson_titles = {norm(l.get('title', '')) for c in struct.get('chapters', []) for l in c.get('lessons', [])}

    out = {'book': book.name, 'pages': len(nums), 'transcribed': 0, 'missing': [], 'extra': sorted(have - set(nums)),
           'blank': [], 'findings': [], 'tablePages': [], 'figurePages': [], 'illegiblePages': [],
           'suspects': {'tableWithoutGrid': [], 'raggedTable': [], 'figureWrongPage': [], 'headingNotInStructure': [],
                        'markerInPage': [], 'composedCaption': []}}
    add = lambda page, check, detail: out['findings'].append({'page': page, 'check': check, 'detail': detail})

    for n in nums:
        f = md / f'{n}.md'
        if not f.exists():
            out['missing'].append(n); continue
        out['transcribed'] += 1
        text = f.read_text(encoding='utf-8')
        sig = signature(text)
        if sig['blank']:
            out['blank'].append(n); continue
        if sig['markers']:
            out['suspects']['markerInPage'].append(n); add(n, 'marker-in-page', 'page marker written inside a page file')
        if sig['tables']:
            out['tablePages'].append(n)
        for i, t in enumerate(sig['tables']):
            if t['ragged']:
                out['suspects']['raggedTable'].append(n); add(n, 'ragged-table', f'table {i}: rows have different cell counts')
        if sig['figures']:
            out['figurePages'].append(n)
        for fg in sig['figures']:
            m = re.search(r'pages/(\d+)\.webp', fg['src'])
            if m and int(m.group(1)) != n:
                out['suspects']['figureWrongPage'].append(n); add(n, 'figure-wrong-page', f"figure references {fg['src']}")
            alt = fg['alt']
            if alt and not CAPTION_REF.search(alt) and alt not in ('شكل', 'figure') and len(alt.split()) >= 4 \
                    and not any(CAPTION_REF.search(c) for c in [alt]):
                # a long alt with no printed figure number is usually a description the transcriber composed
                out['suspects']['composedCaption'].append(n); add(n, 'composed-caption', f'alt text carries no printed caption number: {alt[:60]}')
        for lvl, h in sig['headings']:
            if lvl == 2 and chapter_titles and norm(h) not in chapter_titles and not any(norm(h) in c or c in norm(h) for c in chapter_titles if c):
                out['suspects']['headingNotInStructure'].append(n); add(n, 'heading-not-in-structure', f'## {h[:60]}')
        if sig['illegible']:
            out['illegiblePages'].append(n)

    if want_grid:
        for n in out['tablePages']:
            img = pages_dir / f'{n}.webp'
            if not img.exists():
                continue
            g = grid_features(img)
            if not g['gridLikely']:
                out['suspects']['tableWithoutGrid'].append(n)
                add(n, 'table-without-grid', f"markdown table but no printed grid detected (h={g['hRules']} v={g['vRules']} shaded={g['shadedBands']})")
    for k in out['suspects']:
        out['suspects'][k] = sorted(set(out['suspects'][k]))
    out['suspectPages'] = sorted({p for v in out['suspects'].values() for p in v})
    return out


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    s1 = sub.add_parser('signature'); s1.add_argument('page')
    s2 = sub.add_parser('lint'); s2.add_argument('book'); s2.add_argument('--md-dir', default='pages-md')
    s2.add_argument('--json', action='store_true'); s2.add_argument('--grid', action='store_true')
    s3 = sub.add_parser('grid'); s3.add_argument('book'); s3.add_argument('--pages', required=True)
    a = ap.parse_args()

    if a.cmd == 'signature':
        print(json.dumps(signature(Path(a.page).read_text(encoding='utf-8')), ensure_ascii=False, indent=2)); return
    if a.cmd == 'grid':
        book = Path(a.book).resolve()
        for n in [int(x) for x in a.pages.split(',') if x.strip()]:
            print(n, json.dumps(grid_features(book / 'pages' / f'{n}.webp')))
        return
    res = lint(Path(a.book).resolve(), a.md_dir, a.grid)
    if a.json:
        print(json.dumps(res, ensure_ascii=False)); return
    print(f"{res['book']}: {res['transcribed']}/{res['pages']} pages, blank {len(res['blank'])}, missing {res['missing'] or 'none'}, "
          f"tables on {len(res['tablePages'])} pages, figures on {len(res['figurePages'])}, illegible marks on {len(res['illegiblePages'])}")
    for k, v in res['suspects'].items():
        if v:
            print(f"  {k:>22}: {v}")
    if not any(res['suspects'].values()):
        print('  no structural suspects')


if __name__ == '__main__':
    main()
