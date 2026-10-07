import { defineRouting } from 'next-intl/routing'
import { defaultLocale, locales } from './config'

export const routing = defineRouting({
  // 対応言語と既定言語は ./config.ts が正本（URL 組み立て側と共有する）
  locales: [...locales],
  defaultLocale,

  // Default locale is accessible without prefix
  localePrefix: 'as-needed',

  // The URL alone decides the language: /en/... is English, everything else
  // is Japanese. With detection on, the NEXT_LOCALE cookie redirected
  // unprefixed URLs to /en — and link prefetches of /en/... pages rewrote
  // that cookie right after switching to Japanese, bouncing users back.
  localeDetection: false,

  // 言語は URL だけで決まるので、言語の Cookie は使わない。付けたままだと
  // 全ページの応答に Set-Cookie が載り、Cloudflare のキャッシュに置けない (worker.ts)。
  localeCookie: false,
})
