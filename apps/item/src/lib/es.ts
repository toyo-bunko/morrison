// 検索サーバ (Elasticsearch/OpenSearch) から資料を引く。
// 問い合わせの形は Next 版 (app/[locale]/item/[id]/page.tsx) と同じ。
// 接続先と鍵は Worker のシークレット (ES_URL、CF_ACCESS_CLIENT_ID、CF_ACCESS_CLIENT_SECRET)。
import { env } from 'cloudflare:workers'
import type { MorrisonItem } from '@/types/morrison'
import type { OcrPage } from '@/components/pages/item/BookViewer'
import { BIB_INDEX, PAGE_INDEX } from '@/config/indices'

type Secrets = { ES_URL?: string; CF_ACCESS_CLIENT_ID?: string; CF_ACCESS_CLIENT_SECRET?: string }
const secrets = () => env as unknown as Secrets

/** Cloudflare Access のサービストークンつきのヘッダ (apps/web/src/libs/api.ts の createHeaders と同じ)。 */
export function esHeaders(): Record<string, string> {
  const s = secrets()
  return {
    'Content-Type': 'application/json',
    'CF-Access-Client-Id': s.CF_ACCESS_CLIENT_ID || '',
    'CF-Access-Client-Secret': s.CF_ACCESS_CLIENT_SECRET || '',
  }
}

const esUrl = (path: string) => `${secrets().ES_URL || ''}/${path}`

/** 検索サーバの失敗。呼び出し側で 500 にする (404 にしてはいけない)。 */
export class EsError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

async function search(index: string, body: unknown): Promise<{ hits?: { hits?: { _id: string; _source?: Record<string, unknown> }[] } }> {
  const res = await fetch(esUrl(`${index}/_search`), { method: 'POST', headers: esHeaders(), body: JSON.stringify(body) })
  if (!res.ok) throw new EsError(res.status, `ES _search ${res.status} on ${index}`)
  return res.json()
}

/**
 * 資料 1 件。「ある」ときは本体、「無い」ときは null。
 * 検索サーバに繋がらない・404 以外の失敗は null にせず EsError を投げる。
 * 障害を「無い」(404) と返すと、検索エンジンが索引からページを外してしまうため。
 */
export async function getItem(id: string): Promise<{ item: MorrisonItem; raw: Record<string, unknown> } | null> {
  const res = await fetch(esUrl(`${BIB_INDEX}/_doc/${encodeURIComponent(id)}`), { headers: esHeaders() })
  if (res.status === 404) return null
  if (!res.ok) throw new EsError(res.status, `ES ${res.status} for item ${id}`)
  const data = (await res.json()) as { found: boolean; _id: string; _source: Record<string, unknown> }
  if (!data.found) return null
  return { item: { id: data._id, ...data._source } as MorrisonItem, raw: data._source }
}

/**
 * 資料の全ページの OCR 本文 (ビューアの資料内検索とページ一覧に使う)。行の枠は入れない
 * (ビューアが開いたページの分だけ /api/iiif/3/:id/annotations から取る)。
 * 失敗したら空にする (本文検索が使えないだけで、ページは出す。Next 版と同じ)。
 */
export async function getOcrPages(omekaId: string | number): Promise<OcrPage[]> {
  try {
    const data = await search(PAGE_INDEX, {
      size: 2000,
      _source: ['page', 'text'],
      query: { term: { item_id: String(omekaId) } },
    })
    // 同じページの文書が 2 つ以上あることがある (本文と枠を別々に入れた名残)。長いほうを採る
    const byPage = new Map<number, string>()
    for (const h of data.hits?.hits || []) {
      const src = (h._source || {}) as { page?: string | number; text?: string }
      const page = Number(src.page)
      if (!Number.isFinite(page) || page < 1) continue
      const text = src.text ?? ''
      const prev = byPage.get(page)
      if (prev === undefined || text.length > prev.length) byPage.set(page, text)
    }
    return Array.from(byPage.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([page, text]) => ({ page, text }))
  } catch (error) {
    console.error('Failed to fetch OCR pages:', error)
    return []
  }
}

/**
 * 旧 Omeka 版の数字の ID (`/item/99564`) から、いまの資料 ID (請求記号) を引く。
 * 見つからない・失敗したときは null (呼び出し側で 404。Next 版と同じ)。
 */
export async function findByOmekaId(omekaId: string): Promise<string | null> {
  try {
    const data = await search(BIB_INDEX, { size: 1, _source: false, query: { term: { omeka_id: Number(omekaId) } } })
    return data.hits?.hits?.[0]?._id ?? null
  } catch (error) {
    console.error('Failed to look up omeka_id:', error)
    return null
  }
}

/** 索引の作成日 (「データベース最終更新日」に出す)。取れなければ null で、欄を出さない。 */
export async function getIndexLastUpdated(): Promise<number | null> {
  try {
    const res = await fetch(esUrl(`${BIB_INDEX}/_settings`), { headers: esHeaders() })
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, { settings?: { index?: { creation_date?: string } } }>
    const raw = data?.[BIB_INDEX]?.settings?.index?.creation_date
    return raw ? Number(raw) : null
  } catch {
    return null
  }
}
