// どのページにも要る小さな動き。Next 版の React の部品 (ThemeProvider、Header の開閉、BackToTopButton) を、
// React なしで同じ動きにしたもの。
// 明暗の値は next-themes と同じ形で持つ (localStorage の 'theme' に light / dark / system)。他のページと共有される。

type Theme = 'light' | 'dark' | 'system'

const root = document.documentElement
const dark = matchMedia('(prefers-color-scheme: dark)')

function readTheme(): Theme {
  try {
    const t = localStorage.getItem('theme')
    if (t === 'light' || t === 'dark') return t
  } catch {
    // 保存できない環境 (プライベートモードなど) では system 扱い
  }
  return 'system'
}

function apply(theme: Theme) {
  const resolved = theme === 'system' ? (dark.matches ? 'dark' : 'light') : theme
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
  root.style.colorScheme = resolved
}

// 切り替えの瞬間だけ transition を止める (next-themes の disableTransitionOnChange)
function applyWithoutTransition(theme: Theme) {
  const style = document.createElement('style')
  style.textContent = '*{transition:none!important}'
  document.head.appendChild(style)
  apply(theme)
  getComputedStyle(document.body)
  setTimeout(() => style.remove(), 1)
}

document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
  button.addEventListener('click', () => {
    // next-themes と同じく、保存された値 (system を含む) が dark のときだけ light に戻す
    const next: Theme = readTheme() === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem('theme', next)
    } catch {
      // 保存できなくても、この画面の色は変える
    }
    applyWithoutTransition(next)
  })
})
// system のときは OS の設定の変更に、他のタブで変えたときはその値に追従する
dark.addEventListener('change', () => {
  if (readTheme() === 'system') apply('system')
})
window.addEventListener('storage', (e) => {
  if (e.key === 'theme') apply(readTheme())
})

// モバイルのメニュー
const menu = document.querySelector<HTMLElement>('[data-menu]')
document.querySelector('[data-menu-toggle]')?.addEventListener('click', () => {
  if (!menu) return
  const open = menu.classList.contains('hidden')
  menu.classList.toggle('hidden', !open)
  menu.classList.toggle('block', open)
  document.querySelector('[data-menu-icon="open"]')?.classList.toggle('hidden', open)
  document.querySelector('[data-menu-icon="close"]')?.classList.toggle('hidden', !open)
})

// ページ上部へ戻るボタン (300px より下にスクロールしたときだけ出す)
const toTop = document.querySelector<HTMLElement>('[data-back-to-top]')
if (toTop) {
  const toggle = () => toTop.classList.toggle('hidden', window.scrollY <= 300)
  window.addEventListener('scroll', toggle, { passive: true })
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }))
}
