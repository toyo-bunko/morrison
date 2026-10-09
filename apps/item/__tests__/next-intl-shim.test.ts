import { describe, expect, it } from 'vitest'
import { format } from '../src/shims/next-intl'

describe('next-intl の代わり (format)', () => {
  it('{name} を値で置き換える', () => {
    expect(format('{cur} / {total}', { cur: 2, total: 10 })).toBe('2 / 10')
    expect(format('「{q}」にヒットはありません。', { q: 'tea' })).toBe('「tea」にヒットはありません。')
  })
  it('値の無い差し込みはそのまま残す', () => {
    expect(format('他 {n} 件…')).toBe('他 {n} 件…')
    expect(format('{n}件', {})).toBe('{n}件')
  })
})
