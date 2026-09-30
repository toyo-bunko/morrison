import { Link } from '@/i18n/routing'
import { getTranslations } from 'next-intl/server'
import {
  HiSearch,
  HiDocumentText,
  HiCode,
  HiChartPie,
  HiInformationCircle,
  HiArrowNarrowRight,
} from 'react-icons/hi'

/** The entry points into the database, shown as cards under the hero. */
export default async function FeatureCards() {
  const t = await getTranslations('HomePage')

  const features = [
    // 岡本隆司先生の紹介文（/about）を先頭に置く。東洋文庫からの依頼（2026-09-30）。
    {
      href: '/about',
      Icon: HiInformationCircle,
      title: t('featureAboutTitle'),
      description: t('featureAboutDescription'),
      cta: t('featureAboutCta'),
    },
    {
      href: '/search',
      Icon: HiSearch,
      title: t('featureSearchTitle'),
      description: t('featureSearchDescription'),
      cta: t('featureSearchCta'),
    },
    {
      href: '/fulltext-search',
      Icon: HiDocumentText,
      title: t('featureFulltextTitle'),
      description: t('featureFulltextDescription'),
      cta: t('featureFulltextCta'),
    },
    {
      href: '/visualize',
      Icon: HiChartPie,
      title: t('featureVisualizeTitle'),
      description: t('featureVisualizeDescription'),
      cta: t('featureVisualizeCta'),
    },
    {
      href: '/api-docs',
      Icon: HiCode,
      title: t('featureApiTitle'),
      description: t('featureApiDescription'),
      cta: t('featureApiCta'),
    },
  ]

  return (
    <section className="bg-surface py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-ink mb-4">{t('featuresTitle')}</h2>
          <p className="text-lg text-ink-muted max-w-2xl mx-auto leading-relaxed">
            {t('featuresDescription')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(({ href, Icon, title, description, cta }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col h-full p-6 rounded-lg bg-surface-raised border border-line hover:border-brand hover:shadow-md transition-all"
            >
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-soft text-brand mb-4">
                <Icon className="w-6 h-6" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-bold text-ink group-hover:text-brand transition-colors mb-2">
                {title}
              </h3>
              <p className="text-sm text-ink-muted leading-relaxed flex-1">
                {description}
              </p>
              <span className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-brand">
                {cta}
                <HiArrowNarrowRight
                  className="w-4 h-4 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
