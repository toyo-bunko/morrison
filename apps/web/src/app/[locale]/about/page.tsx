import Common from '@/components/layout/Common'
import { getContent } from '@/libs/content'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import ReactMarkdown from 'react-markdown'
import type { Metadata } from 'next'
import { pageMetadata } from '@/libs/metadata'

/** 解説の本文から、見出しと署名（見出しの次の段落）を除いた最初の段落を説明文にする。 */
function aboutLead(markdown: string): string | undefined {
  const paras = markdown
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith('#'))
  return paras[1] ?? paras[0]
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'AboutPage' })
  return pageMetadata(locale, { path: '/about', title: t('title'), description: aboutLead(getContent('about', locale)) })
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('AboutPage')
  const content = getContent('about', locale)

  // Remove the first heading line (rendered as page title via Common)
  const bodyContent = content.replace(/^#\s+.+\n+/, '')

  return (
    <Common title={t('title')}>
      <div className="max-w-3xl mx-auto">
        <article className="prose prose-gray dark:prose-invert prose-lg max-w-none">
          <ReactMarkdown>{bodyContent}</ReactMarkdown>
        </article>
      </div>
    </Common>
  )
}
