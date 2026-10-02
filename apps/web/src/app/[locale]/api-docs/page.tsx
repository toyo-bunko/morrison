import Common from '@/components/layout/Common'
import { getTranslations } from 'next-intl/server'
import SwaggerUIClient from './SwaggerUIClient'
import type { Metadata } from 'next'
import { pageMetadata } from '@/libs/metadata'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'ApiDocsPage' })
  const home = await getTranslations({ locale, namespace: 'HomePage' })
  return pageMetadata(locale, { path: '/api-docs', title: t('title'), description: home('featureApiDescription') })
}

export default async function ApiDocsPage() {
  const t = await getTranslations('ApiDocsPage')

  return (
    <Common title={t('title')}>
      <div className="max-w-5xl mx-auto">
        <p className="text-ink-muted mb-6">{t('description')}</p>
        <SwaggerUIClient />
      </div>
    </Common>
  )
}
