import { Metadata } from 'next'
import { getConfig } from '@/libs/getConfig'
import { locales } from '@/i18n/config'
import { localizedUrl } from '@/libs/canonical-url'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://morrison.toyobunko-lab.jp'
export const origin = (siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`).replace(/\/+$/, '')

const twitter = '@toyobunko_m'

// Social share card. The PNGs live in src/app (file-based metadata) and are
// served at these stable paths; we reference them explicitly so the og:image /
// twitter:image survive metadata merging when child segments (e.g. the item
// page) set their own openGraph/twitter objects. metadataBase makes them
// absolute for crawlers.
const defaultOgImage = {
  url: '/opengraph-image.png',
  width: 1200,
  height: 630,
}

const ogLocale: Record<string, string> = { ja: 'ja_JP', en: 'en_US' }

/**
 * 正規 URL（canonical）と、言語版どうしの対応（hreflang）。
 *
 * 日本語版と英語版は同じ中身の別言語なので、検索エンジンに対応を伝えないと
 * 重複ページとして扱われることがある。x-default は日本語（接頭辞なし）に向ける。
 */
export function alternatesFor(locale: string, path: string): Metadata['alternates'] {
  const languages: Record<string, string> = {}
  for (const l of locales) languages[l] = localizedUrl(origin, l, path)
  languages['x-default'] = localizedUrl(origin, 'ja', path)
  return { canonical: localizedUrl(origin, locale, path), languages }
}

/** 検索結果や共有カードに出す説明文の長さをそろえる。 */
export function truncate(text: string, max: number): string {
  const s = text.replace(/\s+/g, ' ').trim()
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s
}

export interface PageMetadataOptions {
  /** 言語の接頭辞を含まないパス（`/about`、トップは `/`）。 */
  path: string
  /** ページ名。サイト名は付けない（layout の template が後ろに付ける）。省略時はサイト名だけ。 */
  title?: string
  description?: string
  /** 共有カードの画像。省略時はサイト共通の画像。 */
  image?: { url: string; width?: number; height?: number; alt?: string }
  type?: 'website' | 'article'
  /** 検索エンジンに載せないページ（ビューア単体など）。 */
  noindex?: boolean
}

/**
 * ページごとのメタデータ。タイトル・説明・正規 URL・言語版の対応・共有カードを
 * まとめて組み立てる。
 *
 * 共有カード（openGraph / twitter）は layout の値と**マージされず置き換わる**ため、
 * サイト名や画像も含めて毎回すべて書く。og:url がトップのままだと、どの資料を
 * 共有してもトップへのリンクとして扱われる（2026-10-02 に発見）。
 */
export async function pageMetadata(locale: string, opts: PageMetadataOptions): Promise<Metadata> {
  const config = await getConfig(locale)
  const fullTitle = opts.title ? `${opts.title} | ${config.siteName}` : config.siteName
  const description = truncate(opts.description || config.siteDescription, 200)
  const url = localizedUrl(origin, locale, opts.path)
  const image = opts.image
    ? { alt: opts.title || config.siteName, ...opts.image }
    : { ...defaultOgImage, alt: config.siteName }
  const twitterImage = opts.image ? opts.image.url : '/twitter-image.png'

  return {
    // layout の template（`%s | サイト名`）を通す。トップは absolute でサイト名だけにする。
    title: opts.title ? opts.title : { absolute: config.siteName },
    description,
    alternates: alternatesFor(locale, opts.path),
    ...(opts.noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title: fullTitle,
      description,
      url,
      type: opts.type || 'website',
      siteName: config.siteName,
      locale: ogLocale[locale] || ogLocale.ja,
      alternateLocale: locales.filter((l) => l !== locale).map((l) => ogLocale[l]),
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      site: twitter,
      creator: twitter,
      title: fullTitle,
      description,
      images: [twitterImage],
    },
  }
}

/** layout 用。各ページが上書きしなかったときの既定値と、タイトルの template。 */
export async function getDefaultMetadata(locale: string = 'ja'): Promise<Metadata> {
  const config = await getConfig(locale)
  const base = await pageMetadata(locale, { path: '/' })
  return {
    ...base,
    metadataBase: new URL(origin),
    title: { default: config.siteName, template: `%s | ${config.siteName}` },
    // ページ側で alternates を出さなかったとき、トップの canonical が全ページに
    // 付くのを避ける（付くと「このページはトップの複製」と宣言したことになる）。
    alternates: undefined,
  }
}
