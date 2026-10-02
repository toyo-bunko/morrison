import { Suspense } from 'react'
import { routing } from '@/i18n/routing'
import { setRequestLocale } from 'next-intl/server'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import FulltextSearch from '@/components/pages/fulltext-search'
import type { Metadata } from 'next'
import { pageMetadata } from '@/libs/metadata'
import { getTranslations } from 'next-intl/server'

// SSG support
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

function SearchLoading() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="bg-enji-800 text-white py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl md:text-3xl font-bold text-center">
            全文検索 / Fulltext Search
          </h1>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
        </div>
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'FulltextSearchPage' })
  const home = await getTranslations({ locale, namespace: 'HomePage' })
  return pageMetadata(locale, { path: '/fulltext-search', title: t('title'), description: home('featureFulltextDescription') })
}

export default async function FulltextSearchPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="bg-surface">
          <div className="bg-enji-800 text-white py-8">
            <div className="container mx-auto px-4">
              <h1 className="text-2xl md:text-3xl font-bold text-center">
                全文検索 / Fulltext Search
              </h1>
            </div>
          </div>

          <div className="container mx-auto px-4 py-8">
            <Suspense fallback={<SearchLoading />}>
              <FulltextSearch />
            </Suspense>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
