import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import FeatureCards from '@/components/pages/home/FeatureCards'
import NewsList from '@/components/pages/news/NewsList'
import { Link } from '@/i18n/routing'
import { getTranslations } from 'next-intl/server'
import { getConfig } from '@/libs/getConfig'
import { getNewsItems } from '@/libs/content'
import { HiNewspaper, HiArrowNarrowRight } from 'react-icons/hi'
import type { Metadata } from 'next'
import { origin, pageMetadata } from '@/libs/metadata'
import { localizedUrl } from '@/libs/canonical-url'
import { jsonLdString } from '@/libs/item-seo'

/** How many entries the home page shows before linking to the full list. */
const NEWS_PREVIEW_COUNT = 3

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return pageMetadata(locale, { path: '/' })
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations('HomePage')
  const tNews = await getTranslations('NewsPage')
  const config = await getConfig(locale)
  const news = getNewsItems(locale).slice(0, NEWS_PREVIEW_COUNT)

  // 検索エンジンに「このサイトの名前と運営者」を伝える構造化データ。
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: config.siteName,
    url: localizedUrl(origin, locale, '/'),
    description: config.siteDescription,
    inLanguage: locale,
    publisher: { '@type': 'ArchiveOrganization', name: '東洋文庫 / Toyo Bunko', url: 'https://www.toyo-bunko.or.jp/' },
  }

  return (
    <div className="min-h-screen flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <Header />

      {/* flex-1 keeps the footer on the bottom edge when the page is shorter
          than the viewport. */}
      <main className="flex-1">
        {/* Hero section — photo-forward with a fixed enji wash (no theme flip).
          背景は本コレクションの資料そのもの。P-III-a-0073 "Map of China and its
          territories" (National Geographic Magazine 所載、Bartholomew 製図) の
          1 コマ目から、定規と余白を除いた中央部分を切り出したもの。差し替えるときは
          臙脂のグラデーションが上に乗る前提で、線の詰まった面を選ぶ。 */}
        <div className="relative bg-enji-900">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: 'url(/images/hero-bg.jpg)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-enji-950/45 via-enji-900/50 to-enji-950/80" />
          <div className="relative flex items-center justify-center px-4 sm:px-6 md:px-8 py-24 sm:py-32 md:py-40">
            <div className="w-full max-w-3xl mx-auto text-center space-y-6">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-balance text-white drop-shadow-lg">
                {config.siteName}
              </h1>
              <p className="text-lg sm:text-xl text-white/90 max-w-prose mx-auto leading-relaxed drop-shadow">
                {config.siteDescription}
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
                <Link
                  href="/search"
                  className="inline-flex items-center justify-center px-8 py-3 bg-white text-enji-700 font-sans font-medium rounded-full transition-all duration-300 transform hover:scale-105 hover:shadow-lg text-lg"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {t('startSearch')}
                </Link>
                <Link
                  href="/fulltext-search"
                  className="inline-flex items-center justify-center px-8 py-3 border border-white/70 text-white font-sans font-medium rounded-full transition-all duration-300 hover:bg-white/15 text-lg"
                >
                  {t('startFulltextSearch')}
                </Link>
              </div>
            </div>
          </div>
        </div>

        <FeatureCards />

        {/* News section */}
        <section className="bg-surface-sunken py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <span className="inline-flex items-center justify-center p-2 bg-brand-soft rounded-full mb-4">
                <HiNewspaper className="w-6 h-6 text-brand" aria-hidden="true" />
              </span>
              <h2 className="text-3xl font-bold text-ink mb-4">{t('newsTitle')}</h2>
              <p className="text-lg text-ink-muted max-w-2xl mx-auto">
                {t('newsDescription')}
              </p>
            </div>

            <div className="bg-surface-raised rounded-lg border border-line overflow-hidden">
              <NewsList items={news} emptyLabel={tNews('noNews')} />
            </div>

            <div className="text-center mt-8">
              <Link
                href="/news"
                className="inline-flex items-center gap-2 px-6 py-3 bg-surface-raised hover:bg-brand-soft rounded-full text-brand font-medium transition-all shadow-sm hover:shadow border border-brand"
              >
                <span>{t('viewAllNews')}</span>
                <HiArrowNarrowRight className="w-5 h-5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
