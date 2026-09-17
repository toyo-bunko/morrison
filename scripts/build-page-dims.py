#!/usr/bin/env python3
"""
画像サーバ (img.toyobunko-lab.jp) に各資料のページを問い合わせ、ページ番号と寸法の一覧を作る。

なぜ要るか:
  manifest はこれまで、表示のたびに画像サーバへページごとに info.json を問い合わせていた。
  Cloudflare Workers (無料プラン) は 1 回の処理で外へ出せる問い合わせが 50 回までなので、
  それを超える資料はページが途中で打ち切られていた (2026-09-10 実測: P-III-a-1912 は
  209 ページ中 49、P-III-a-1336 は 81 ページ中 48)。しかも 1 回に 7〜8 秒かかっていた。
  この一覧をサイトに同梱し、manifest は一覧を読むだけにする。

使い方:
  python3 scripts/build-page-dims.py                                  # 全件 (中断しても再開できる)
  python3 scripts/build-page-dims.py --only P-III-a-0625,P-III-a-1912 # 数件だけ試す (書き出さない)
  python3 scripts/build-page-dims.py --update P-V-A-a-42,P-V-A-a-65    # 数件だけ調べ直し、今の一覧に上書きする

入力: data/bib_callnumbers.txt (1 行 1 請求記号)
途中経過: data/page-dims.progress.jsonl (再開用。コミットしない)
出力: apps/web/src/data/page-dims.json
  {"items": {"<請求記号>": [[最初のページ, 枚数, 幅, 高さ], ...]}}
  同じ寸法が続くページは 1 行にまとめる。画像が 1 枚も無い資料は載せない。

画像を足したり差し替えたりしたら、途中経過のファイルを消してから流し直し、deploy する。
(manifest は一覧の末尾より後ろも数枚だけ確かめるので、末尾に足したページは流し直す前でも出る。)
"""
import argparse
import concurrent.futures as futures
import http.client
import json
import os
import sys
import threading
import time
import urllib.parse
from datetime import datetime, timezone

HOST = "img.toyobunko-lab.jp"
# manifest の探し方と揃える: 8 枚続けて無ければ、その資料のページは終わりとみなす
MISS_LIMIT = 8

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIST = os.path.join(ROOT, "data", "bib_callnumbers.txt")
PROGRESS = os.path.join(ROOT, "data", "page-dims.progress.jsonl")
OUT = os.path.join(ROOT, "apps", "web", "src", "data", "page-dims.json")

local = threading.local()


def info_path(call_number: str, page: int) -> str:
    """apps/web/src/libs/iiif-image.ts の imageIdentifier と同じ識別子。"""
    group = "-".join(call_number.split("-")[:2])
    segments = ["morrison_p", group, call_number, f"{page:04d}.tif"]
    return "/iiif/" + "/".join(urllib.parse.quote(s, safe="") for s in segments) + "/info.json"


def fetch_dims(path: str):
    """(幅, 高さ) を返す。ページが無ければ None。それ以外の失敗は数回やり直してから例外。"""
    err = ""
    for attempt in range(4):
        conn = getattr(local, "conn", None)
        if conn is None:
            conn = local.conn = http.client.HTTPSConnection(HOST, timeout=60)
        try:
            conn.request("GET", path, headers={"User-Agent": "morrison-page-dims/1.0"})
            res = conn.getresponse()
            body = res.read()
            if res.status == 200:
                info = json.loads(body)
                return int(info["width"]), int(info["height"])
            if res.status == 404:
                return None
            err = f"HTTP {res.status}"
        except Exception as e:  # 接続が切れた等。繋ぎ直してやり直す
            err = repr(e)
            conn.close()
            local.conn = None
        time.sleep(2 ** attempt)
    raise RuntimeError(f"{path}: {err}")


def scan(call_number: str):
    runs: list[list[int]] = []
    page, misses = 1, 0
    while misses < MISS_LIMIT:
        dims = fetch_dims(info_path(call_number, page))
        if dims is None:
            misses += 1
        else:
            misses = 0
            w, h = dims
            last = runs[-1] if runs else None
            if last and last[0] + last[1] == page and last[2] == w and last[3] == h:
                last[1] += 1
            else:
                runs.append([page, 1, w, h])
        page += 1
    return runs


def write_output(results: dict):
    items = {cn: runs for cn, runs in sorted(results.items()) if runs}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with open(OUT, "w") as f:
        # 1 資料 1 行にして、流し直したときの差分を読めるようにする
        f.write('{"generated": "%s", "items": {\n' % generated)
        lines = [f"{json.dumps(cn)}: {json.dumps(runs, separators=(',', ':'))}" for cn, runs in items.items()]
        f.write(",\n".join(lines))
        f.write("\n}}\n")
    pages = sum(r[1] for runs in items.values() for r in runs)
    print(f"書き出しました: {OUT} ({len(items)} 資料, {pages} ページ)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="カンマ区切りの請求記号。結果を表示するだけで書き出さない")
    ap.add_argument("--update", help="カンマ区切りの請求記号。調べ直して、今の一覧のその資料だけを置き換える")
    ap.add_argument("--workers", type=int, default=12, help="同時に調べる資料の数")
    # data/ はコミットしない (.gitignore)。worktree で流すときは本体のものを指す
    ap.add_argument("--list", default=LIST, help="請求記号の一覧 (既定: data/bib_callnumbers.txt)")
    args = ap.parse_args()

    if args.only:
        for cn in args.only.split(","):
            runs = scan(cn.strip())
            print(cn, sum(r[1] for r in runs), "ページ", runs)
        return

    if args.update:
        # 差し替えた数件のために全 8,000 件を流し直さずに済むようにする (2026-09-16 pCloud 差し替え)
        results = {cn: runs for cn, runs in json.load(open(OUT))["items"].items()}
        for cn in [c.strip() for c in args.update.split(",") if c.strip()]:
            runs = scan(cn)
            before = sum(r[1] for r in results.get(cn, []))
            print(f"  {cn}: {before} → {sum(r[1] for r in runs)} ページ")
            if runs:
                results[cn] = runs
            else:
                results.pop(cn, None)
        write_output(results)
        return

    call_numbers = [l.strip() for l in open(args.list) if l.strip()]
    results: dict = {}
    if os.path.exists(PROGRESS):
        for line in open(PROGRESS):
            rec = json.loads(line)
            results[rec["cn"]] = rec["runs"]
    todo = [cn for cn in call_numbers if cn not in results]
    print(f"全 {len(call_numbers)} 件、済み {len(results)} 件、残り {len(todo)} 件")

    lock = threading.Lock()
    failed: list[str] = []
    started = time.time()
    os.makedirs(os.path.dirname(PROGRESS), exist_ok=True)
    with open(PROGRESS, "a") as progress, futures.ThreadPoolExecutor(args.workers) as pool:
        jobs = {pool.submit(scan, cn): cn for cn in todo}
        for i, job in enumerate(futures.as_completed(jobs), 1):
            cn = jobs[job]
            try:
                runs = job.result()
            except Exception as e:
                failed.append(cn)
                print(f"失敗 {cn}: {e}", file=sys.stderr)
                continue
            with lock:
                results[cn] = runs
                progress.write(json.dumps({"cn": cn, "runs": runs}) + "\n")
                progress.flush()
            if i % 200 == 0:
                print(f"  {i}/{len(todo)} 件 ({time.time() - started:.0f} 秒)", flush=True)

    if failed:
        print(f"{len(failed)} 件失敗しました。もう一度流すと、その分だけやり直します: {failed[:10]}", file=sys.stderr)
        sys.exit(1)
    write_output(results)


if __name__ == "__main__":
    main()
