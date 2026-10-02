import type { MetadataRoute } from 'next'
import { origin } from '@/libs/metadata'

/**
 * 検索エンジン向けの案内。
 *
 * - `/api/` は機械向けの窓口（IIIF・DTS・検索）。巡回されると検索サーバに
 *   負荷がかかるだけで、検索結果に載せる意味はないので閉じる
 * - 検索画面の条件つき URL（`?q=…`、`?filters=…`）は組み合わせが無限にあり、
 *   巡回が止まらなくなる。条件なしの検索画面と資料ページはサイトマップから辿れる
 * - Mirador のページはここでは閉じない。閉じると noindex の指定（mirador/layout.tsx）が
 *   読まれず、外からリンクされた URL だけが検索結果に残ることがある
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/search?',
        '/en/search?',
        '/fulltext-search?',
        '/en/fulltext-search?',
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
  }
}
