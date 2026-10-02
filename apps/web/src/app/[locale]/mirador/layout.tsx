import type { Metadata } from 'next'

/**
 * Mirador のページは、URL の条件（?manifest=…）で開く資料が決まるビューアだけの画面。
 * 中身は資料ページと同じなので、検索エンジンには載せない（資料ページの重複になる）。
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function MiradorLayout({ children }: { children: React.ReactNode }) {
  return children
}
