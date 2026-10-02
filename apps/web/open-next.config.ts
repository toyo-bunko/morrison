import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache'

// ビルド時に作ったページ（トップ・解説・お知らせなど）を、Next.js を起動せずに
// 静的ファイルから返す。描画の CPU を使わないため、Workers 無料枠の 10ms に収まる。
// 資料ページなど毎回描画するページは worker.ts のキャッシュで受ける。
//
// **@opennextjs/cloudflare は 1.20.7 以上 (@opennextjs/aws 4.1.6 以上) にしておくこと。**
// それより前は、Next.js 16 の先読みが「骨組みだけ」(next-router-segment-prefetch:
// /_tree) を頼んでもページ全体を返していた。ブラウザは読めずに取り直し続け、
// 2026-10-02 には開いたままのページで毎秒約 300 回の先読みが止まらなかった。
// 版を戻すなら enableCacheInterception を外す。
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
})
