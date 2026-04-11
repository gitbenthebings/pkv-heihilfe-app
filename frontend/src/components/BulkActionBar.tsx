import type { BulkAction } from '../types'

interface Props {
  count: number
  onAction: (action: BulkAction) => void
  onClear: () => void
  loading: boolean
  archivModus?: boolean
}

export default function BulkActionBar({ count, onAction, onClear, loading, archivModus }: Props) {
  if (count === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
          {count} Rechnung{count !== 1 ? 'en' : ''} ausgewählt
        </span>
        <div className="flex gap-2 flex-wrap">
          {archivModus ? (
            <button
              onClick={() => onAction('dearchivieren')}
              disabled={loading}
              className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
            >
              De-archivieren
            </button>
          ) : (
            <>
              <button
                onClick={() => onAction('bezahlt')}
                disabled={loading}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                Als bezahlt markieren
              </button>
              <button
                onClick={() => onAction('beihilfe_eingereicht')}
                disabled={loading}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Beihilfe: eingereicht
              </button>
              <button
                onClick={() => onAction('pkv_eingereicht')}
                disabled={loading}
                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                PKV: eingereicht
              </button>
              <button
                onClick={() => onAction('archivieren')}
                disabled={loading}
                className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
              >
                Archivieren
              </button>
            </>
          )}
        </div>
        <button
          onClick={onClear}
          className="ml-auto text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          Auswahl aufheben
        </button>
      </div>
    </div>
  )
}
