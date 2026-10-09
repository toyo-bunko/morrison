"""偽の ES。資料ページの Worker が使う 4 つの問い合わせだけを返す。
  GET  /morrison_bib/_doc/<id>       書誌 1 件 (無い ID は 404)
  GET  /morrison_bib/_settings       索引の作成日 (「データベース最終更新日」)
  POST /morrison_bib/_search         旧 Omeka の数字の ID (omeka_id) から今の ID を引く
  POST /morrison_page/_search        資料の全ページの OCR 本文 (item_id = omeka_id)
資料は scripts/fixtures/<id>.json (fetch_fixture.py で作る)。
E で始まる ID は 503 を返す (検索サーバの障害で 500 になり、404 にならないことの確認用)。
使い方: python3 scripts/mock_es.py 9201"""
import json, os, sys, glob, time
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures')
DOCS = {}
for p in glob.glob(os.path.join(BASE, '*.json')):
    d = json.load(open(p))
    DOCS[d['_id']] = d
LAST = next((d['last_updated'] for d in DOCS.values() if d.get('last_updated')), None)
# 日本時間の昼にしておけば、どの時刻帯で表示しても同じ日付になる
CREATED = int(datetime(*map(int, LAST), 12, tzinfo=timezone(timedelta(hours=9))).timestamp() * 1000) if LAST else 0

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, code, obj):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code); self.send_header('content-type', 'application/json'); self.send_header('content-length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        parts = self.path.split('?')[0].strip('/').split('/')
        if parts[-1] == '_settings':
            return self.send(200, {parts[0]: {'settings': {'index': {'creation_date': str(CREATED)}}}})
        if len(parts) == 3 and parts[1] == '_doc':
            i = parts[2]
            if i.startswith('E'): return self.send(503, {'error': 'unavailable'})
            if i.startswith('w'):  # w で始まる ID は 50ms 遅れて P-I-a-0001 を返す (待ち時間が CPU に数えられていないかの確認用)
                time.sleep(0.05); i = 'P-I-a-0001'
            d = DOCS.get(i)
            if not d: return self.send(404, {'_id': i, 'found': False})
            return self.send(200, {'_id': d['_id'], 'found': True, '_source': d['_source']})
        self.send(404, {})
    def do_POST(self):
        n = int(self.headers.get('content-length') or 0); body = json.loads(self.rfile.read(n) or b'{}')
        index = self.path.strip('/').split('/')[0]
        term = (body.get('query') or {}).get('term') or {}
        if index == 'morrison_bib' and 'omeka_id' in term:
            hits = [{'_id': d['_id']} for d in DOCS.values() if d['_source'].get('omeka_id') == term['omeka_id']]
            return self.send(200, {'hits': {'total': {'value': len(hits)}, 'hits': hits[:1]}})
        if index == 'morrison_page' and 'item_id' in term:
            d = next((d for d in DOCS.values() if str(d['_source'].get('omeka_id')) == str(term['item_id'])), None)
            pages = d['pages'] if d else []
            return self.send(200, {'hits': {'total': {'value': len(pages)}, 'hits': [{'_id': f"{term['item_id']}_{p['page']}", '_source': p} for p in pages]}})
        self.send(404, {})

ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1]) if len(sys.argv) > 1 else 9201), H).serve_forever()
