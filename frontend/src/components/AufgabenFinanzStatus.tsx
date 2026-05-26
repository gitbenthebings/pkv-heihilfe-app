import type { CSSProperties } from 'react'
import { TrendingUp, TrendingDown, Zap, Shield, AlertTriangle } from 'lucide-react'
import type { FinanzKennzahlen, BrePersonStatus } from '../utils/finanzStatus'
import { useJahr } from '../context/JahrContext'

function formatEuro(v: number) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface KachelVars {
  bg: string; border: string; text: string; val: string
}

interface KachelProps {
  label: string
  wert: number
  count?: number
  vars: KachelVars
  diff?: number | null
  dimmed?: boolean
}

function Kachel({ label, wert, count, vars, diff, dimmed }: KachelProps) {
  const hasDiff = diff !== undefined && diff !== null && wert > 0
  const diffPos = hasDiff && diff! >= 0

  const style: CSSProperties = {
    background: vars.bg,
    border: `1px solid ${vars.border}`,
    borderRadius: 8,
    padding: '10px 12px',
    flex: 1,
    minWidth: 0,
    opacity: dimmed || wert === 0 ? 0.45 : 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  }

  return (
    <div style={style}>
      <div style={{ fontSize: 10, color: vars.text, fontWeight: 500, lineHeight: 1.3 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: vars.val, letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {formatEuro(wert)}
      </div>
      {count !== undefined && (
        <div style={{ fontSize: 9, color: vars.text, opacity: 0.5 }}>{count} Rechnung{count !== 1 ? 'en' : ''}</div>
      )}
      {hasDiff && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: diffPos ? 'var(--green)' : 'var(--rose)', fontVariantNumeric: 'tabular-nums' }}>
          {diffPos ? <TrendingUp style={{ width: 11, height: 11 }} /> : <TrendingDown style={{ width: 11, height: 11 }} />}
          <span>{diffPos ? '+' : ''}{formatEuro(diff!)}</span>
        </div>
      )}
    </div>
  )
}

// ─── BRE row ──────────────────────────────────────────────────────────────────

const EMP_CFG = {
  einreichen:            { icon: Zap,           cls: 'text-green-500 dark:text-green-400',  title: 'Schwelle erreichbar – einreichen' },
  schonen:               { icon: Shield,         cls: 'text-blue-500 dark:text-blue-400',    title: 'Schwelle nicht erreichbar – BRE schonen' },
  bereits_ueberschritten:{ icon: AlertTriangle,  cls: 'text-red-500 dark:text-red-400',     title: 'BRE-Schwelle bereits überschritten' },
  keine_schwelle:        null,
} as const

function BREZeile({ status }: { status: BrePersonStatus }) {
  const { person, breSchwelle, pkvNochNichtEingereicht, pkvBereitsEingereichtJahr, pkvGesamtPotenzialJahr, empfehlung } = status
  const cfg = EMP_CFG[empfehlung]
  if (!cfg || !breSchwelle) return null

  const totalPct = Math.min(100, (pkvGesamtPotenzialJahr / breSchwelle) * 100)
  const einPct   = Math.min(totalPct, (pkvBereitsEingereichtJahr / breSchwelle) * 100)
  const offenPct = totalPct - einPct
  const EmpIcon  = cfg.icon

  return (
    <div style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }} className="last:border-0">
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)', width: 80, flexShrink: 0 }} className="truncate sm:w-24">
          {person.name}
        </span>
        <div style={{ flex: 1, height: 5, background: 'var(--progress-bg)', borderRadius: 3, overflow: 'hidden' }}>
          <div className="flex h-full">
            {einPct   > 0 && <div style={{ width: `${einPct}%`,   background: 'var(--primary)', opacity: 0.7 }} />}
            {offenPct > 0 && <div style={{ width: `${offenPct}%`, background: 'var(--progress-fill)' }} />}
          </div>
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 28, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(totalPct)}%
        </span>
        <span title={cfg.title}>
          <EmpIcon className={`w-3.5 h-3.5 shrink-0 ${cfg.cls}`} />
        </span>
      </div>
      <div className="flex gap-3 mt-0.5 ml-[5.5rem] sm:ml-24" style={{ fontSize: 10, color: 'var(--text-subtle)', fontVariantNumeric: 'tabular-nums' }}>
        <span>offen {formatEuro(pkvNochNichtEingereicht)}</span>
        <span>eingereicht {formatEuro(pkvBereitsEingereichtJahr)}</span>
        <span className="hidden sm:inline">Schwelle {formatEuro(breSchwelle)}</span>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  kennzahlen: FinanzKennzahlen
}

const STAT_VARS: KachelVars[] = [
  { bg: 'var(--stat-open-bg)',      border: 'var(--stat-open-border)',     text: 'var(--stat-open-text)',     val: 'var(--stat-open-val)' },
  { bg: 'var(--stat-paid-bg)',      border: 'var(--stat-paid-border)',     text: 'var(--stat-paid-text)',     val: 'var(--stat-paid-val)' },
  { bg: 'var(--stat-bh-bg)',        border: 'var(--stat-bh-border)',       text: 'var(--stat-bh-text)',       val: 'var(--stat-bh-val)' },
  { bg: 'var(--stat-bh-paid-bg)',   border: 'var(--stat-bh-paid-border)',  text: 'var(--stat-bh-paid-text)',  val: 'var(--stat-bh-paid-val)' },
  { bg: 'var(--stat-pkv-bg)',       border: 'var(--stat-pkv-border)',      text: 'var(--stat-pkv-text)',      val: 'var(--stat-pkv-val)' },
  { bg: 'var(--stat-pkv-paid-bg)',  border: 'var(--stat-pkv-paid-border)', text: 'var(--stat-pkv-paid-text)', val: 'var(--stat-pkv-paid-val)' },
]

export default function AufgabenFinanzStatus({ kennzahlen }: Props) {
  const { jahr } = useJahr()
  const {
    offenBetrag, bezahltBetrag,
    beihilfeAusstehendBetrag, beihilfeErstattetBetrag, beihilfeDifferenz,
    pkvAusstehendBetrag, pkvErstattetBetrag, pkvDifferenz,
    eigenanteilBetrag,
    breStatus,
  } = kennzahlen

  const kacheln = [
    { label: 'Offen',               wert: offenBetrag,              vars: STAT_VARS[0] },
    { label: 'Bezahlt',             wert: bezahltBetrag,            vars: STAT_VARS[1] },
    { label: 'Beihilfe ausst.',     wert: beihilfeAusstehendBetrag, vars: STAT_VARS[2] },
    { label: 'Beihilfe erst.',      wert: beihilfeErstattetBetrag,  vars: STAT_VARS[3], diff: beihilfeErstattetBetrag > 0 ? beihilfeDifferenz : null },
    { label: 'PKV ausst.',          wert: pkvAusstehendBetrag,      vars: STAT_VARS[4] },
    { label: 'PKV erst.',           wert: pkvErstattetBetrag,       vars: STAT_VARS[5], diff: pkvErstattetBetrag > 0 ? pkvDifferenz : null },
  ]

  return (
    <div className="space-y-3">
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {kacheln.map(k => (
          <Kachel key={k.label} {...k} dimmed={k.wert === 0} />
        ))}
      </div>

      {eigenanteilBetrag > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Eigenanteil (vollständig abgerechnet)
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
            {formatEuro(eigenanteilBetrag)}
          </span>
        </div>
      )}

      {breStatus.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            PKV-Beitragsrückerstattung {jahr}
          </p>
          {breStatus.map(s => <BREZeile key={s.person.id} status={s} />)}
        </div>
      )}
    </div>
  )
}
