import { useState } from 'react'
import type { BulkAction } from '../types'
import type { ExportProvider } from '../api/export'

interface Props {
  count: number
  onAction: (action: BulkAction) => void
  onExport?: (provider: ExportProvider) => void
  onClear: () => void
  loading: boolean
  exporting?: boolean
  archivModus?: boolean
  gdriveConfigured?: boolean
}

export default function BulkActionBar({ count, onAction, onExport, onClear, loading, exporting, archivModus, gdriveConfigured }: Props) {
  const [provider, setProvider] = useState<ExportProvider>('local')

  const providers: { value: ExportProvider; label: string; disabled?: boolean }[] = [
    { value: 'local', label: 'Lokales Volume' },
    { value: 'google_drive', label: 'Google Drive', disabled: !gdriveConfigured },
  ]

  if (count === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-10">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-600 dark:text-gray-300 font-medium shrink-0">
          {count} ausgewählt
        </span>
        <div className="flex gap-1.5 flex-wrap flex-1">
          {archivModus ? (
            <button
              onClick={() => onAction('dearchivieren')}
              disabled={loading}
              className="px-3 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
            >
              De-archivieren
            </button>
          ) : (
            <>
              <button
                onClick={() => onAction('bezahlt')}
                disabled={loading}
                className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                <span className="sm:hidden">Bezahlt</span>
                <span className="hidden sm:inline">Als bezahlt markieren</span>
              </button>
              <button
                onClick={() => onAction('beihilfe_eingereicht')}
                disabled={loading}
                className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                <span className="sm:hidden">Beihilfe</span>
                <span className="hidden sm:inline">Beihilfe: eingereicht</span>
              </button>
              <button
                onClick={() => onAction('pkv_eingereicht')}
                disabled={loading}
                className="px-3 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                <span className="sm:hidden">PKV</span>
                <span className="hidden sm:inline">PKV: eingereicht</span>
              </button>
              <button
                onClick={() => onAction('archivieren')}
                disabled={loading}
                className="px-3 py-2 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
              >
                Archivieren
              </button>
            </>
          )}

          {/* Export – immer sichtbar */}
          {onExport && (
            <div className="flex items-center gap-1">
              <select
                value={provider}
                onChange={e => setProvider(e.target.value as ExportProvider)}
                className="px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
              >
                {providers.map(p => (
                  <option key={p.value} value={p.value} disabled={p.disabled}>
                    {p.label}{p.disabled && p.value === 'google_drive' ? ' (nicht konfiguriert)' : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onExport(provider)}
                disabled={loading || exporting}
                className="px-3 py-2 text-sm bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span className="sm:hidden">{exporting ? '…' : 'Export'}</span>
                <span className="hidden sm:inline">{exporting ? 'Exportiere…' : 'Exportieren'}</span>
              </button>
            </div>
          )}
        </div>
        <button
          onClick={onClear}
          className="shrink-0 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
