import Common from '@/components/layout/Common'
import { getNewsItem, getNewsItems } from '@/libs/content'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import ReactMarkdown from 'react-markdown'
import { HiCalendar } from 'react-icons/hi'
import type { Metadata } from 'next'
import { pageMetadata } from '@/libs/metadata'

// locale も含めて組み合わせを返す。slug だけを返していたときは locale が
// 動的なままで、静的生成の指定と食い違い、本番で 500 になっていた。
export function generateStaticParams() {
  const items = getNewsItems('ja')
  return routing.locales.flatMap((locale) =>
    items.map((item) => ({ locale, slug: item.slug })),
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  const { locale, slug } = await params
  const item = getNewsItem(slug, locale)
  if (!item) return {}
  return pageMetadata(locale, {
    path: `/news/${slug}`,
    title: item.title,
    description: item.body.replace(/[#*_>\[\]()`]/g, ''),
    type: 'article',
  })
}

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  // 静的生成するページでは、翻訳を引く前にこれを呼ぶ決まりになっている
  // (呼ばないと翻訳がリクエストのヘッダーを読みにいき、動的扱いになる)。
  setRequestLocale(locale)
  const t = await getTranslations('NewsPage')
  const item = getNewsItem(slug, locale)

  if (!item) notFound()

  const breadcrumbs = [
    { href: '/news', label: t('title') },
  ]

  return (
    <Common title={item.title} breadcrumbs={breadcrumbs}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-center text-ink-muted mb-8 -mt-6">
          <HiCalendar className="w-5 h-5 mr-2" aria-hidden="true" />
          <time dateTime={item.date} className="font-display tabular-nums">
            {item.date}
          </time>
        </div>

        <article className="prose prose-gray dark:prose-invert prose-lg max-w-none">
          <ReactMarkdown>{item.body}</ReactMarkdown>
        </article>
      </div>
    </Common>
  )
}
