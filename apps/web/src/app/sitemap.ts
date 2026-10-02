import type { MetadataRoute } from 'next'
import { esSearch } from '@toyo/shared-lib'
import { locales } from '@/i18n/config'
import { localizedUrl } from '@/libs/canonical-url'
import { origin } from '@/libs/metadata'
import { getNewsItems } from '@/libs/content'
import { BIB_INDEX } from '@/config/indices'
import { ensureEnv } from '@/libs/cf-env'

// 資料は検索サーバから取るので、配布時ではなく要求時に作る。
export const dynamic = 'force-dynamic'

/** 言語の接頭辞を含まないパスから、日英両方の URL を持つ 1 行を作る。 */
function entry(path: string, extra: Partial<MetadataRoute.Sitemap[number]> = {}): MetadataRoute.Sitemap[number] {
  const languages: Record<string, string> = {}
  for (const l of locales) languages[l] = localizedUrl(origin, l, path)
  return { url: localizedUrl(origin, 'ja', path), alternates: { languages }, ...extra }
}

/**
 * 全資料の ID（＝請求記号）。8,000 件あまりなので 1 回 5,000 件ずつ search_after で取る。
 * 取れなかったときは空を返し、固定ページだけのサイトマップにする（全体を 500 にしない）。
 */
async function itemIds(): Promise<string[]> {
  ensureEnv()
  const ids: string[] = []
  let after: unknown[] | undefined
  try {
    for (let i = 0; i < 10; i++) {
      const res = await esSearch(BIB_INDEX, {
        size: 5000,
        _source: false,
        sort: [{ callNumber: 'asc' }],
        ...(after ? { search_after: after } : {}),
      })
      const hits = (res.hits?.hits || []) as Array<{ _id: string; sort?: unknown[] }>
      for (const h of hits) ids.push(h._id)
      if (hits.length < 5000) break
      after = hits[hits.length - 1].sort
    }
  } catch (error) {
    console.error('sitemap: failed to list items', error)
  }
  return ids
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed = ['/', '/search', '/fulltext-search', '/visualize', '/about', '/news', '/api-docs'].map((p) =>
    entry(p, { changeFrequency: p === '/' || p === '/news' ? 'weekly' : 'monthly' }),
  )
  const news = getNewsItems('ja').map((n) => entry(`/news/${n.slug}`, { lastModified: n.date }))
  const items = (await itemIds()).map((id) => entry(`/item/${encodeURIComponent(id)}`))
  return [...fixed, ...news, ...items]
}
