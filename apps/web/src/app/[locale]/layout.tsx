import BackToTopButtonClient from '@/components/layout/BackToTopButtonClient'
import { GoogleAnalytics } from '@toyo/shared-ui'
import { BIZ_UDPGothic, BIZ_UDPMincho, EB_Garamond } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import './globals.css'

const GA_TAG_ID = process.env.NEXT_PUBLIC_GA_ID || ''

// Toyo Bunko web fonts. Phase 1: mirrors @toyo/design-system/fonts (inlined
// until the design-system package is wired as a dependency).
//
// preload: false — Google splits the Japanese faces into ~120 unicode-range
// files per weight, and next/font preloaded nearly all of them: 197 preload
// links, 245 files / 5.7 MB on every page, which held back the page's JS (the
// viewer started ~3.3 s in). Without preload the browser fetches only the
// ranges the rendered text actually uses.
const bizGothic = BIZ_UDPGothic({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
  variable: '--font-biz-gothic',
})

const bizMincho = BIZ_UDPMincho({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
  variable: '--font-biz-mincho',
})

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  preload: false,
  variable: '--font-eb-garamond',
})

import ThemeProvider from '@/theme/theme-provider'
import { Suspense } from 'react'
import { getDefaultMetadata } from '@/libs/metadata'
import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { locales } from '@/i18n/config'

/**
 * 対応言語か。言語の位置に別の語が来たとき（`/robots.txt` など）、それを言語として
 * 扱ってトップページを 200 で返していた（2026-10-02、`<html lang="robots.txt">`）。
 * 検索エンジンは robots.txt を読めず、存在しない URL も「ある」と見なす。
 */
function isLocale(v: string): boolean {
  return (locales as readonly string[]).includes(v)
}

/**
 * 言語ごとにビルド時に作る（SSG）。これと各ページの setRequestLocale が無いと、
 * next-intl は言語をアクセスから読むしかなく、全ページが毎回の描画になる。
 * 2026-10-02、1 ページ 30〜50ms の描画が Workers 無料枠の 10ms を超え、本番が 503 になった。
 */
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isLocale(locale)) return {}
  return await getDefaultMetadata(locale)
}

// Tints the mobile browser chrome to match the page surface in each scheme.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f0ed' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1a18' },
  ],
}

export default async function RootLayout({
  params,
  children,
}: {
  params: Promise<{ locale: string }>
  children: React.ReactNode
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const messages = await getMessages()

  return (
    // The font variables go on <html>: globals.css reads them in @theme, which
    // Tailwind emits on :root. On <body> they were undefined at :root, so the
    // whole --font-sans/--font-serif declaration was invalid and the site fell
    // back to the system font.
    <html
      lang={locale}
      className={`${bizGothic.variable} ${bizMincho.variable} ${ebGaramond.variable}`}
      suppressHydrationWarning
    >
      <head>{GA_TAG_ID ? (
        <Suspense>
          <GoogleAnalytics gaTagId={GA_TAG_ID} />
        </Suspense>
      ) : null}</head>
      <body className="font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider messages={messages}>
            {children}
            <BackToTopButtonClient />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
