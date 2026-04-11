import type { FinanzOverview as FinanzOverviewType } from '../types'

interface Props {
  finanzen: FinanzOverviewType
  filtered?: boolean
}

function formatEuro(betrag: number) {
  return betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

interface Zeile {
  label: string
  color: string
  gesamt: keyof FinanzOverviewType
  beihilfe?: keyof FinanzOverviewType
  pkv?: keyof FinanzOverviewType
}

const zeilen: Zeile[] = [
  {
    label: 'Offen / nicht bezahlt',
    color: 'text-red-700 bg-red-50 border-red-100 dark:text-red-300 dark:bg-red-900/20 dark:border-red-800',
    gesamt: 'offen_unbezahlt',
    beihilfe: 'offen_unbezahlt_beihilfe',
    pkv: 'offen_unbezahlt_pkv',
  },
  {
    label: 'Bezahlt, PKV offen',
    color: 'text-amber-700 bg-amber-50 border-amber-100 dark:text-amber-300 dark:bg-amber-900/20 dark:border-amber-800',
    gesamt: 'bezahlt_pkv_offen',
    pkv: 'bezahlt_pkv_offen_pkv',
  },
  {
    label: 'Bezahlt, Beihilfe offen',
    color: 'text-yellow-700 bg-yellow-50 border-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/20 dark:border-yellow-800',
    gesamt: 'bezahlt_beihilfe_offen',
    beihilfe: 'bezahlt_beihilfe_offen_beihilfe',
  },
  {
    label: 'Abgeschlossen',
    color: 'text-green-700 bg-green-50 border-green-100 dark:text-green-300 dark:bg-green-900/20 dark:border-green-800',
    gesamt: 'abgeschlossen',
    beihilfe: 'abgeschlossen_beihilfe',
    pkv: 'abgeschlossen_pkv',
  },
]

export default function FinanzOverview({ finanzen, filtered }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {zeilen.map(z => {
        const gesamt = finanzen[z.gesamt] as number
        const bh = z.beihilfe ? finanzen[z.beihilfe] as number : null
        const pkv = z.pkv ? finanzen[z.pkv] as number : null

        const sub: string[] = []
        if (bh !== null) sub.push(`BH ${formatEuro(bh)}`)
        if (pkv !== null) sub.push(`PKV ${formatEuro(pkv)}`)

        return (
          <div key={z.gesamt} className={`rounded border px-3 py-1.5 ${z.color}`}>
            <p className="font-medium opacity-75 leading-tight" style={{ fontSize: 11 }}>
              {z.label}{filtered ? ' *' : ''}
            </p>
            <p className="font-bold tabular-nums" style={{ fontSize: 18, lineHeight: 1.25 }}>
              {formatEuro(gesamt)}
            </p>
            {sub.length > 0 && (
              <p className="opacity-70 tabular-nums" style={{ fontSize: 11 }}>{sub.join(' · ')}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
