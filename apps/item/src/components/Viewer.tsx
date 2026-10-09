// 画像ビューアの島。中身は Next 版の BookViewer をそのまま使う (Next の部品は src/shims/ の代わりに差し替わる)。
// Next 版 ItemViewer.tsx と同じ外枠。ページ番号 (?docpage=) と強調する語 (?q=) は URL から読む。
// OCR 本文は島の props にせず、ページに置いた <script type="application/json"> から読む
// (props にすると Astro がもう一度直列化し、HTML も描画の CPU も増えるため)。
import BookViewer, { type OcrPage } from '@/components/pages/item/BookViewer'
import { NextIntlClientProvider } from 'next-intl'

export const OCR_PAGES_ELEMENT_ID = 'item-ocr-pages'

function readOcrPages(): OcrPage[] {
  try {
    return JSON.parse(document.getElementById(OCR_PAGES_ELEMENT_ID)?.textContent || '[]') as OcrPage[]
  } catch {
    return []
  }
}

export default function Viewer({ itemId, messages }: { itemId: string; messages: Record<string, string> }) {
  const params = new URLSearchParams(location.search)
  const docpage = params.get('docpage')
  return (
    <NextIntlClientProvider messages={{ Viewer: messages }}>
      <div className="rounded-lg overflow-hidden">
        <BookViewer
          itemId={itemId}
          ocrPages={readOcrPages()}
          initialPage={docpage ? Number(docpage) : undefined}
          query={params.get('q') ?? undefined}
        />
      </div>
    </NextIntlClientProvider>
  )
}
