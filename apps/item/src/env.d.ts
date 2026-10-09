/// <reference types="astro/client" />

// Cloudflare の Worker のバインディング (シークレットなど)。型は使う分だけ lib/es.ts と middleware.ts で当てる
declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>
}
