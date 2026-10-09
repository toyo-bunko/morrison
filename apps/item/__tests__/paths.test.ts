import { describe, expect, it } from 'vitest'
import { isSafeId, itemPath, otherLocale, searchHref, withLocale } from '../src/lib/paths'

describe('withLocale', () => {
  it('日本語は接頭辞なし、英語は /en', () => {
    expect(withLocale('ja', '/search?q=China')).toBe('/search?q=China')
    expect(withLocale('en', '/search?q=China')).toBe('/en/search?q=China')
  })
  it('トップは英語で /en', () => {
    expect(withLocale('ja', '/')).toBe('/')
    expect(withLocale('en', '/')).toBe('/en')
  })
})

describe('itemPath / otherLocale', () => {
  it('資料ページの URL と、言語の切り替え先', () => {
    expect(itemPath('ja', 'P-I-a-0001')).toBe('/item/P-I-a-0001')
    expect(itemPath('en', 'P-I-a-0001')).toBe('/en/item/P-I-a-0001')
    expect(itemPath(otherLocale('ja'), '1')).toBe('/en/item/1')
    expect(itemPath(otherLocale('en'), '1')).toBe('/item/1')
  })
})

describe('isSafeId', () => {
  it('請求記号と旧 Omeka の数字の ID を通す', () => {
    expect(isSafeId('P-III-a-2189')).toBe(true)
    expect(isSafeId('99564')).toBe(true)
  })
  it('空・記号・長すぎる ID は弾く', () => {
    expect(isSafeId('')).toBe(false)
    expect(isSafeId('1/../2')).toBe(false)
    expect(isSafeId('1?x=2')).toBe(false)
    expect(isSafeId('a'.repeat(257))).toBe(false)
  })
})

describe('searchHref (検索に戻る)', () => {
  it('条件が無ければ /search', () => {
    expect(searchHref(new URLSearchParams(''))).toBe('/search')
  })
  it('検索画面の形 (n_<数>_n) に戻す。既定値 (1 ページ目・24 件) は付けない', () => {
    expect(searchHref(new URLSearchParams('q=tea&page=3&size=48&filters=x'))).toBe('/search?q=tea&current=n_3_n&size=n_48_n&filters=x')
    expect(searchHref(new URLSearchParams('q=tea&page=1&size=24'))).toBe('/search?q=tea')
  })
  it('ビューアの値 (docpage) は持ち越さない', () => {
    expect(searchHref(new URLSearchParams('docpage=5'))).toBe('/search')
  })
})
