import { defineConfig } from 'astro/config'
import cloudflare from '@astrojs/cloudflare'
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// 書式の関数・型・翻訳・画像ビューアは Next 版 (apps/web/src) のものをそのまま読む (docs/astro-item-design.md)
const webSrc = fileURLToPath(new URL('../web/src', import.meta.url))
const shim = (name) => fileURLToPath(new URL(`./src/shims/${name}`, import.meta.url))

// Next と同じ名前のビルド時の環境変数を、コードの中の process.env.X に埋め込む。
// config/indices.ts や libs/metadata.ts は Next が同じように埋め込む前提で書かれているため。
const buildEnv = Object.fromEntries(
  ['NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_INDEX_NAME', 'FULLTEXT_INDEX_NAME', 'NEXT_PUBLIC_GA_ID'].map((name) => [
    `process.env.${name}`,
    JSON.stringify(process.env[name] ?? ''),
  ]),
)

export default defineConfig({
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough' }),
  integrations: [react()],
  // 利用者ごとの状態は持たない。セッションを有効にすると Cloudflare KV の置き場が自動で要求されるので切る
  session: false,
  build: {
    // CSS と島の JS の置き場。Workers の route は /item/* /en/item/* だけを
    // この Worker に渡すので、/_astro/ のままだと Next 側に届いて 404 になる。
    // /item/ の下に置けば、route を増やさずに済む。
    assets: 'item/_astro',
  },
  vite: {
    define: buildEnv,
    plugins: [tailwindcss()],
    resolve: {
      alias: [
        // 画像ビューア (BookViewer.tsx) は Next の部品に頼っている。Next 側は触らず、
        // ここで小さな代わりの部品に差し替えて、そのまま読み込む (src/shims/)
        { find: /^next\/navigation$/, replacement: shim('next-navigation.ts') },
        { find: /^next-intl$/, replacement: shim('next-intl.tsx') },
        { find: /^@\//, replacement: `${webSrc}/` },
      ],
    },
  },
})
