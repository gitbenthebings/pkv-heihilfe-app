import type { BreIndikator } from '../types'

interface Props {
  indikatoren: BreIndikator[]
  hasFilter: boolean
  onClearFilter: () => void
}

function formatEuro(betrag: number) {
  return betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

export default function BREInfoLeiste({ indikatoren, hasFilter, onClearFilter }: Props) {
  if (indikatoren.length === 0 && !hasFilter) return null

  return (
    <div className="flex items-center gap-3 px-3 py-1 rounded border bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-xs min-h-[30px]">
      {indikatoren.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 flex-1 min-w-0">
          <span className="font-semibold text-gray-500 dark:text-gray-400 shrink-0">BRE</span>
          {indikatoren.map(ind => {
            const positiv = ind.bre_spielraum >= 0
            return (
              <span key={ind.person_id} className="text-gray-600 dark:text-gray-400 whitespace-nowrap">
                <span className="font-medium text-gray-700 dark:text-gray-300">{ind.person_name}:</span>
                {' '}PKV offen {formatEuro(ind.pkv_offen)} · Schwelle {formatEuro(ind.bre_schwelle)} · {' '}
                <span className={positiv
                  ? 'font-medium text-green-700 dark:text-green-400'
                  : 'font-medium text-red-600 dark:text-red-400'}>
                  {positiv
                    ? `Spielraum: ${formatEuro(ind.bre_spielraum)}`
                    : `Überschritten: ${formatEuro(Math.abs(ind.bre_spielraum))}`}
                </span>
              </span>
            )
          })}
        </div>
      )}
      {indikatoren.length === 0 && <div className="flex-1" />}
      {hasFilter && (
        <button
          onClick={onClearFilter}
          className="shrink-0 ml-auto text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
        >
          Filter zurücksetzen
        </button>
      )}
    </div>
  )
}
