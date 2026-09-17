import { describe, expect, it } from 'vitest'
import pageDims from './page-dims.json'

type Run = [first: number, count: number, width: number, height: number]
const items = (pageDims as unknown as { items: Record<string, Run[]> }).items

describe('page-dims.json', () => {
  it('どの資料もページが 1 以上・昇順・重なりなしで、寸法が正の数', () => {
    const broken: string[] = []
    for (const [cn, runs] of Object.entries(items)) {
      let next = 1
      for (const [first, count, width, height] of runs) {
        if (first < next || count < 1 || width <= 0 || height <= 0) broken.push(cn)
        next = first + count
      }
      if (runs.length === 0) broken.push(cn)
    }
    expect(broken).toEqual([])
  })

  it('画像のある資料の数が急に減っていない (一覧の作り直しで欠け落ちるのを防ぐ)', () => {
    expect(Object.keys(items).length).toBeGreaterThanOrEqual(8139)
  })
})

// 2026-09-16、pCloud で受け取った画像に差し替えた 29 件 (岡本先生の 9 件は保留中)
describe('pCloud で差し替えた資料', () => {
  const pages = (cn: string) => (items[cn] ?? []).reduce((n, [, count]) => n + count, 0)

  it.each([
    ['P-II-a-0206', 7], ['P-III-a-1103', 23], ['P-III-a-1199', 30], ['P-III-a-2101', 11],
    ['P-III-b-0077', 8], ['P-III-b-0079', 8], ['P-III-b-0273', 6], ['P-III-b-0857', 5],
    ['P-III-b-1166', 13], ['P-III-b-1225', 8], ['P-V-A-a-38', 8], ['P-V-A-a-42', 24],
    ['P-V-A-a-65', 36], ['P-V-A-a-66', 2], ['P-V-A-a-67', 11], ['P-V-A-a-76', 11],
    ['P-V-A-b-12', 6], ['P-V-A-b-19', 6], ['P-V-A-b-20', 6], ['P-V-A-b-24', 11],
    ['P-V-A-b-32', 8], ['P-V-A-b-48', 4], ['P-V-A-b-53', 7], ['P-V-A-b-55', 8],
    ['P-V-A-b-56', 4], ['P-V-A-b-6', 8], ['P-V-A-c-3', 5], ['P-VI-c-0002', 5],
    ['P-VII-a-0008', 10],
  ])('%s は %i ページ', (cn, expected) => {
    expect(pages(cn)).toBe(expected)
  })

  it('P-V-A-a-42 は、これまで画像が無かったが 1 ページ目から表示される', () => {
    expect(items['P-V-A-a-42']?.[0]?.[0]).toBe(1)
  })

  it('P-V-A-a-65 は第 1 部 (既存の 1〜16 枚目) を残し、17 枚目から新しい画像になる', () => {
    const runs = items['P-V-A-a-65']
    expect(runs[0]).toEqual([1, 16, 6616, 4680])
    expect(runs[1][0]).toBe(17)
    expect(runs[1][2]).not.toBe(6616)
  })
})
