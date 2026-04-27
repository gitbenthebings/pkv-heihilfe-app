import {
  Clock, CheckCircle, Hourglass, TrendingUp, TrendingDown,
  Zap, Shield, AlertTriangle,
} from 'lucide-react'
import type { FinanzKennzahlen, BrePersonStatus } from '../utils/finanzStatus'
import type { AufgabenFilter } from '../utils/aufgabenFilter'

function formatEuro(v: number) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

// ─── Finanzkachel ─────────────────────────────────────────────────────────────

interface KachelProps {
  label: string
  wert: number
  icon: React.ReactNode
  farbe: string // text + bg + border
  diff?: number | null
  dimmed?: boolean
}

function Kachel({ label, wert, icon, farbe, diff, dimmed }: KachelProps) {
  const hasDiff = diff !== undefined && diff !== null && (wert > 0)
  const diffPositiv = hasDiff && diff! >= 0

  return (
    <div className={`rounded border px-3 py-2 ${farbe} ${dimmed || wert === 0 ? 'opacity-40' : ''}`}>
      <div className="flex items-center gap-1 mb-0.5">
        {icon}
        <p className="font-medium leading-tight text-[11px] opacity-80">{label}</p>
      </div>
      <p className="font-bold tabular-nums text-base leading-tight">{formatEuro(wert)}</p>
      {hasDiff && (
        <div className={`flex items-center gap-0.5 mt-0.5 text-[11px] tabular-nums ${diffPositiv ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {diffPositiv
            ? <TrendingUp className="w-3 h-3" />
            : <TrendingDown className="w-3 h-3" />
          }
          <span>{diffPositiv ? '+' : ''}{formatEuro(diff!)}</span>
        </div>
      )}
    </div>
  )
}

// ─── BRE-Zeile (kompakt, eine Zeile pro Person) ───────────────────────────────

const EMP_CFG = {
  einreichen:           { icon: Zap,           cls: 'text-green-500 dark:text-green-400',  title: 'Schwelle erreichbar – einreichen' },
  schonen:              { icon: Shield,         cls: 'text-blue-500 dark:text-blue-400',    title: 'Schwelle nicht erreichbar – BRE schonen' },
  bereits_ueberschritten: { icon: AlertTriangle, cls: 'text-red-500 dark:text-red-400',   title: 'BRE-Schwelle bereits überschritten' },
  keine_schwelle:       null,
} as const

function BREZeile({ status }: { status: BrePersonStatus }) {
  const { person, breSchwelle, pkvNochNichtEingereicht, pkvBereitsEingereichtJahr, pkvGesamtPotenzialJahr, empfehlung } = status
  const cfg = EMP_CFG[empfehlung]
  if (!cfg || !breSchwelle) return null

  const totalPct   = Math.min(100, (pkvGesamtPotenzialJahr / breSchwelle) * 100)
  const einPct     = Math.min(totalPct, (pkvBereitsEingereichtJahr / breSchwelle) * 100)
  const offenPct   = totalPct - einPct

  const barBase    = totalPct >= 100 ? 'bg-green-400' : totalPct >= 70 ? 'bg-yellow-400' : 'bg-amber-400'
  const barDark    = totalPct >= 100 ? 'bg-green-600' : totalPct >= 70 ? 'bg-yellow-600' : 'bg-amber-600'
  const EmpIcon    = cfg.icon

  return (
    <div className="py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
      {/* Zeile 1: Name · Balken · % · Icon */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-900 dark:text-gray-100 w-16 sm:w-24 shrink-0 truncate">{person.name}</span>
        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
          <div className="flex h-full">
            {einPct   > 0 && <div className={`${barDark} transition-all`}  style={{ width: `${einPct}%` }} />}
            {offenPct > 0 && <div className={`${barBase} transition-all`}  style={{ width: `${offenPct}%` }} />}
          </div>
        </div>
        <span className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400 w-7 text-right shrink-0">{Math.round(totalPct)}%</span>
        <span title={cfg.title}><EmpIcon className={`w-3.5 h-3.5 shrink-0 ${cfg.cls}`} /></span>
      </div>
      {/* Zeile 2: Zahlen in Mini-Schrift */}
      <div className="flex gap-3 text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 ml-[4.5rem] sm:ml-[6.5rem]">
        <span>offen <span className="tabular-nums">{formatEuro(pkvNochNichtEingereicht)}</span></span>
        <span>eingereicht <span className="tabular-nums">{formatEuro(pkvBereitsEingereichtJahr)}</span></span>
        <span className="hidden sm:inline">Schwelle <span className="tabular-nums">{formatEuro(breSchwelle)}</span></span>
      </div>
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

interface Props {
  kennzahlen: FinanzKennzahlen
  filter: AufgabenFilter
}

export default function AufgabenFinanzStatus({ kennzahlen, filter }: Props) {
  const {
    offenBetrag, bezahltBetrag,
    beihilfeAusstehendBetrag, beihilfeErstattetBetrag, beihilfeDifferenz,
    pkvAusstehendBetrag, pkvErstattetBetrag, pkvDifferenz,
    breStatus,
  } = kennzahlen

  return (
    <div className="space-y-3">
      {/* Finanzkacheln */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Kachel
          label="Offen"
          wert={offenBetrag}
          icon={<Clock className="w-3.5 h-3.5 opacity-70" />}
          farbe="text-amber-700 bg-amber-50 border-amber-100 dark:text-amber-300 dark:bg-amber-900/20 dark:border-amber-800"
        />
        <Kachel
          label="Bezahlt"
          wert={bezahltBetrag}
          icon={<CheckCircle className="w-3.5 h-3.5 opacity-70" />}
          farbe="text-slate-700 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-800/50 dark:border-slate-600"
        />
        <Kachel
          label="Beihilfe ausstehend"
          wert={beihilfeAusstehendBetrag}
          icon={<Hourglass className="w-3.5 h-3.5 opacity-70" />}
          farbe="text-blue-700 bg-blue-50 border-blue-100 dark:text-blue-300 dark:bg-blue-900/20 dark:border-blue-800"
        />
        <Kachel
          label="Beihilfe erstattet"
          wert={beihilfeErstattetBetrag}
          icon={beihilfeDifferenz >= 0
            ? <TrendingUp className="w-3.5 h-3.5 opacity-70" />
            : <TrendingDown className="w-3.5 h-3.5 opacity-70" />
          }
          farbe="text-teal-700 bg-teal-50 border-teal-100 dark:text-teal-300 dark:bg-teal-900/20 dark:border-teal-800"
          diff={beihilfeErstattetBetrag > 0 ? beihilfeDifferenz : null}
        />
        <Kachel
          label="PKV ausstehend"
          wert={pkvAusstehendBetrag}
          icon={<Hourglass className="w-3.5 h-3.5 opacity-70" />}
          farbe="text-violet-700 bg-violet-50 border-violet-100 dark:text-violet-300 dark:bg-violet-900/20 dark:border-violet-800"
        />
        <Kachel
          label="PKV erstattet"
          wert={pkvErstattetBetrag}
          icon={pkvDifferenz >= 0
            ? <TrendingUp className="w-3.5 h-3.5 opacity-70" />
            : <TrendingDown className="w-3.5 h-3.5 opacity-70" />
          }
          farbe="text-purple-700 bg-purple-50 border-purple-100 dark:text-purple-300 dark:bg-purple-900/20 dark:border-purple-800"
          diff={pkvErstattetBetrag > 0 ? pkvDifferenz : null}
        />
      </div>

      {/* BRE-Status */}
      {breStatus.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2">
          <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
            PKV-Beitragsrückerstattung {filter.jahr}
          </p>
          {breStatus.map(s => <BREZeile key={s.person.id} status={s} />)}
        </div>
      )}
    </div>
  )
}
