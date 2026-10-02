import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache'

// ビルド時に作ったページ（トップ・解説・お知らせなど）を、Next.js を起動せずに
// 静的ファイルから返す。描画の CPU を使わないため、Workers 無料枠の 10ms に収まる。
// 資料ページなど毎回描画するページは worker.ts のキャッシュで受ける。
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
})
