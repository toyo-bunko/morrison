# apps/item: 資料ページを返す Astro の Worker

資料ページだけを、Next (`apps/web`) とは別の Worker (`morrison-item`) で返します。
kanseki (toyo-bunko/kanseki の `apps/item`) で先に行った差し替えを写したものです。

なぜ分けるか: 2026-10-09、資料ページの CPU 超過 (エラー 1102、503) が 1 日 8,100 件中 3,428 件 (42%) まで増えました。
Next の描画は 1 ページ 20〜30ms の CPU を使い、Workers 無料枠の 10ms を超えます。
資料ページは日英 16,308 URL あり、クローラが 1 URL ずつ読むので描画のキャッシュも当たりません。
kanseki では同じ差し替えで、切り替え後 8 時間 6,010 件・超過 0 になりました。

## 何を返すか

| URL | 中身 |
| --- | --- |
| `/item/<id>`、`/en/item/<id>` | 資料ページ (日本語・英語)。見た目・文言・メタ情報は Next 版と同じ |
| `/item/<数字>` | 旧 Omeka 版の ID。今の ID (請求記号) へ 301 で転送する |
| `/item/_astro/*` | このアプリの CSS と JS (route を増やさないよう `/item/` の下に置いている) |

それ以外 (トップ・検索・全文検索・`/api/*`) は今までどおり Next です。
資料ページのビューアが読む `/api/iiif/...`、共有欄の `/api/item/...`・`/api/dts/...` も Next が返します。

## 中身

- 書誌の表・引用・JSON-LD・メタ情報は `src/components/ItemPage.astro`。
  メタ情報の組み立て (`libs/metadata.ts`)、説明文と JSON-LD (`libs/item-seo.ts`)、翻訳、設定は `apps/web/src` を `@` で直接読みます。
  CSS も `apps/web/src/app/[locale]/globals.css` を取り込みます。Next 側のファイルは動かしません
- 画像ビューアは Next 版の `BookViewer.tsx` をそのまま島として載せます (`src/components/Viewer.tsx`、ブラウザだけで描く)。
  `BookViewer` が使う `next/navigation` と `next-intl` は、`astro.config.mjs` で小さな代わりの部品 (`src/shims/`) に差し替えます
- 全ページの OCR 本文 (資料内検索とページ一覧に使う) は、島の props にせず `<script type="application/json">` に 1 回だけ書きます
- 共有・書き出しの欄も Next 版の `ItemShareExport.tsx` をそのまま島にしています
- 描画結果は `src/middleware.ts` が Cloudflare のキャッシュに 1 日置きます (版の ID が鍵に入るので、配ると入れ替わる)。
  `x-edge-cache: HIT|MISS` で確かめられます
- 検索サーバに繋がらないとき、資料ページは 500 を返します (404 にすると検索エンジンが索引から外すため)

## 手元で動かす

偽の検索サーバ (`scripts/mock_es.py`) で動かせます。実際の検索サーバには触りません。
偽の検索サーバが返す資料は、公開サイトから取ってきます (資料 1 件につき 3 回だけ公開サイトに当てます)。

```
python3 scripts/fetch_fixture.py P-I-a-0001 P-III-a-2189
python3 scripts/mock_es.py 19201
```

別のターミナルで (`apps/item` で):

```
npm run build
npx wrangler dev --port 8789 --var ES_URL:http://127.0.0.1:19201
```

`curl http://localhost:8789/item/P-I-a-0001` のように確かめます。
取ってきた資料以外の ID は 404、`99564` (P-I-a-0001 の旧 ID) は 301、`E` で始まる ID は検索サーバの障害 (500) になります。
`scripts/fixtures/next-<言語>-<id>.html` に今の Next 版の HTML が残るので、並べて比べられます。

ビューアは `/api/iiif/...` を読むので、ブラウザで確かめるときは
「`/item/*` と `/en/item/*` は手元、ほかは本番」に振り分ける中継を手前に置きます (本番の route と同じ振り分け)。

## 配る

main への push で `deploy.yml` の `item` ジョブが配ります。Next の配布とは別のジョブなので、片方が落ちても他方は配られます。

初めて配る前の順番:

1. Worker にシークレットを入れる (Next の Worker と同じ値)。1Password から取り出して流し込み、値は画面に出しません。
   スクリプトは 1Password の項目名を含むので、git に入れずに本体のチェックアウトの `scripts/setup/` に置いてあります
   (`register-item-worker-secrets.zsh`)。Worker がまだ無ければ空の Worker が作られます
   (route はまだ付いていないので、この時点ではサイトに影響しません)
2. main にマージして配る。配布では route を付けないので、まだサイトは Next のまま
3. 手元から route を付ける (下の「route を付ける」)。付けた時点から資料ページがこの Worker になる
4. 見た目・メタ情報・ビューア・検索結果からの移動を確かめ、Cloudflare の集計で資料ページの CPU 超過の件数を見る

## route を付ける

route は `wrangler.jsonc` ではなく `wrangler.routes.jsonc` に書いてあり、配布では付けません。
配布のたびに付け直すと、GitHub Actions の配布用トークンに `Zone | Workers Routes` の権限が要るためです
(kanseki で 2026-10-09 に、権限が無く配布の最後で落ちた)。
route は滅多に変わらないので、手元の `wrangler login` の権限で一度だけ付けます (`apps/item` で)。

```
npm run routes
```

`wrangler triggers deploy` で、この Worker の route をファイルに書いた 2 本で置き換えます。コードは上げません。

## 戻す

route を外します (管理画面の Worker → Settings → Domains & Routes)。
資料ページは Next 側に残してあるので、そのまま Next が返します。Worker を消す必要はありません。

## テスト

`npm test` (vitest)、型検査は `npm run typecheck`。
