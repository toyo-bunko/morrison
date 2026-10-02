import { Suspense } from 'react'
import { routing } from '@/i18n/routing'
import { setRequestLocale } from 'next-intl/server'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import SearchContent from '@/components/pages/search/SearchContent'
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
            検索
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
  const t = await getTranslations({ locale, namespace: 'SearchPage' })
  const home = await getTranslations({ locale, namespace: 'HomePage' })
  return pageMetadata(locale, { path: '/search', title: t('title'), description: home('featureSearchDescription') })
}

export default async function SearchPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Suspense fallback={<SearchLoading />}>
          <SearchContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
