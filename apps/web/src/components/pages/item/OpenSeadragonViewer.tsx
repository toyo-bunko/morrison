'use client'

import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react'
import { IMAGE_FORMAT } from '@/libs/iiif-image'

/**
 * Minimal OpenSeadragon viewer for a single IIIF info.json. Loaded client-side
 * because OpenSeadragon touches `window`.
 *
 * Optional `highlights` overlays bounding-box rectangles on the source image,
 * used by BookViewer to show OCR line matches for an in-page `?q=` term.
 * Coordinates are in OCR-image pixels (the ALTO page space); the viewer scales
 * them to source-image pixels via OpenSeadragon's `imageToViewportRectangle`,
 * so the two resolutions need not match.
 *
 * The imperative handle exposes `zoomToBox` so the parent can drive
 * "click match → zoom to that line" without re-rendering the whole tree.
 *
 * (Modeled on the mirai-web viewer; the parent switches pages by changing
 * `infoUrl` + remounting via `key`, so this stays single-image.)
 */
export type ViewerHighlight = {
  /** Stable id, used as React key and for focus matching. */
  id: string
  /** OCR-image pixel coords (origin top-left). */
  x: number
  y: number
  w: number
  h: number
}

export interface ViewerApi {
  zoomToBox(box: { x: number; y: number; w: number; h: number }): void
}

interface ViewerProps {
  infoUrl: string
  className?: string
  /** OCR-image pixel dims that `highlights` are expressed in. If absent,
   *  highlights are interpreted directly as source-image pixels. */
  highlightImageWidth?: number | null
  highlightImageHeight?: number | null
  highlights?: ViewerHighlight[]
  /** When set, the matching highlight renders with a stronger fill/border so
   *  the parent can drive hover-sync from the sidebar list. */
  focusedHighlightId?: string | null
}

const OpenSeadragonViewer = forwardRef<ViewerApi, ViewerProps>(function OpenSeadragonViewer(
  {
    infoUrl,
    className = 'w-full h-[60vh] bg-black rounded-lg overflow-hidden',
    highlightImageWidth,
    highlightImageHeight,
    highlights,
    focusedHighlightId,
  },
  apiRef,
) {
  const ref = useRef<HTMLDivElement | null>(null)
  // OSD's instance type is large; keep it as `any` — the cast is local and we
  // only call the typed methods we need below.
  const viewerRef = useRef<any>(null)
  const highlightsRef = useRef<ViewerHighlight[]>(highlights ?? [])
  highlightsRef.current = highlights ?? []
  const focusedRef = useRef<string | null>(focusedHighlightId ?? null)
  focusedRef.current = focusedHighlightId ?? null
  const ocrW = highlightImageWidth ?? null
  const ocrH = highlightImageHeight ?? null

  /** Convert OCR-image coords to source-image coords using the actual source
   *  size from OSD. Falls back to identity when no scale info. */
  const ocrToSource = (v: any, x: number, y: number, w: number, h: number) => {
    const item = v.world?.getItemAt?.(0)
    const size = item?.getContentSize?.()
    if (!size || !ocrW || !ocrH) return { x, y, w, h }
    const sx = size.x / ocrW
    const sy = size.y / ocrH
    return { x: x * sx, y: y * sy, w: w * sx, h: h * sy }
  }

  const drawOverlays = (v: any) => {
    if (!v?.viewport) return
    v.clearOverlays?.()
    const list = highlightsRef.current
    if (!list.length) return
    const focused = focusedRef.current
    for (const hl of list) {
      const src = ocrToSource(v, hl.x, hl.y, hl.w, hl.h)
      const rect = v.viewport.imageToViewportRectangle(src.x, src.y, src.w, src.h)
      const el = document.createElement('div')
      const isFocused = focused != null && hl.id === focused
      el.className = isFocused
        ? 'pointer-events-none border-2 border-rose-500 bg-rose-400/40 rounded-[2px] shadow-[0_0_0_2px_rgba(255,255,255,0.7)]'
        : 'pointer-events-none border-2 border-amber-400/90 bg-amber-300/20 rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,.4)]'
      v.addOverlay({ element: el, location: rect })
    }
  }

  useImperativeHandle(apiRef, () => ({
    zoomToBox(box) {
      const v = viewerRef.current
      if (!v?.viewport) return
      const src = ocrToSource(v, box.x, box.y, box.w, box.h)
      const rect = v.viewport.imageToViewportRectangle(src.x, src.y, src.w, src.h)
      // Inflate the OSD Rect in place so it keeps its prototype methods
      // (`getCenter`, etc. — `_fitBounds` relies on them).
      // 余白は行の高さを基準にする。以前は幅の 3 倍を左右に足していたので、
      // 横に長い本文の行ではページより広い範囲になり、寄らずに縮小していた。
      const padY = rect.height * 3
      const padX = Math.max(rect.width * 0.1, padY)
      rect.x -= padX
      rect.y -= padY
      rect.width += padX * 2
      rect.height += padY * 2
      v.viewport.fitBounds(rect)
    },
  }))

  // Bootstrap the viewer when the source URL changes.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const OpenSeadragon = (await import('openseadragon')).default
      if (cancelled || !ref.current) return

      // タイルを WebP で取る。画像サーバ (iipsrv 1.2) は jpg / png / webp を
      // 出せるが、info.json に `preferredFormats` を書かない。そこで info.json
      // を自分で取り、`preferredFormats` を足した形で OSD に渡す。OSD はこれを
      // 見て `tileFormat` を webp にする (openseadragon 6.0.2)。タイル 1 枚は
      // 3,713 → 937 バイトになった (2026-09-14 実測)。
      // 取得に失敗したときは URL をそのまま渡す (従来どおり jpg になる)。
      let tileSources: string | Record<string, unknown> = infoUrl
      if (IMAGE_FORMAT === 'webp') {
        try {
          const info = await fetch(infoUrl).then(r => (r.ok ? r.json() : null))
          if (info) tileSources = { ...info, preferredFormats: ['webp'] }
        } catch {
          // そのまま infoUrl を使う
        }
      }
      if (cancelled || !ref.current) return

      const v = OpenSeadragon({
        element: ref.current,
        prefixUrl: 'https://cdn.jsdelivr.net/npm/openseadragon@6.0.2/build/openseadragon/images/',
        tileSources,
        showNavigator: false,
        showRotationControl: true,
        gestureSettingsMouse: { clickToZoom: false, dblClickToZoom: true },
        // Default maxZoomPixelRatio (1.1) caps fitBounds so a small region
        // can't fill the viewport. Bump it so zoomToBox can frame one line.
        maxZoomPixelRatio: 8,
        // The default (1) queues one new tile per frame, so a Retina-sized
        // view (~180 tiles) took ~4 s to fill even after the tiles arrived.
        maxTilesPerFrame: 10,
      })
      viewerRef.current = v
      // OSD's viewport is only valid after the tile source opens.
      v.addHandler('open', () => drawOverlays(v))
    })()
    return () => {
      cancelled = true
      viewerRef.current?.destroy?.()
      viewerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [infoUrl])

  // Redraw overlays when highlights OR the focused id change, without
  // recreating OSD.
  const highlightsKey = JSON.stringify(highlights ?? [])
  useEffect(() => {
    const v = viewerRef.current
    if (!v) return
    drawOverlays(v)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightsKey, ocrW, ocrH, focusedHighlightId])

  return <div ref={ref} className={className} role="img" aria-label="高解像度画像ビューア" />
})

export default OpenSeadragonViewer
