// 描画結果のキャッシュ。考え方は apps/web/worker.ts と同じ (そちらの説明を参照)。
// 違いは、Next を起動しないで済む分だけ軽いこと。入口は src/middleware.ts。

/** キャッシュに置いておく時間 (秒)。Next 版と同じ 1 日 (引用文の「参照日」がこれだけ古くなりうる)。デプロイのたびに版の ID が鍵に入る。 */
export const EDGE_TTL = 60 * 60 * 24

/**
 * ブラウザに渡す cache-control。キャッシュから取り出した応答には s-maxage しか無く、
 * Cloudflare がゾーンの既定 (4 時間) の max-age を足してしまう。
 * ブラウザには毎回確かめさせ、返すのはこのキャッシュにする。
 */
export const BROWSER_CACHE_CONTROL = 'public, max-age=0, must-revalidate'

/** 描画結果を置いてよい要求か。GET で、認証つきでなく、HTML のページ (API ではない) だけ。 */
export function isCacheable(request: Request): boolean {
  if (request.method !== 'GET') return false
  if (request.headers.has('authorization')) return false
  const { pathname } = new URL(request.url)
  return !pathname.startsWith('/api/')
}

/** 版の ID を入れた鍵。配り直すと別の鍵になる。 */
export function cacheKey(request: Request, version: string): Request {
  const url = new URL(request.url)
  url.searchParams.set('__v', version)
  return new Request(url.toString(), { method: 'GET' })
}

/** 置いてよい応答か。200 の HTML で、Cookie を返していないものだけ。 */
export function isStorable(response: Response): boolean {
  if (response.status !== 200) return false
  if (response.headers.has('set-cookie')) return false
  return (response.headers.get('content-type') || '').startsWith('text/html')
}

/** ブラウザに返す形に整える。 */
export function forBrowser(response: Response, status: 'HIT' | 'MISS'): Response {
  const res = new Response(response.body, response)
  res.headers.set('cache-control', BROWSER_CACHE_CONTROL)
  res.headers.set('x-edge-cache', status)
  return res
}
