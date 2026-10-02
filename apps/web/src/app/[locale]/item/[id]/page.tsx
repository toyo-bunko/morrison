import Common from '@/components/layout/Common'
import { getConfig } from '@/libs/getConfig'
import { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { cache, type ReactNode } from 'react'
import { origin, pageMetadata } from '@/libs/metadata'
import { itemDescription, itemJsonLd, itemOgImageUrl, jsonLdString } from '@/libs/item-seo'
import { getLocale, getTranslations } from 'next-intl/server'
import { createHeaders } from '@/libs/api'
import { esSearch } from '@toyo/shared-lib'
import { Link } from '@/i18n/routing'
import { itemUrl, localeSegment } from '@/libs/canonical-url'
import type { MorrisonItem } from '@/types/morrison'
import ItemViewer from '@/components/pages/item/ItemViewer'
import type { OcrPage } from '@/components/pages/item/BookViewer'
import ItemShareExport from '@/components/pages/item/ItemShareExport'
import { ensureEnv } from '@/libs/cf-env'
import { BIB_INDEX, PAGE_INDEX } from '@/config/indices'
import { itemHasFulltext } from '@/libs/fulltext'

const getData = cache(async (id: string): Promise<{ item: MorrisonItem | null; raw: Record<string, unknown> | null }> => {
  ensureEnv()
  const host = process.env.ES_URL || ''
  const index = BIB_INDEX

  try {
    const response = await fetch(`${host}/${index}/_doc/${id}`, {
      method: 'GET',
      headers: createHeaders(),
    })

    // 404 は「その資料は無い」。それ以外の失敗（検索サーバの停止など）は
    // 投げて 500 にする。404 で返すと、検索エンジンが資料ページを索引から外してしまう。
    if (response.status === 404) {
      return { item: null, raw: null }
    }
    if (!response.ok) {
      throw new Error(`Failed to fetch item ${id}: HTTP ${response.status}`)
    }

    const data = await response.json()
    if (!data.found) {
      return { item: null, raw: null }
    }

    return {
      item: {
        id: data._id,
        ...data._source,
      },
      raw: data._source,
    }
  } catch (error) {
    console.error('Failed to fetch item:', error)
    throw error
  }
})

// Page-level OCR *text* for every page of an item (keyed by omeka_id = the
// morrison OCR index's item_id). Text alone powers cross-page in-viewer search
// and the page list. The heavy per-line bounding boxes are deliberately NOT
// fetched here — the viewer lazy-loads the active page's boxes from the IIIF
// annotation endpoint (/api/iiif/3/:id/annotations/p:n), so opening an item no
// longer serializes every page's coordinates into the initial HTML.
const getOcrPages = cache(async (omekaId: string | number): Promise<OcrPage[]> => {
  ensureEnv()
  const ocrIndex = PAGE_INDEX
  try {
    const data = await esSearch(ocrIndex, {
      size: 2000,
      _source: ['page', 'text'],
      query: { term: { item_id: String(omekaId) } },
    })
    const hits = (data.hits?.hits || []) as Array<{
      _source: { page?: string | number; text?: string }
    }>
    // The OCR index can hold more than one doc per page (separate text / bbox
    // passes merged over time); keep the longest text per page number.
    const byPage = new Map<number, string>()
    for (const h of hits) {
      const page = Number(h._source.page)
      if (!Number.isFinite(page) || page < 1) continue
      const text = h._source.text ?? ''
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
})

/**
 * 旧 Omeka 版の数字の ID（`/item/99564`）から、いまの資料 ID（請求記号）を引く。
 *
 * 旧サイトの資料 URL は Cloudflare の転送規則で `/item/<元の続き>` へ送っている
 * （docs/cloudflare-redirect-setup.md）。請求記号の URL はそのまま当たるが、
 * 数字の ID の URL は「資料が見つかりません」になっていた（2026-10-02）。
 */
const findByOmekaId = cache(async (omekaId: string): Promise<string | null> => {
  ensureEnv()
  try {
    const data = await esSearch(BIB_INDEX, {
      size: 1,
      _source: false,
      query: { term: { omeka_id: Number(omekaId) } },
    })
    return data.hits?.hits?.[0]?._id ?? null
  } catch (error) {
    console.error('Failed to look up omeka_id:', error)
    return null
  }
})

/** 資料が無ければ、旧サイトの数字 ID として引き直して転送する。それも無ければ 404。 */
async function redirectOrNotFound(locale: string, id: string): Promise<never> {
  if (/^\d+$/.test(id)) {
    const current = await findByOmekaId(id)
    if (current) permanentRedirect(`${localeSegment(locale)}/item/${encodeURIComponent(current)}`)
  }
  notFound()
}

const getIndexLastUpdated = cache(async (): Promise<number | null> => {
  ensureEnv()
  const host = process.env.ES_URL || ''
  const index = BIB_INDEX

  try {
    const response = await fetch(`${host}/${index}/_settings`, {
      method: 'GET',
      headers: createHeaders(),
    })
    if (!response.ok) return null
    const data = await response.json()
    const raw = data?.[index]?.settings?.index?.creation_date
    if (!raw) return null
    return Number(raw)
  } catch {
    return null
  }
})

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}): Promise<Metadata> => {
  const { locale, id } = await params
  const { item } = await getData(id)
  if (!item) return redirectOrNotFound(locale, id)

  const title = item.title || id
  return pageMetadata(locale, {
    path: `/item/${id}`,
    // 資料名は長いものが多い（200 字を超えるものもある）。タブと検索結果で切れるので詰める。
    title: title.length > 80 ? `${title.slice(0, 79).trimEnd()}…` : title,
    description: itemDescription(item, locale),
    image: item.has_image ? { url: itemOgImageUrl(item.callNumber || id), alt: title } : undefined,
    type: 'article',
  })
}

/**
 * One bibliographic field (dt/dd). Renders nothing when empty, so callers can
 * list every field unconditionally. In the 2-column metadata grid, `wide`
 * fields (long text / URLs) span both columns; the rest pair up two-per-row.
 */
function MetaField({
  label,
  wide = false,
  valueClassName,
  children,
}: {
  label: string
  wide?: boolean
  valueClassName?: string
  children?: ReactNode
}) {
  if (children == null || children === '' || (Array.isArray(children) && children.length === 0)) {
    return null
  }
  return (
    <div
      className={`px-6 py-4 border-b border-gray-100 dark:border-gray-700/60 last:border-b-0 sm:grid sm:grid-cols-[7rem_1fr] sm:gap-4 ${
        wide ? 'lg:col-span-2' : ''
      }`}
    >
      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className={`mt-1 sm:mt-0 break-words text-sm text-gray-900 dark:text-gray-100 ${valueClassName ?? ''}`}>
        {children}
      </dd>
    </div>
  )
}

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ q?: string; page?: string; size?: string; pos?: string; filters?: string; docpage?: string }>
}) {
  const { id } = await params
  const resolvedSearchParams = await searchParams
  const locale = await getLocale()
  const t = await getTranslations('ItemPage')

  const [{ item, raw }, lastUpdatedMs, localeConfig] = await Promise.all([
    getData(id),
    getIndexLastUpdated(),
    getConfig(locale),
  ])

  // 「見つかりません」を 200 で返すと、検索エンジンは存在するページとして扱う。
  if (!item) return redirectOrNotFound(locale, id)

  const title = item.title || id

  // Build search URL with params preserved
  const searchUrlParams = new URLSearchParams()
  if (resolvedSearchParams.q) searchUrlParams.set('q', resolvedSearchParams.q)
  if (resolvedSearchParams.page && resolvedSearchParams.page !== '1') {
    searchUrlParams.set('current', `n_${resolvedSearchParams.page}_n`)
  }
  if (resolvedSearchParams.size && resolvedSearchParams.size !== '24') {
    searchUrlParams.set('size', `n_${resolvedSearchParams.size}_n`)
  }
  if (resolvedSearchParams.filters) {
    searchUrlParams.set('filters', resolvedSearchParams.filters)
  }
  const searchHref = `/search${searchUrlParams.toString() ? `?${searchUrlParams.toString()}` : ''}`

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''

  // IIIF manifest URL
  const manifestUrl = `${siteUrl}/api/iiif/3/${id}/manifest`
  const hasImages = item.has_image

  // OCR pages (text + line bboxes) for the in-viewer 本文検索 / highlight.
  const omekaId = raw?.omeka_id as string | number | undefined
  const ocrPages = hasImages && omekaId != null ? await getOcrPages(omekaId) : []

  // TEI/XML のダウンロードを出すかどうか。本文の正本は S3 の TEI で、
  // その在否は morrison_bib の has_fulltext に入っている。ページ単位の本文
  // (morrison 索引) の在否で判断すると、TEI があるのに入口が消える
  // (2026-09-11、分類 IV・VI〜XVII の約1,900件がこれで消えていた)。
  const hasFulltext = itemHasFulltext(item, ocrPages)

  const pageUrl = itemUrl(siteUrl, locale, id)
  const dateFormatter = new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const today = dateFormatter.format(new Date())
  const lastUpdatedText = lastUpdatedMs ? dateFormatter.format(new Date(lastUpdatedMs)) : null

  const citationParts = [
    item.heading1,
    item.title ? `"${item.title}"` : null,
    item.publication,
    item.publisher,
    item.callNumber ? `${t('callNumber')}: ${item.callNumber}` : null,
    localeConfig.siteName,
    `${pageUrl} (${t('accessed')} ${today})`,
  ].filter(Boolean)
  const citation = citationParts.join('. ') + '.'

  const jsonLd = itemJsonLd(item, {
    url: pageUrl,
    siteName: localeConfig.siteName,
    siteUrl: origin,
    description: itemDescription(item, locale),
    image: hasImages ? itemOgImageUrl(item.callNumber || id) : undefined,
  })

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <Common isFullWidth title={title} hideHeading>
        {/* IIIF Viewer (OpenSeadragon) — opens at the matched page and
            highlights the search term in-image when arriving from full-text search. */}
        {hasImages && (
          <ItemViewer
            itemId={id}
            ocrPages={ocrPages}
            initialPage={resolvedSearchParams.docpage ? Number(resolvedSearchParams.docpage) : undefined}
            searchQuery={resolvedSearchParams.q}
          />
        )}

        {/* Viewer and the metadata / share area below both span the full page
            width (the page is rendered with Common's full-width container). */}
        <div>

        {/* 画像なしアイテムはサムネ非表示(旧 Omeka files 依存を除去)。
            画像ありは上の IIIF ビューア(media. クリーンPTIF)が担当。 */}

        {/* Two columns below the viewer: bibliographic info on the left,
            share / export / citation panel on the right. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        {/* Left: bibliographic info */}
        <div className="lg:col-span-2 bg-surface-raised rounded-lg shadow-sm border border-line overflow-hidden">
          <div className="px-6 py-4 bg-surface-sunken border-b border-brand">
            <h2 className="text-lg font-bold text-ink">
              {t('bibliographicInfo')}
            </h2>
          </div>

          <dl>
            <MetaField label={t('title')} wide valueClassName="font-semibold">
              {item.title}
            </MetaField>
            <MetaField label={t('titleStatement')} wide>
              {item.titleStatement}
            </MetaField>
            <MetaField label={t('author')}>{item.heading1}</MetaField>
            <MetaField label={t('description')} wide>
              {item.description}
            </MetaField>
            <MetaField label={t('abstractEn')} wide>
              {item.abstract_en}
            </MetaField>
            <MetaField label={t('abstractJa')} wide>
              {item.abstract_ja}
            </MetaField>
            <MetaField label={t('language')}>
              {item.language && item.language.length > 0
                ? item.language.map((lang) => lang.toUpperCase()).join(', ')
                : null}
            </MetaField>
            <MetaField label={t('publication')}>{item.publication}</MetaField>
            <MetaField label={t('publisher')}>{item.publisher}</MetaField>
            <MetaField label={t('date')}>{item.date}</MetaField>
            <MetaField label={t('publicationYear')}>{item.publication_year}</MetaField>
            <MetaField label={t('format')}>{item.format}</MetaField>
            <MetaField label={t('callNumber')}>{item.callNumber}</MetaField>
            <MetaField label={t('classification')}>{item.tag1}</MetaField>
            <MetaField label={t('subClassification')}>
              {item.tag2 || item.tag3
                ? [item.tag2, item.tag3].filter(Boolean).join(' > ')
                : null}
            </MetaField>
            <MetaField label={t('holding')}>{item.holding}</MetaField>
            <MetaField label={t('isPartOf')} wide>
              {item.isPartOf
                ? item.isPartOf.startsWith('http')
                  ? (
                    <a
                      href={item.isPartOf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand hover:text-brand-strong underline"
                    >
                      {item.isPartOf}
                    </a>
                  )
                  : item.isPartOf
                : null}
            </MetaField>
            <MetaField label={t('references')} wide>
              {item.references
                ? item.references.startsWith('http')
                  ? (
                    <a
                      href={item.references}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand hover:text-brand-strong underline"
                    >
                      {item.references}
                    </a>
                  )
                  : item.references
                : null}
            </MetaField>
          </dl>
        </div>

        {/* Right: share / export / citation */}
        <div className="lg:col-span-1">
          <ItemShareExport
            itemId={id}
            title={title}
            pageUrl={pageUrl}
            manifestUrl={manifestUrl}
            hasImages={!!hasImages}
            hasFulltext={hasFulltext}
            citation={citation}
            labels={{
              heading: t('shareExportHeading'),
              exportGroup: t('exportGroup'),
              shareGroup: t('shareGroup'),
              citationGroup: t('citationGroup'),
              jsonApiExport: t('jsonApiExport'),
              teiExport: t('teiExport'),
              iiifManifest: t('iiifManifest'),
              copyLink: t('copyLink'),
              copyCitation: t('copyCitation'),
              copied: t('copied'),
              shareOnX: t('shareOnX'),
              shareOnFacebook: t('shareOnFacebook'),
              shareOnLine: t('shareOnLine'),
            }}
          />
        </div>
        </div>

        {/* Last updated */}
        {lastUpdatedText && (
          <div className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
            {t('lastUpdated')}: {lastUpdatedText}
          </div>
        )}

        {/* Back to search */}
        <div className="mt-6 text-center">
          <Link
            href={searchHref}
            className="inline-flex items-center text-sm text-brand hover:text-brand-strong"
          >
            <svg className="mr-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            {t('backToSearch')}
          </Link>
        </div>
        </div>
      </Common>
    </div>
  )
}
