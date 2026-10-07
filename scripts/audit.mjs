/**
 * `npm audit` の結果を判定する。high 以上があれば失敗する。
 *
 * `npm audit --audit-level=high` をそのまま使わないのは、直せない既知の 1 件で
 * CI が止まり続け、そのうち誰かが監査ごと外してしまうため。除外する場合は下の
 * ALLOW に「理由」と「期限」を書いて残す。期限を過ぎたら、除外が書いてあっても
 * 失敗させる。「なぜ放置しているのか」と「いつ見直すのか」が常にこのファイルに残る。
 *
 * 手本: cj_front_next/scripts/audit.mjs
 *
 * 使い方: node scripts/audit.mjs
 */
import { execFileSync } from 'node:child_process'

// --- 除外 (ALLOW) -----------------------------------------------------------
//
// 2026-09-08 の導入時点で存在していた 25 件は、2026-09-11 に lockfile を
// 更新して解消した (npm audit で 0 件)。2026-09-30 に下の 2 件を期限つきで除外した。
//
// 直せない 1 件で CI が止まり続けると、そのうち監査ごと外されてしまう。
// どうしても直せないものが出たときだけ、下の ALLOW に「理由」と「期限」を
// 書いて残す。期限を過ぎたら、除外が書いてあっても失敗する。
// 「なぜ放置しているのか」と「いつ見直すのか」が常にこのファイルに残る。

/** @type {{ id: string, package: string, until: string, reason: string }[]} */
const ALLOW = [
  // wrangler の手元確認用シミュレータ (miniflare) が undici を 7.29.0 に固定している。
  // 本番の Worker には入らない (開発時だけ使う)。直すには wrangler の新版が要るが、
  // 2026-09-30 時点の新版は公開当日で、新しすぎる版は取り込まない方針なので待つ。
  // 期限までに Dependabot の wrangler 更新で解消しているはず。
  { id: 'GHSA-rfgv-xxqx-mfg5', package: 'undici (miniflare)', until: '2026-10-31', reason: 'dev-only / wrangler pins exact version' },
  { id: 'GHSA-w293-vg96-wgc3', package: 'undici (miniflare)', until: '2026-10-31', reason: 'dev-only / wrangler pins exact version' },
  // braces は 2026-10-07 時点で上流に修正版が無い (最新の 3.0.3 でも直らない)。
  // eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces の
  // 経路で、lint のときの glob 展開にだけ使う。実行時に外からの入力を処理しない。
  // toyo-bunko/kanseki でも同じ理由で保留している。
  // sharp も同じく miniflare が 0.35.4 に固定している (2026-10-07)。next も sharp を持つが、
  // 使うのは自前サーバでの画像縮小だけで、Cloudflare の Worker には入らない。
  // overrides で 0.35.5 を指定しても npm が miniflare の固定を外さないため、wrangler の更新を待つ。
  { id: 'GHSA-wq5f-xc86-pv6w', package: 'sharp (miniflare)', until: '2026-10-31', reason: 'dev-only / wrangler pins exact version' },
  { id: 'GHSA-vfj7-8cjw-p6xm', package: 'braces', until: '2026-11-15', reason: 'lint only (eslint-config-next) / no upstream fix' },
]

function audit() {
  try {
    return JSON.parse(
      execFileSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    )
  } catch (error) {
    // 脆弱性があると npm audit は終了コード 1 を返す。出力は標準出力に出ている。
    if (error.stdout) return JSON.parse(error.stdout)
    throw error
  }
}

const today = new Date().toISOString().slice(0, 10)
const report = audit()
const serious = new Map()

for (const [name, entry] of Object.entries(report.vulnerabilities ?? {})) {
  if (entry.severity !== 'high' && entry.severity !== 'critical') continue
  for (const via of entry.via) {
    // 文字列の via は「脆弱なパッケージに依存しているだけ」の参照。根本 advisory だけ見る。
    if (typeof via !== 'object') continue
    if (via.severity !== 'high' && via.severity !== 'critical') continue
    const id = (via.url || '').split('/').pop()
    const allowed = ALLOW.find((a) => a.id === id || a.id === via.source)
    if (allowed && allowed.until >= today) continue
    const key = `${via.name || name}|${id}`
    if (serious.has(key)) continue
    serious.set(key, {
      name: via.name || name,
      severity: via.severity,
      title: via.title,
      url: via.url,
      expired: allowed ? allowed.until : null,
    })
  }
}

for (const a of ALLOW) {
  if (a.until < today) {
    console.error(`除外の期限切れ: ${a.package} (${a.id}) の期限 ${a.until} を過ぎています。見直してください。`)
  }
}

if (serious.size === 0) {
  const skipped = ALLOW.filter((a) => a.until >= today)
  console.log(`high 以上の脆弱性なし (期限内の除外 ${skipped.length} 件)`)
  for (const a of skipped) console.log(`  除外中: ${a.package} ${a.id} (期限 ${a.until})`)
  process.exit(0)
}

console.error(`high 以上の脆弱性が ${serious.size} 件あります:`)
for (const s of serious.values()) {
  const note = s.expired ? ` [除外の期限 ${s.expired} 切れ]` : ''
  console.error(`  ${s.severity.padEnd(8)} ${s.name}: ${s.title}${note}`)
  console.error(`           ${s.url}`)
}
process.exit(1)
