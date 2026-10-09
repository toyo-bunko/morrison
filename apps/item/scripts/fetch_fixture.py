"""偽の ES (mock_es.py) が返す資料を、公開サイトから取ってくる。
使い方: python3 scripts/fetch_fixture.py P-I-a-0001 P-III-a-2189
書誌は公開 API /api/item/<id> の attributes (= 検索サーバの _source そのもの)。
全ページの OCR 本文は、今の Next 版の資料ページの HTML に埋め込まれているもの (RSC の受け渡しデータ) を抜き出す
(行の枠は入れない。ビューアは /api/iiif/3/... から取る)。
置き場所は scripts/fixtures/ (git に入れない)。比べるための Next 版の HTML も next-<言語>-<id>.html で残す。
公開サイトに当てるのは資料 1 件につき 3 回 (API・日英のページ)。何度も流さないこと。"""
import json, os, re, sys, urllib.request

SITE = os.environ.get('SITE', 'https://morrison.toyobunko-lab.jp')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures')
os.makedirs(OUT, exist_ok=True)

def get(url):
    req = urllib.request.Request(url, headers={'user-agent': 'morrison-item-fixture'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode()

def flight(html):
    """RSC の受け渡しデータ (self.__next_f.push([1,"..."]) の中身) をつないだ文字列。"""
    return ''.join(json.loads('"' + m + '"') for m in re.findall(r'self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)', html))

def rows(data):
    """RSC の行を {id: 中身} にする。ふつうの行は改行まで、"T" の行は宣言したバイト数ぶん (改行で終わらない)。"""
    raw, out, i = data.encode(), {}, 0
    while i < len(raw):
        m = re.compile(rb'([0-9a-f]+):').match(raw, i)
        if not m:
            j = raw.find(b'\n', i)
            i = len(raw) if j < 0 else j + 1
            continue
        key, i = m.group(1).decode(), m.end()
        t = re.compile(rb'T([0-9a-f]+),').match(raw, i)
        if t:
            n = int(t.group(1), 16)
            out[key] = raw[t.end():t.end() + n].decode()
            i = t.end() + n
        else:
            j = raw.find(b'\n', i)
            j = len(raw) if j < 0 else j
            out[key] = raw[i:j].decode()
            i = j + 1
    return out

def ocr_pages(html):
    data = flight(html)
    m = re.search(r'"ocrPages":(\[.*?\])\s*,"(?:initialPage|searchQuery|query)', data, re.S)
    if not m:
        return []
    pages = json.loads(m.group(1))
    # 長い文字列は "$1e" のような参照に置き換わり、本体は "1e:T<UTF-8 のバイト数 (16 進)>,<本文>" の行に入っている
    table = rows(data)
    for p in pages:
        ref = p.get('text', '')
        if re.fullmatch(r'\$[0-9a-f]+', ref) and ref[1:] in table:
            p['text'] = table[ref[1:]]
    return pages

for i in sys.argv[1:]:
    src = json.loads(get(f'{SITE}/api/item/{i}'))['data']['attributes']
    ja = get(f'{SITE}/item/{i}')
    en = get(f'{SITE}/en/item/{i}')
    open(os.path.join(OUT, f'next-ja-{i}.html'), 'w').write(ja)
    open(os.path.join(OUT, f'next-en-{i}.html'), 'w').write(en)
    pages = ocr_pages(ja)
    last = re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日</div>', ja)
    json.dump({'_id': i, '_source': src, 'pages': pages, 'last_updated': last.groups() if last else None},
              open(os.path.join(OUT, f'{i}.json'), 'w'), ensure_ascii=False)
    print(i, 'pages', len(pages), 'last_updated', last.groups() if last else None)
