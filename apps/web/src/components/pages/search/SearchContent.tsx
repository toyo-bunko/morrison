'use client'

import { useState } from 'react'
import { ApiProxyConnector } from '@elastic/search-ui-elasticsearch-connector'
import { WithSearch } from '@elastic/react-search-ui'
import type { SearchContextState } from '@elastic/search-ui'
import { useTranslations, useLocale } from 'next-intl'
import { localeSegment } from '@/libs/canonical-url'

import { SearchUI, SearchBox } from '@toyo/shared-ui'
import type { FacetOption, SearchUITranslations } from '@toyo/shared-ui'
import { searchFields, resultFields } from '@/config/search'
import Thumb from '@/components/ui/Thumb'
import AdvancedSearch from './AdvancedSearch'
import { advancedFilterLabels, searchFacetOptions } from '@/config/facets'
import { SORT_OPTIONS, SORT_FIELD_CALL_NUMBER, parseSortValue, toSortValue } from '@/libs/sort-options'
import { mediaThumbUrl } from '@/libs/media-image'
import { BIB_INDEX } from '@/config/indices'

type ViewMode = 'list' | 'grid'

const indexName = BIB_INDEX

const connector = new ApiProxyConnector({
  basePath: `/api/${indexName}`,
})

interface SearchResult {
  title?: { raw: string; snippet?: string }
  description?: { raw: string; snippet?: string }
  abstract_en?: { raw: string; snippet?: string }
  abstract_ja?: { raw: string; snippet?: string }
  heading1?: { raw: string; snippet?: string }
  publication?: { raw: string; snippet?: string }
  format?: { raw: string }
  callNumber?: { raw: string }
  tag1?: { raw: string }
  holding?: { raw: string }
  has_image?: { raw: boolean | number }
  publication_year?: { raw: string }
  thumbnail_urls?: { raw: { small?: string; medium?: string; large?: string } }
  omeka_id?: { raw: number }
  id?: { raw: string }
}

function ViewToggle({ viewMode, onChange }: { viewMode: ViewMode; onChange: (mode: ViewMode) => void }) {
  const t = useTranslations('SearchPage')

  return (
    <div className="flex gap-1 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
      <button
        onClick={() => onChange('list')}
        className={`px-3 py-2.5 text-sm font-medium transition-colors ${
          viewMode === 'list'
            ? 'bg-brand text-white'
            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
        title={t('viewList')}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <button
        onClick={() => onChange('grid')}
        className={`px-3 py-2.5 text-sm font-medium transition-colors ${
          viewMode === 'grid'
            ? 'bg-brand text-white'
            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
        title={t('viewGrid')}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
        </svg>
      </button>
    </div>
  )
}

function SortSelector() {
  const t = useTranslations('SearchPage')

  return (
    <WithSearch
      mapContextToProps={({ sortField, sortDirection, setSort }: Partial<SearchContextState>) => ({
        sortField,
        sortDirection,
        setSort,
      })}
    >
      {({ sortField, sortDirection, setSort }: Partial<SearchContextState>) => {
        const currentSort = toSortValue(sortField, sortDirection)

        const handleSortChange = (value: string) => {
          const { field, direction } = parseSortValue(value)
          setSort?.(field, direction)
        }

        return (
          <div className="flex items-center gap-2">
            <label htmlFor="sort-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('sortByLabel')}
            </label>
            <div className="relative">
              <select
                id="sort-select"
                value={currentSort}
                onChange={(e) => handleSortChange(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-400/20 focus:border-amber-500 dark:focus:border-amber-400 cursor-pointer transition-all duration-200 text-sm font-medium shadow-sm"
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 dark:text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        )
      }}
    </WithSearch>
  )
}

// 件数表示は SearchUI 内蔵の PagingInfo が担うため、ここではソート＋ビュー切替のみ。
// SearchUI 側で表示件数セレクタと同じ行に並べられる。
function CustomPagingInfo({ viewMode, onViewModeChange }: { viewMode: ViewMode; onViewModeChange: (mode: ViewMode) => void }) {
  return (
    <div className="flex items-center gap-3">
      <SortSelector />
      <ViewToggle viewMode={viewMode} onChange={onViewModeChange} />
    </div>
  )
}

function Results({ viewMode }: { viewMode: ViewMode }) {
  const t = useTranslations('Search')
  const locale = useLocale()

  return (
    <WithSearch
      mapContextToProps={({ results, isLoading, searchTerm, current, resultsPerPage, filters }: Partial<SearchContextState>) => ({
        results, isLoading, searchTerm, current, resultsPerPage, filters
      })}
    >
      {(props: Partial<SearchContextState>) => {
        const { isLoading, searchTerm, current = 1, resultsPerPage = 24, filters = [] } = props
        const results = (props.results || []) as SearchResult[]
        if (isLoading) {
          return (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900 dark:border-neutral-300"></div>
            </div>
          )
        }

        if (!results || results.length === 0) {
          return (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">{t('noResults')}</p>
            </div>
          )
        }

        // Grid view
        if (viewMode === 'grid') {
          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
              {results.map((result, index) => {
                const title = result.title?.raw || ''
                const author = result.heading1?.raw
                const callNumber = result.callNumber?.raw
                const tag1 = result.tag1?.raw
                const hasImage = result.has_image?.raw
                const publicationYear = result.publication_year?.raw
                const thumbnailUrl = hasImage ? mediaThumbUrl(callNumber, 1, 400) : ''
                const id = result.id?.raw || `item-${index}`

                // Build search params for navigation
                const searchParams = new URLSearchParams()
                if (searchTerm) searchParams.set('q', searchTerm)
                searchParams.set('page', String(current))
                searchParams.set('size', String(resultsPerPage))
                searchParams.set('pos', String(index))
                if (filters && filters.length > 0) {
                  searchParams.set('filters', JSON.stringify(filters))
                }
                const queryString = searchParams.toString()

                return (
                  <a
                    key={id}
                    href={`${localeSegment(locale)}/item/${id}${queryString ? `?${queryString}` : ''}`}
                    className="block bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors overflow-hidden"
                  >
                    {/* Thumbnail: 余白付きで全体表示（判型がバラバラなのでトリミングしない） */}
                    {thumbnailUrl && <Thumb src={thumbnailUrl} alt={title} />}

                    <div className="p-3">
                      <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 hover:underline line-clamp-2 mb-2">
                        {result.title?.snippet ? (
                          <span dangerouslySetInnerHTML={{ __html: result.title.snippet }} />
                        ) : (
                          title || id
                        )}
                      </h3>

                      <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        {author && <div className="line-clamp-1">{author}</div>}
                        <div className="flex flex-wrap gap-x-2 gap-y-1">
                          {publicationYear && <span>{publicationYear}</span>}
                          {hasImage && (
                            <span className="text-green-500">
                              <svg className="w-3 h-3 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          {tag1 && <span className="text-xs line-clamp-1">{tag1}</span>}
                          {callNumber && <span className="text-xs">{callNumber}</span>}
                        </div>
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>
          )
        }

        // List view
        return (
          <div className="space-y-4">
            {results.map((result, index) => {
              const title = result.title?.raw || ''
              const author = result.heading1?.snippet || result.heading1?.raw
              const description = result.description?.snippet || result.description?.raw
              const abstractEn = result.abstract_en?.snippet || result.abstract_en?.raw
              const abstractJa = result.abstract_ja?.snippet || result.abstract_ja?.raw
              const publication = result.publication?.snippet || result.publication?.raw
              const callNumber = result.callNumber?.raw
              const tag1 = result.tag1?.raw
              const hasImage = result.has_image?.raw
              const publicationYear = result.publication_year?.raw
              const thumbnailUrl = hasImage ? mediaThumbUrl(callNumber, 1, 200) : ''
              const id = result.id?.raw || `item-${index}`

              // Collect all highlights for display
              const highlights: Array<{ label: string; content: string; isSnippet: boolean }> = []

              if (result.abstract_en?.snippet) {
                highlights.push({ label: 'OCR+AI Summary (EN)', content: result.abstract_en.snippet, isSnippet: true })
              }
              if (result.abstract_ja?.snippet) {
                highlights.push({ label: 'OCR+AI要約（日本語）', content: result.abstract_ja.snippet, isSnippet: true })
              }
              if (result.description?.snippet) {
                highlights.push({ label: 'Description', content: result.description.snippet, isSnippet: true })
              }
              if (result.publication?.snippet) {
                highlights.push({ label: 'Publication', content: result.publication.snippet, isSnippet: true })
              }

              // Build search params for navigation
              const searchParams = new URLSearchParams()
              if (searchTerm) searchParams.set('q', searchTerm)
              searchParams.set('page', String(current))
              searchParams.set('size', String(resultsPerPage))
              searchParams.set('pos', String(index))
              if (filters && filters.length > 0) {
                searchParams.set('filters', JSON.stringify(filters))
              }
              const queryString = searchParams.toString()

              return (
                // 資料ページは Astro の別 Worker (apps/item) が返す。Next の Link だと画面の切り替え用の
                // 形式 (RSC) を取りに行くので、普通のリンクにして全体を読み込み直す (先読みもしない)
                <a
                  key={id}
                  href={`${localeSegment(locale)}/item/${id}${queryString ? `?${queryString}` : ''}`}
                  className="block bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors overflow-hidden"
                >
                  <div className="flex">
                    {/* Thumbnail */}
                    {thumbnailUrl && (
                      <div className="shrink-0 w-24 sm:w-32 bg-gray-100 dark:bg-gray-700">
                        <img
                          src={thumbnailUrl}
                          alt={title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}

                    <div className="flex-1 p-4 min-w-0">
                      <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 hover:underline line-clamp-2">
                        {result.title?.snippet ? (
                          <span dangerouslySetInnerHTML={{ __html: result.title.snippet }} />
                        ) : (
                          title || id
                        )}
                      </h3>

                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        {author && (
                          <span>
                            {result.heading1?.snippet ? (
                              <span dangerouslySetInnerHTML={{ __html: author }} />
                            ) : (
                              author
                            )}
                          </span>
                        )}
                        {publicationYear && <span>{publicationYear}</span>}
                        {hasImage && (
                          <span className="text-green-500" title={t('hasImage')}>
                            <svg className="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </span>
                        )}
                      </div>

                      {/* Display all highlights */}
                      {highlights.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {highlights.map((highlight, hIndex) => (
                            <div key={hIndex} className="text-sm">
                              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                {highlight.label}:
                              </span>
                              <p className="text-gray-700 dark:text-gray-300 mt-0.5 line-clamp-2 search-results">
                                <span dangerouslySetInnerHTML={{ __html: highlight.content }} />
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="text-right text-xs text-gray-500 dark:text-gray-400 mt-2 flex flex-wrap justify-end gap-x-3">
                        {tag1 && (
                          <span>{tag1}</span>
                        )}
                        {callNumber && <span>{callNumber}</span>}
                      </div>
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        )
      }}
    </WithSearch>
  )
}

export default function SearchContent() {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const tFacet = useTranslations('Facet')
  const tSearch = useTranslations('SearchPage')

  const facetOptions: FacetOption[] = searchFacetOptions(tFacet)

  // Create translations object for shared-ui
  const translations: SearchUITranslations = {
    // SearchBox
    placeholder: tSearch('searchPlaceholder'),
    search: tSearch('search'),
    // PagingInfo
    searching: tSearch('searching'),
    quotationStart: tSearch('quotationStart'),
    quotationEnd: tSearch('quotationEnd'),
    noMatchFound: tSearch('noMatchFound'),
    noResultsAvailable: tSearch('noResultsAvailable'),
    showing: tSearch('showing'),
    of: tSearch('of'),
    items: tSearch('items'),
    searchKeyword: tSearch('searchKeyword'),
    maxResultsNote: tSearch('maxResultsNote'),
    // ResultsPerPage
    itemsPerPage: tSearch('itemsPerPage'),
    // Paging
    previous: tSearch('previous'),
    next: tSearch('next'),
    // ClearFilters
    reset: tSearch('reset'),
    // Filters
    yes: tSearch('yes'),
    no: tSearch('no'),
    // FacetHeader
    display: tSearch('display'),
    displaying: tSearch('displaying'),
    sortBy: tSearch('sortBy'),
    byCount: tSearch('byCount'),
    byName: tSearch('byName'),
    searchPlaceholder: tSearch('facetSearchPlaceholder'),
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="bg-enji-800 text-white py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl md:text-3xl font-bold text-center">
            {translations.search || '検索'}
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <SearchUI
          facetOptions={facetOptions}
          searchFields={searchFields}
          resultFields={resultFields}
          connector={connector}
          t={translations}
          themeColor="amber"
          sortField={SORT_FIELD_CALL_NUMBER}
          filterLabels={advancedFilterLabels(tSearch)}
        >
          {{
            searchForm: (
              <>
                <SearchBox t={translations} themeColor="amber" showSearchButton />
                <AdvancedSearch t={tSearch} />
              </>
            ),
            customControls: <CustomPagingInfo viewMode={viewMode} onViewModeChange={setViewMode} />,
            results: <Results viewMode={viewMode} />,
          }}
        </SearchUI>
      </div>
    </div>
  )
}
