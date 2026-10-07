import { routing } from './routing-config'
import { createNavigation } from 'next-intl/navigation'

export { routing }

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const { redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)

// リンクの先読みはマウスを載せたときだけにする (./link.tsx)
export { Link } from './link'
