// 言語ごとの URL の組み立て。日本語は接頭辞なし、英語は /en (Next 版 libs/canonical-url.ts と同じ規則)。
export type Locale = 'ja' | 'en'

/** パス (クエリ付きでもよい) に言語の接頭辞を付ける。トップ '/' は英語で '/en'。 */
export function withLocale(locale: Locale, path: string): string {
  if (locale === 'ja') return path
  return path === '/' ? '/en' : `/en${path}`
}

export const otherLocale = (locale: Locale): Locale => (locale === 'ja' ? 'en' : 'ja')

/** 資料ページのパス。ID は URL に入れられる形にする。 */
export const itemPath = (locale: Locale, id: string): string => withLocale(locale, `/item/${encodeURIComponent(id)}`)

/** _id はそのまま検索サーバの URL に入るので、危険な文字を弾く (請求記号は P-I-a-0001 の形)。 */
export function isSafeId(id: string): boolean {
  return /^[A-Za-z0-9_.\-:]+$/.test(id) && id.length <= 256
}

/**
 * 「検索に戻る」の行き先。資料ページの URL に付いてきた検索の条件を、検索画面の形に戻す
 * (Next 版 page.tsx と同じ。言語の接頭辞はまだ付けない)。
 */
export function searchHref(params: URLSearchParams): string {
  const out = new URLSearchParams()
  const q = params.get('q')
  const page = params.get('page')
  const size = params.get('size')
  const filters = params.get('filters')
  if (q) out.set('q', q)
  if (page && page !== '1') out.set('current', `n_${page}_n`)
  if (size && size !== '24') out.set('size', `n_${size}_n`)
  if (filters) out.set('filters', filters)
  const qs = out.toString()
  return `/search${qs ? `?${qs}` : ''}`
}
