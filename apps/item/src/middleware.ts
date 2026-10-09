// 描画結果を Cloudflare のキャッシュ (Cache API) に置いて使い回す。apps/web/worker.ts と同じ考え方。
// 当たれば Astro の描画も検索サーバへの問い合わせもしない。
import { defineMiddleware } from 'astro:middleware'
import { env } from 'cloudflare:workers'
import { EDGE_TTL, cacheKey, forBrowser, isCacheable, isStorable } from './lib/edge-cache'

export const onRequest = defineMiddleware(async (context, next) => {
  if (!isCacheable(context.request)) return next()

  const cache = (caches as unknown as { default: Cache }).default
  const version = (env as unknown as { CF_VERSION_METADATA?: { id: string } }).CF_VERSION_METADATA?.id ?? 'dev'
  const key = cacheKey(context.request, version)

  const hit = await cache.match(key)
  if (hit) return forBrowser(hit, 'HIT')

  const response = await next()
  if (!isStorable(response)) return response

  const stored = new Response(response.clone().body, response)
  stored.headers.set('cache-control', `public, s-maxage=${EDGE_TTL}`)
  context.locals.cfContext.waitUntil(cache.put(key, stored))
  return forBrowser(response, 'MISS')
})
