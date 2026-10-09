import { describe, expect, it } from 'vitest'
import { BROWSER_CACHE_CONTROL, cacheKey, forBrowser, isCacheable, isStorable } from '../src/lib/edge-cache'

const get = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers })

describe('isCacheable', () => {
  it('資料ページの GET は置く', () => {
    expect(isCacheable(get('https://example.org/item/108000491'))).toBe(true)
    expect(isCacheable(get('https://example.org/en/item/108000491?q=史記'))).toBe(true)
  })
  it('API は置かない (API は別にキャッシュする)', () => {
    expect(isCacheable(get('https://example.org/api/item/1'))).toBe(false)
  })
  it('GET 以外と、認証つきは置かない', () => {
    expect(isCacheable(new Request('https://example.org/item/1', { method: 'POST' }))).toBe(false)
    expect(isCacheable(get('https://example.org/item/1', { authorization: 'Bearer x' }))).toBe(false)
  })
})

describe('cacheKey', () => {
  it('版の ID が違えば別の鍵になる', () => {
    const a = cacheKey(get('https://example.org/item/1'), 'v1').url
    const b = cacheKey(get('https://example.org/item/1'), 'v2').url
    expect(a).not.toBe(b)
    expect(a).toContain('__v=v1')
  })
  it('検索条件 (クエリ) が違えば別の鍵になる', () => {
    const a = cacheKey(get('https://example.org/item/1?page=1'), 'v1').url
    const b = cacheKey(get('https://example.org/item/1?page=2'), 'v1').url
    expect(a).not.toBe(b)
  })
})

describe('isStorable', () => {
  const html = (init: ResponseInit = {}) => new Response('<p>x</p>', { ...init, headers: { 'content-type': 'text/html; charset=utf-8', ...init.headers } })
  it('200 の HTML は置く', () => {
    expect(isStorable(html())).toBe(true)
  })
  it('404・500 は置かない', () => {
    expect(isStorable(html({ status: 404 }))).toBe(false)
    expect(isStorable(html({ status: 500 }))).toBe(false)
  })
  it('Cookie を返す応答と、HTML でない応答は置かない', () => {
    expect(isStorable(html({ headers: { 'set-cookie': 'a=b' } }))).toBe(false)
    expect(isStorable(new Response('{}', { headers: { 'content-type': 'application/json' } }))).toBe(false)
  })
})

describe('forBrowser', () => {
  it('ブラウザには毎回確かめさせ、HIT/MISS を付ける', () => {
    const res = forBrowser(new Response('x', { headers: { 'cache-control': 'public, s-maxage=604800' } }), 'HIT')
    expect(res.headers.get('cache-control')).toBe(BROWSER_CACHE_CONTROL)
    expect(res.headers.get('x-edge-cache')).toBe('HIT')
  })
})
