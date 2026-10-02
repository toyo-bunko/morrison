import { describe, expect, it } from 'vitest'
import { itemDescription, itemJsonLd, itemOgImageUrl, jsonLdString } from './item-seo'

const BASE = 'https://img.toyobunko-lab.jp/iiif'

describe('itemOgImageUrl', () => {
  it('1 ページ目を JPEG で 1200×630 の箱に収める', () => {
    expect(itemOgImageUrl('P-I-a-0001', BASE)).toBe(
      `${BASE}/morrison_p/P-I/P-I-a-0001/0001.tif/full/!1200,630/0/default.jpg`,
    )
  })

  it('丸括弧の入った請求記号はエンコードする', () => {
    expect(itemOgImageUrl('P-III-a-1999(5)', BASE)).toContain('P-III-a-1999(5)')
  })
})

describe('itemDescription', () => {
  it('日本語は日本語の解題を優先する', () => {
    expect(itemDescription({ id: 'x', abstract_ja: '和文', abstract_en: 'English' }, 'ja')).toBe('和文')
  })

  it('英語は英語の解題を優先する', () => {
    expect(itemDescription({ id: 'x', abstract_ja: '和文', abstract_en: 'English' }, 'en')).toBe('English')
  })

  it('その言語の解題が無ければ、もう一方を使う', () => {
    expect(itemDescription({ id: 'x', abstract_en: 'English' }, 'ja')).toBe('English')
  })

  it('解題が無ければ書誌の項目から作る', () => {
    const d = itemDescription({ id: 'x', publication: '1810.', callNumber: 'P-I-a-0001' }, 'ja')
    expect(d).toContain('東洋文庫')
    expect(d).toContain('請求記号: P-I-a-0001')
    expect(d).toContain('1810.')
  })
})

describe('itemJsonLd', () => {
  it('値の無い項目は載せない', () => {
    const ld = itemJsonLd(
      { id: 'P-I-a-0001', title: 'T', callNumber: 'P-I-a-0001' },
      { url: 'u', siteName: 's', siteUrl: 'o', description: 'd' },
    )
    expect(ld['@type']).toBe('ArchiveComponent')
    expect(ld.identifier).toBe('P-I-a-0001')
    expect(ld).not.toHaveProperty('creator')
    expect(ld).not.toHaveProperty('image')
  })
})

describe('jsonLdString', () => {
  it('script を閉じる並びを逃がす', () => {
    expect(jsonLdString({ a: '</script><b>' })).not.toContain('</script>')
  })
})
