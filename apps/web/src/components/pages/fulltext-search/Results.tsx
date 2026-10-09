'use client'

import { withSearch } from '@elastic/react-search-ui'
import type { SearchResult } from '@elastic/search-ui'
import { useTranslations, useLocale } from 'next-intl'
import { useState } from 'react'
import { localeSegment } from '@/libs/canonical-url'

export type ViewMode = 'list' | 'grid'

interface ResultsProps {
  results: SearchResult[]
  searchTerm: string
  viewMode: ViewMode
}

function getRawValue(result: SearchResult, field: string): string {
  const val = result[field]?.raw
  if (val === undefined || val === null) return ''
  return String(val)
}

function ResultItem({ result, searchTerm, viewMode }: { result: SearchResult; searchTerm: string; viewMode: ViewMode }) {
  const t = useTranslations('FulltextSearchPage')
  const locale = useLocale()

  const callNumber = getRawValue(result, 'item_id') // callNumber as item ID
  const page = getRawValue(result, 'page')
  const textSnippet = getRawValue(result, 'text_snippet')
  const itemTitle = getRawValue(result, 'item_title')
  const author = getRawValue(result, 'author')
  const classification = getRawValue(result, 'classification')
  const pageThumbnailUrl = getRawValue(result, 'page_thumbnail_url')
  const itemThumbnailUrl = getRawValue(result, 'thumbnail_url')
  const hasImage = result['has_image']?.raw

  // ページ画像を優先し、404 (移行未完アイテム等) ならアイテム代表画像へフォールバック。
  // 失敗した URL を記録する方式: 結果が差し替わると pageThumbnailUrl が新 URL に
  // なり古い failedSrc と一致しなくなるため、effect 無しで自然にリセットされる。
  const [failedSrc, setFailedSrc] = useState('')
  const primaryThumb = pageThumbnailUrl || itemThumbnailUrl
  const thumbnailUrl =
    primaryThumb && primaryThumb === failedSrc ? itemThumbnailUrl : primaryThumb

  // 資料ページは Astro の別 Worker (apps/item) が返す。Next の Link だと画面の切り替え用の形式 (RSC) を
  // 取りに行くので、資料へのリンクは普通の <a> にして全体を読み込み直す (先読みもしない)。
  // Detail page URL: open the item viewer at the matched page (docpage) and
  // carry the search term (q) so it is highlighted in-image on arrival.
  const detailParams = new URLSearchParams()
  if (searchTerm) detailParams.set('q', searchTerm)
  if (page) detailParams.set('docpage', page)
  const detailQs = detailParams.toString()
  const detailUrl = `${localeSegment(locale)}/item/${callNumber}${detailQs ? `?${detailQs}` : ''}`
  // Some OCR hits have no bibliographic match (orphan pages not in morrison_bib),
  // so callNumber is empty. Those have no detail page — never link to `/item/`
  // (which collapses to `/item` and 404s); render them non-clickable instead.
  const hasDetail = callNumber !== ''

  // Grid view: ページ画像を主役にしたカード。カード全体が（画像があれば）ビューアへのリンク。
  if (viewMode === 'grid') {
    const cardClass =
      'group flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-neutral-400 dark:hover:border-neutral-500 hover:shadow-md transition-all overflow-hidden'
    const cardBody = (
      <>
        {/* Thumbnail: 余白付きで全体表示 */}
        <div className="relative aspect-[3/4] bg-gray-50 dark:bg-gray-900/40 flex items-center justify-center p-2">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={itemTitle}
              className="max-w-full max-h-full object-contain"
              loading="lazy"
              onError={() => {
                if (thumbnailUrl && thumbnailUrl !== itemThumbnailUrl) {
                  setFailedSrc(thumbnailUrl)
                }
              }}
            />
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">No image</span>
          )}
          {page && (
            <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/60 text-white">
              {t('page')}: {page}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col p-2.5">
          <div className="flex flex-wrap items-center gap-1 mb-1">
            {callNumber && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100">
                {callNumber}
              </span>
            )}
            {classification && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                {classification}
              </span>
            )}
          </div>
          {itemTitle && (
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:underline">
              {itemTitle}
            </h3>
          )}
          {textSnippet && (
            <p
              className="mt-1 text-xs text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3"
              dangerouslySetInnerHTML={{ __html: textSnippet }}
            />
          )}
        </div>
      </>
    )
    return hasDetail ? (
      <a href={detailUrl} className={cardClass}>
        {cardBody}
      </a>
    ) : (
      <div className={cardClass}>{cardBody}</div>
    )
  }

  // List view
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-4 hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        {/* Thumbnail */}
        {thumbnailUrl && (
          <div className="flex-shrink-0 flex justify-center sm:justify-start">
            <img
              src={thumbnailUrl}
              alt={itemTitle}
              className="h-24 sm:h-28 w-auto object-contain rounded border border-gray-200 dark:border-gray-600"
              loading="lazy"
              onError={() => {
                // 表示中の URL が item サムネ以外 (= page サムネ) なら失敗を記録し、
                // item サムネへ切り替える。item サムネ自体の失敗ではループしない。
                if (thumbnailUrl && thumbnailUrl !== itemThumbnailUrl) {
                  setFailedSrc(thumbnailUrl)
                }
              }}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header with badges */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
            <div className="flex flex-wrap items-center gap-2">
              {callNumber && (
                <a
                  href={detailUrl}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100 hover:bg-neutral-300 dark:hover:bg-neutral-600"
                >
                  {callNumber}
                </a>
              )}
              {page && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  {t('page')}: {page}
                </span>
              )}
              {classification && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                  {classification}
                </span>
              )}
            </div>
            {hasImage && hasDetail && (
              <a
                href={detailUrl}
                className="inline-flex items-center text-sm font-medium text-gray-900 hover:text-black dark:text-gray-200 dark:hover:text-white"
              >
                {t('viewInViewer')}
                <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>

          {/* Title */}
          {itemTitle && (
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {hasDetail ? (
                <a href={detailUrl} className="hover:text-black dark:hover:text-white">
                  {itemTitle}
                </a>
              ) : (
                <span>{itemTitle}</span>
              )}
              {author && (
                <span className="text-sm text-gray-500 dark:text-gray-400 font-normal ml-2">
                  {author}
                </span>
              )}
            </h3>
          )}

          {/* Text Snippet */}
          {textSnippet && (
            <div className="p-2 bg-gray-50 dark:bg-gray-900/60 rounded-md border-l-4 border-neutral-500 dark:border-neutral-400">
              <p
                className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: textSnippet }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CustomResults({ results, searchTerm, viewMode }: ResultsProps) {
  if (!results || results.length === 0) {
    return null
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
        {results.map((result, index) => (
          <ResultItem key={index} result={result} searchTerm={searchTerm} viewMode="grid" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {results.map((result, index) => (
        <ResultItem key={index} result={result} searchTerm={searchTerm} viewMode="list" />
      ))}
    </div>
  )
}

export default withSearch<
  { viewMode: ViewMode },
  { results: SearchResult[]; searchTerm: string }
>(({ results, searchTerm }) => ({
  results,
  searchTerm: searchTerm ?? '',
}))(CustomResults)
