// next-intl の代わり。画像ビューア (BookViewer.tsx) が使う useTranslations だけを、
// 島に渡した文言から引く形で同じ動きにする。astro.config.mjs で差し替える。
// ビューアの文言は {n} のような差し込みだけで、複数形などの書式は無い (messages/*.json の Viewer)。
import { createContext, useContext, type ReactNode } from 'react'

type Messages = Record<string, Record<string, string>>

const MessagesContext = createContext<Messages>({})

export function NextIntlClientProvider({ messages, children }: { messages: Messages; children: ReactNode }) {
  return <MessagesContext.Provider value={messages}>{children}</MessagesContext.Provider>
}

/** `{name}` を値で置き換える。文言が無いときは next-intl と同じく「名前空間.鍵」を返す。 */
export function format(template: string, values?: Record<string, string | number>): string {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (all, name: string) => (name in values ? String(values[name]) : all))
}

export function useTranslations(namespace: string) {
  const messages = useContext(MessagesContext)[namespace] ?? {}
  return (key: string, values?: Record<string, string | number>) => {
    const template = messages[key]
    return template === undefined ? `${namespace}.${key}` : format(template, values)
  }
}
