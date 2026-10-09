// <head> に出すメタ情報。中身は Next 版と同じ pageMetadata (apps/web/src/libs/metadata.ts) に作らせ、
// その結果を Next と同じ並びのタグにする。canonical・hreflang・og・twitter の食い違いを避けるため。
import type { Metadata } from 'next'
import { origin, pageMetadata, type PageMetadataOptions } from '@/libs/metadata'
import { getConfig } from './i18n'
import type { Locale } from './paths'

export interface HeadTags {
  title: string
  description: string
  noindex: boolean
  canonical: string
  languages: [string, string][]
  og: [string, string][]
  twitter: [string, string][]
}

/** Next は metadataBase を基準に相対 URL を絶対にする。同じことをする。 */
const abs = (url: string) => (url.startsWith('/') ? `${origin}${url}` : url)

type OgImage = { url: string; width?: number; height?: number; alt?: string }

export async function buildHeadTags(locale: Locale, opts: PageMetadataOptions): Promise<HeadTags> {
  const meta: Metadata = await pageMetadata(locale, opts)
  const siteName = getConfig(locale).siteName
  const og = meta.openGraph as Record<string, unknown>
  const tw = meta.twitter as Record<string, unknown>
  const alt = meta.alternates as { canonical: string; languages: Record<string, string> }
  const robots = meta.robots as { index?: boolean } | undefined
  // layout の template (`%s | サイト名`) を通した形。トップ (absolute) はサイト名だけ
  const title = typeof meta.title === 'string' ? `${meta.title} | ${siteName}` : siteName

  // Next の出力と同じ並び (og:image の次に寸法と代替文、その後に別言語、最後に種類)
  const ogTags: [string, string][] = [
    ['og:title', String(og.title)],
    ['og:description', String(og.description)],
    ['og:url', abs(String(og.url))],
    ['og:site_name', String(og.siteName)],
    ['og:locale', String(og.locale)],
  ]
  for (const image of (og.images as OgImage[]) || []) {
    ogTags.push(['og:image', abs(image.url)])
    if (image.width) ogTags.push(['og:image:width', String(image.width)])
    if (image.height) ogTags.push(['og:image:height', String(image.height)])
    if (image.alt) ogTags.push(['og:image:alt', image.alt])
  }
  for (const l of (og.alternateLocale as string[]) || []) ogTags.push(['og:locale:alternate', l])
  ogTags.push(['og:type', String(og.type)])

  const twTags: [string, string][] = [
    ['twitter:card', String(tw.card)],
    ['twitter:site', String(tw.site)],
    ['twitter:creator', String(tw.creator)],
    ['twitter:title', String(tw.title)],
    ['twitter:description', String(tw.description)],
  ]
  for (const image of (tw.images as string[]) || []) twTags.push(['twitter:image', abs(image)])

  return {
    title,
    description: String(meta.description),
    noindex: robots?.index === false,
    canonical: abs(alt.canonical),
    languages: Object.entries(alt.languages).map(([lang, url]) => [lang, abs(url)]),
    og: ogTags,
    twitter: twTags,
  }
}
