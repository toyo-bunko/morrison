// 言語ごとの文言と設定。翻訳と設定は Next 版 (apps/web/src) のものをそのまま使う。
import ja from '@/messages/ja.json'
import en from '@/messages/en.json'
import configJa from '@/config.json'
import configEn from '@/config.en.json'
import type { Locale } from './paths'

export const messages = { ja, en }
export const configs = { ja: configJa, en: configEn }

export const getMessages = (locale: Locale) => messages[locale]
export const getConfig = (locale: Locale) => configs[locale]
