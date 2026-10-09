import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // astro.config と同じく、@ は Next 側 (apps/web/src) を指す
  resolve: { alias: { '@': fileURLToPath(new URL('../web/src', import.meta.url)) } },
  test: { include: ['__tests__/**/*.test.ts'] },
})
