// next/navigation の代わり。画像ビューア (apps/web/src/components/pages/item/BookViewer.tsx) が使う
// 3 つだけを、ブラウザの location と history で同じ動きにする。astro.config.mjs で差し替える。
// ビューアはブラウザだけで描く (client:only) ので、サーバでの値は考えなくてよい。

export function usePathname(): string {
  return location.pathname
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams(location.search)
}

/** router.replace(url, { scroll: false }) と同じく、画面を動かさずに URL だけを書き換える。 */
export function useRouter() {
  return {
    replace: (url: string, _opts?: { scroll?: boolean }) => history.replaceState(history.state, '', url),
  }
}
