/**
 * Worker の入口。OpenNext が作る `.open-next/worker.js` の手前で、描画結果を
 * Cloudflare のキャッシュ（Cache API、データセンターごと）に置いて使い回す。
 *
 * なぜ要るか: 1 ページの描画に 30〜50ms の CPU を使う。Workers 無料枠の上限は
 * 1 回 10ms で、2026-10-02 には本番が 503（error 1102）を返すようになった。
 * 独自ドメインの Worker は Cloudflare のふつうのキャッシュより手前で動くので、
 * キャッシュルールでは防げない。ここで当たれば Next.js を起動せずに返せる。
 *
 * 置くもの: GET の 200 で、HTML か RSC（画面遷移で取るページの中身）だけ。
 * 置かないもの: /api/*・/_next/*・Basic 認証が掛かっているとき・Cookie を返す応答。
 * デプロイのたびに版の ID がキーに入るので、古い HTML が新しい版に混ざらない。
 */
// `.open-next/worker.js` はビルド時に作られる（型も無い）
// @ts-ignore
import { default as handler } from './.open-next/worker.js'

/** Workers の型を入れていないので、使う分だけ書く。 */
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
}

interface Env {
  CF_VERSION_METADATA?: { id: string }
  BASIC_AUTH_USER?: string
  BASIC_AUTH_PASSWORD?: string
  [key: string]: unknown
}

/** キャッシュに置いておく時間（秒）。資料の内容はほとんど変わらない。 */
const EDGE_TTL = 60 * 60 * 24

/** RSC の応答はこれらの値で中身が変わる。キーに含める。 */
const RSC_HEADERS = ['rsc', 'next-router-state-tree', 'next-router-prefetch', 'next-router-segment-prefetch', 'next-url']

export function isCacheable(request: Request, env: Env): boolean {
  if (request.method !== 'GET') return false
  if (env.BASIC_AUTH_USER && env.BASIC_AUTH_PASSWORD) return false
  if (request.headers.has('authorization')) return false
  const { pathname } = new URL(request.url)
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) return false
  return true
}

export function cacheKey(request: Request, version: string): Request {
  const url = new URL(request.url)
  url.searchParams.set('__v', version)
  for (const h of RSC_HEADERS) {
    const v = request.headers.get(h)
    if (v !== null) url.searchParams.set(`__h_${h}`, v)
  }
  return new Request(url.toString(), { method: 'GET' })
}

function isStorable(response: Response): boolean {
  if (response.status !== 200) return false
  if (response.headers.has('set-cookie')) return false
  const type = response.headers.get('content-type') || ''
  return type.startsWith('text/html') || type.startsWith('text/x-component')
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (!isCacheable(request, env)) return handler.fetch(request, env, ctx)

    const cache = (caches as unknown as { default: Cache }).default
    const key = cacheKey(request, env.CF_VERSION_METADATA?.id ?? 'dev')
    const hit = await cache.match(key)
    if (hit) {
      const res = new Response(hit.body, hit)
      res.headers.set('x-edge-cache', 'HIT')
      return res
    }

    const response: Response = await handler.fetch(request, env, ctx)
    if (!isStorable(response)) return response

    const stored = new Response(response.clone().body, response)
    stored.headers.set('cache-control', `public, s-maxage=${EDGE_TTL}`)
    ctx.waitUntil(cache.put(key, stored))

    const res = new Response(response.body, response)
    res.headers.set('x-edge-cache', 'MISS')
    return res
  },
}

export default worker
