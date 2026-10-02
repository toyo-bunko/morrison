import Common from '@/components/layout/Common'
import NewsList from '@/components/pages/news/NewsList'
import { getNewsItems } from '@/libs/content'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Metadata } from 'next'
import { pageMetadata } from '@/libs/metadata'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'NewsPage' })
  return pageMetadata(locale, { path: '/news', title: t('title') })
}

export default async function NewsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('NewsPage')
  const items = getNewsItems(locale)

  return (
    <Common title={t('title')}>
      <div className="max-w-3xl mx-auto">
        <div className="bg-surface-raised rounded-lg border border-line overflow-hidden">
          <NewsList items={items} emptyLabel={t('noNews')} />
        </div>
      </div>
    </Common>
  )
}
