import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { IMAGE_FORMAT } from '@/libs/iiif-image'

/**
 * 画面に出す画像の形式が 1 か所 (libs/iiif-image.ts の IMAGE_FORMAT) で
 * 決まっていることを確かめる試験。
 *
 * 2026-09-14 に画像サーバ (iipsrv 1.2) が WebP を出せるようになり、サムネイルと
 * OpenSeadragon のタイルを WebP に切り替えた。切り替えの対象が 3 か所に分かれて
 * いて、1 つ漏らすと「一覧は軽いが本文ビューアだけ重い」という気づきにくい形で
 * 残る。Cloudflare Workers では wrangler.jsonc の `vars` が process.env に
 * 入らないので、**本番で効くのはコード側の既定値**。だからここを見張る。
 *
 * IIIF の manifest と DTS が出す URL は除く。あれは外部のビューアが読むもので、
 * どこでも確実に開ける jpg のままにしておく。
 */

const SRC = join(process.cwd(), 'src')

/** jpg べた書きを許すファイル (外部に配る IIIF / DTS の出力)。 */
const ALLOWED = [
  'src/app/api/iiif/[version]/[id]/manifest/route.ts',
  'src/libs/dts.ts',
  // SNS の共有カード。WebP を読まない SNS があるので JPEG に固定している
  'src/libs/item-seo.ts',
]

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.(ts|tsx)$/.test(entry)) out.push(path)
  }
  return out
}

describe('画像形式', () => {
  it('既定は webp (環境変数で jpg に戻せる)', () => {
    expect(IMAGE_FORMAT).toBe(process.env.NEXT_PUBLIC_IMAGE_FORMAT || 'webp')
    expect(['webp', 'jpg']).toContain(IMAGE_FORMAT)
  })

  it('画面側のコードに default.jpg をべた書きしていない', () => {
    const offenders: string[] = []
    for (const file of walk(SRC)) {
      const rel = file.slice(file.indexOf('src/'))
      if (ALLOWED.includes(rel) || /\.test\.tsx?$/.test(rel)) continue
      if (/default\.jpg/.test(readFileSync(file, 'utf8'))) offenders.push(rel)
    }
    expect(
      offenders,
      `画像形式は @/libs/iiif-image の IMAGE_FORMAT を使うこと: ${offenders.join(', ')}`,
    ).toEqual([])
  })
})
