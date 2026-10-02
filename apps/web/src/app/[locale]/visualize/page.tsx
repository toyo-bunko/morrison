/**
 * 可視化ページ。
 *
 * 収録している資料のかたちを図で見せ、図から検索に渡す入口を並べる。
 * 図を 1 枚足すときは、libs/stats.ts に集計を足し、部品を 1 つ作って、
 * ここに <Card> を 1 つ増やす。ほかは触らなくてよい。
 */

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import Common from '@/components/layout/Common'
import Card, { CountTable } from '@/components/pages/visualize/Card'
import ClassificationTreemap from '@/components/pages/visualize/ClassificationTreemap'
import CoverageMeters from '@/components/pages/visualize/CoverageMeters'
import EntityRanking from '@/components/pages/visualize/EntityRanking'
import Overview from '@/components/pages/visualize/Overview'
import RankingBars from '@/components/pages/visualize/RankingBars'
import YearHistogram from '@/components/pages/visualize/YearHistogram'
import { formatCount } from '@/libs/format'
import { authorHref } from '@/libs/search-link'
import { fetchStats } from '@/libs/stats-data'
import { pageMetadata } from '@/libs/metadata'

/**
 * 毎回その場で数える。
 *
 * 書き出し (ビルド) のときは検索エンジンに繋がらないため、静的に作ると 0 件の
 * ページが焼き付いてしまう。
 */
export const dynamic = 'force-dynamic'

/** 順位の図に出す数。これより下は「表で見る」に入る。 */
const AUTHOR_TOP_N = 20

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'VisualizePage' })
  return pageMetadata(locale, { path: '/visualize', title: t('title'), description: t('lead') })
}

export default async function VisualizePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'VisualizePage' })
  const stats = await fetchStats()

  if (stats.totalItems === 0) {
    return (
      <Common title={t('title')}>
        <p className="mx-auto max-w-prose text-center text-ink-muted">{t('unavailable')}</p>
      </Common>
    )
  }

  const authors = stats.authors.slice(0, AUTHOR_TOP_N)

  return (
    <Common title={t('title')}>
      <div className="mx-auto max-w-5xl space-y-8">
        <p className="mx-auto max-w-prose text-center leading-relaxed text-ink-muted">
          {t('lead')}
        </p>

        <Overview stats={stats} />

        <Card
          id="classification"
          title={t('classificationTitle')}
          lead={t('classificationLead')}
          note={t('classificationNote')}
          tableLabel={t('showTable')}
          table={
            <CountTable
              headers={[t('tableName'), t('tableCount')]}
              rows={stats.classifications.map((node) => ({
                key: node.key,
                label: node.key,
                count: formatCount(node.count),
              }))}
            />
          }
        >
          <ClassificationTreemap nodes={stats.classifications} />
        </Card>

        <Card
          id="years"
          title={t('yearTitle')}
          lead={t('yearLead')}
          tableLabel={t('showTable')}
          table={
            <CountTable
              headers={[t('tableName'), t('tableCount')]}
              rows={stats.years.map((bucket) => ({
                key: String(bucket.year),
                label: String(bucket.year),
                count: formatCount(bucket.count),
              }))}
            />
          }
        >
          <YearHistogram years={stats.years} missing={stats.yearsMissing} />
        </Card>

        <Card id="entities" title={t('entityTitle')} lead={t('entityLead')}>
          <EntityRanking entities={stats.entities} entityPages={stats.entityPages} />
        </Card>

        <Card
          id="authors"
          title={t('authorTitle')}
          lead={t('authorLead')}
          note={t('authorNote')}
          tableLabel={t('showTable')}
          table={
            <CountTable
              headers={[t('tableName'), t('tableCount')]}
              rows={stats.authors.map((author) => ({
                key: author.key,
                label: author.key,
                count: formatCount(author.count),
              }))}
            />
          }
        >
          <RankingBars
            rows={authors.map((author) => ({
              key: author.key,
              count: author.count,
              href: authorHref(author.key),
              ariaLabel: `${author.key} — ${t('itemsCount', { count: formatCount(author.count) })}`,
            }))}
            emptyLabel={t('noData')}
          />
        </Card>

        <Card
          id="coverage"
          title={t('coverageTitle')}
          lead={t('coverageLead')}
          note={t('coverageNote')}
        >
          <CoverageMeters nodes={stats.classifications} />
        </Card>
      </div>
    </Common>
  )
}
