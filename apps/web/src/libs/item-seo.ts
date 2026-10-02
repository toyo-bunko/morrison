/**
 * 資料ページを検索エンジンと SNS に伝えるための値（説明文・共有画像・構造化データ）。
 *
 * 2026-10-02 まで、8,000 件あまりの資料ページはすべてサイト共通の説明文と
 * ロゴ画像を出していた。検索結果では見分けがつかず、共有してもどの資料か分からない。
 */
import type { MorrisonItem } from '@/types/morrison'
import { IMAGE_IIIF_BASE, encodeIdentifier, imageIdentifier } from './iiif-image'

/** 東洋文庫（所蔵機関）。構造化データの holdingArchive に使う。 */
const TOYO_BUNKO = {
  '@type': 'ArchiveOrganization',
  name: '東洋文庫 / Toyo Bunko',
  url: 'https://www.toyo-bunko.or.jp/',
}

/**
 * 共有カード用の画像（1 ページ目）。画像サーバから JPEG で切り出す。
 * SNS によっては WebP を読まないので、サムネイルの既定（WebP）は使わない。
 * `!1200,630` は「1200×630 の箱に収まる大きさ」。縦長のページも切れずに入る。
 */
export function itemOgImageUrl(callNumber: string, base = IMAGE_IIIF_BASE): string {
  return `${base}/${encodeIdentifier(imageIdentifier(callNumber, 1))}/full/!1200,630/0/default.jpg`
}

/**
 * 検索結果に出す説明文。解題（その言語 → もう一方の言語）があればそれを、
 * 無ければ書誌の項目をつないで作る。
 */
export function itemDescription(item: MorrisonItem, locale: string): string {
  const abstract = locale === 'en' ? item.abstract_en || item.abstract_ja : item.abstract_ja || item.abstract_en
  if (abstract && abstract.trim()) return abstract.trim()

  const ja = locale !== 'en'
  const parts = [
    item.heading1,
    item.publication,
    item.publisher,
    item.callNumber ? `${ja ? '請求記号' : 'Call number'}: ${item.callNumber}` : null,
    item.tag1 ? `${ja ? '分類' : 'Classification'}: ${item.tag1}` : null,
  ].filter((v): v is string => !!v && !!v.trim())
  const lead = ja ? 'モリソンパンフレット（東洋文庫所蔵）。' : 'Morrison Pamphlets, Toyo Bunko. '
  return lead + parts.join(ja ? '。' : '. ')
}

/**
 * schema.org の構造化データ。資料館の所蔵資料を表す ArchiveComponent を使う。
 * 書誌の項目のうち、値のあるものだけを載せる。
 */
export function itemJsonLd(
  item: MorrisonItem,
  opts: { url: string; siteName: string; siteUrl: string; description: string; image?: string },
): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'ArchiveComponent',
    name: item.title || item.id,
    url: opts.url,
    identifier: item.callNumber || item.id,
    description: opts.description,
    holdingArchive: TOYO_BUNKO,
    isPartOf: { '@type': 'Collection', name: opts.siteName, url: opts.siteUrl },
  }
  if (item.heading1) ld.creator = item.heading1
  if (item.publisher) ld.publisher = item.publisher
  if (item.publication_year) ld.datePublished = item.publication_year
  if (item.language && item.language.length > 0) ld.inLanguage = item.language
  if (item.tag1) ld.genre = [item.tag1, item.tag2, item.tag3].filter(Boolean)
  if (opts.image) ld.image = opts.image
  return ld
}

/**
 * `<script type="application/ld+json">` に入れる文字列。資料名に `</script>` のような
 * 並びが入っても script が閉じないよう、`<` を逃がす。
 */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
