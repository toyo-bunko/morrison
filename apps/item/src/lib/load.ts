// 資料ページに要るデータをまとめて引く。日英のページ (pages/item/[id].astro、pages/en/item/[id].astro) から呼ぶ。
// 結果は 3 通り: 資料がある / 旧 Omeka の数字の ID なので今の ID へ転送する / 無い (404)。
// 検索サーバに繋がらないときは getItem が例外を投げ、500 になる。
// 障害を「無い」(404) と返すと、検索エンジンが索引からページを外してしまうため、ここで握りつぶさない。
import type { MorrisonItem } from '@/types/morrison'
import type { OcrPage } from '@/components/pages/item/BookViewer'
import { findByOmekaId, getIndexLastUpdated, getItem, getOcrPages } from './es'
import { isSafeId, itemPath, type Locale } from './paths'

export interface ItemData {
  item: MorrisonItem
  lastUpdatedMs: number | null
  ocrPages: OcrPage[]
}

export type ItemLoad = { data: ItemData } | { redirect: string } | { notFound: true }

export async function loadItem(locale: Locale, id: string): Promise<ItemLoad> {
  // 使えない文字を含む ID は検索サーバに渡さず 404
  if (!isSafeId(id)) return { notFound: true }

  const [found, lastUpdatedMs] = await Promise.all([getItem(id), getIndexLastUpdated()])
  if (!found) {
    // 旧サイトの資料 URL (/item/99564) は、Cloudflare の転送規則で /item/<元の続き> に来る。今の ID へ 301 で送る
    if (/^\d+$/.test(id)) {
      const current = await findByOmekaId(id)
      if (current) return { redirect: itemPath(locale, current) }
    }
    return { notFound: true }
  }

  const { item, raw } = found
  // 画像のある資料だけ、ビューアの資料内検索のために全ページの OCR 本文を引く (Next 版と同じ)
  const omekaId = raw.omeka_id as string | number | undefined
  const ocrPages = item.has_image && omekaId != null ? await getOcrPages(omekaId) : []
  return { data: { item, lastUpdatedMs, ocrPages } }
}
