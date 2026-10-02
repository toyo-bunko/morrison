/**
 * 外に出す URL（引用文・共有リンクなど）を組み立てる。
 *
 * 日本語は接頭辞なしが正規（`i18n/routing.ts` の `localePrefix: 'as-needed'`）。
 * `/ja/item/…` でも 307 で辿り着けるため壊れていることに気づきにくいが、
 * 引用文は論文や目録に転載されるものなので、転送を挟まない形を載せる。
 */

import { defaultLocale } from '@/i18n/config'

/** 言語の接頭辞。既定の言語（日本語）は空文字。 */
export function localeSegment(locale: string): string {
  return locale === defaultLocale ? '' : `/${locale}`
}

/**
 * 任意のページの正規 URL。`path` は言語の接頭辞を含まない形（`/about`、トップは `/`）。
 * トップの日本語版は末尾のスラッシュを付けない（`https://…jp`）。英語版は `…/en`。
 */
export function localizedUrl(siteUrl: string, locale: string, path: string): string {
  const base = `${siteUrl.replace(/\/+$/, '')}${localeSegment(locale)}`
  const p = path === '/' || path === '' ? '' : path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

/**
 * 資料詳細ページの正規 URL。
 * @param siteUrl 末尾のスラッシュは付けない（例 `https://morrison.toyobunko-lab.jp`）
 */
export function itemUrl(siteUrl: string, locale: string, id: string): string {
  return localizedUrl(siteUrl, locale, `/item/${id}`)
}
