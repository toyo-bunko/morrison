'use client'

import { createNavigation } from 'next-intl/navigation'
import { useState, type ComponentProps } from 'react'
import { routing } from './routing-config'

const { Link: IntlLink } = createNavigation(routing)

type Props = ComponentProps<typeof IntlLink>

// 画面に入っただけのリンクは先読みしない。一覧に並ぶリンクを全部先読みすると、
// 1 ページ開くたびに Worker への問い合わせが何倍にも増えるため (Workers の無料枠は
// アカウント全体で 1 日 10 万件)。マウスを載せた (スマホでは触れた) ときだけ先読みする。
// Next.js の手引き (guides/prefetching の HoverPrefetchLink) と同じ形。
// prefetch を明示したリンクは、その指定に従う。
export function Link({ prefetch, onMouseEnter, onTouchStart, ...props }: Props) {
  const [active, setActive] = useState(false)
  return (
    <IntlLink
      {...props}
      prefetch={prefetch !== undefined ? prefetch : active ? null : false}
      onMouseEnter={(e) => {
        setActive(true)
        onMouseEnter?.(e)
      }}
      onTouchStart={(e) => {
        setActive(true)
        onTouchStart?.(e)
      }}
    />
  )
}
