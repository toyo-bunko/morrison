'use client'

import { MiradorViewer } from '@toyo/shared-ui'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useLocale } from 'next-intl'

function MiradorFromQuery() {
  const searchParams = useSearchParams()
  const locale = useLocale()

  const manifestUrl = searchParams.get('iiif-content') || ''
  const canvasId = searchParams.get('canvas') || undefined
  const searchQuery = searchParams.get('q') || undefined

  if (!manifestUrl) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">No manifest URL provided.</p>
      </div>
    )
  }

  return (
    <MiradorViewer
      manifestUrl={manifestUrl}
      canvasId={canvasId}
      searchQuery={searchQuery}
      locale={locale}
    />
  )
}

/**
 * 表示する資料は URL のクエリで決まるので、クエリはブラウザで読む。
 * Suspense で包まないと、言語ごとの静的書き出し（SSG）が通らない。
 */
export default function MiradorPage() {
  return (
    <Suspense>
      <MiradorFromQuery />
    </Suspense>
  )
}
