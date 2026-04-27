import { useState, useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import type { Person } from '../types'
import { type AufgabenFilter, defaultAufgabenFilter, isDefaultFilter } from '../utils/aufgabenFilter'

// ─── Dropdown ─────────────────────────────────────────────────────────────────

function MultiSelectDropdown({
  label, options, selected, onChange,
}: {
  label: string
  options: { id: string; label: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter(s => s !== id))
    else onChange([...selected, id])
  }

  const displayLabel = selected.length === 0
    ? label
    : options.filter(o => selected.includes(o.id)).map(o => o.label).join(', ')
  const truncated = displayLabel.length > 18 ? displayLabel.slice(0, 16) + '…' : displayLabel

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 px-2 py-1.5 sm:py-1 text-xs rounded border transition-colors min-h-[36px] ${
          selected.length > 0
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
      >
        <span>{truncated}</span>
        {selected.length > 0 && (
          <span className="bg-blue-600 text-white text-[10px] rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none flex-shrink-0">
            {selected.length}
          </span>
        )}
        <svg className="w-2.5 h-2.5 opacity-60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-[min(95vw,13rem)] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-20 py-1">
          <div className="max-h-48 overflow-y-auto">
            {options.map(o => (
              <label key={o.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={selected.includes(o.id)}
                  onChange={() => toggle(o.id)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                />
                <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{o.label}</span>
              </label>
            ))}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-1">
              <button
                onClick={() => { onChange([]); setOpen(false) }}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                Alle entfernen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

const TYPEN = [
  { id: 'arzt', label: 'Arzt' },
  { id: 'apotheke', label: 'Apotheke' },
  { id: 'krankenhaus', label: 'Krankenhaus' },
]

interface Props {
  filter: AufgabenFilter
  onChange: (filter: AufgabenFilter) => void
  personen: Person[]
}

export default function AufgabenFilterleiste({ filter, onChange, personen }: Props) {
  const currentYear = new Date().getFullYear()
  const jahreOptionen = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i)

  const personenOptions = personen.map(p => ({ id: p.id, label: p.name }))

  function set<K extends keyof AufgabenFilter>(key: K, value: AufgabenFilter[K]) {
    onChange({ ...filter, [key]: value })
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">

        {/* Person */}
        <MultiSelectDropdown
          label="Person"
          options={personenOptions}
          selected={filter.personIds}
          onChange={ids => set('personIds', ids)}
        />

        {/* Jahr */}
        <select
          value={filter.jahr}
          onChange={e => set('jahr', Number(e.target.value))}
          className="px-2 py-1.5 sm:py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[36px]"
        >
          {jahreOptionen.map(j => (
            <option key={j} value={j}>{j}</option>
          ))}
        </select>

        {/* Typ */}
        <MultiSelectDropdown
          label="Typ"
          options={TYPEN}
          selected={filter.typen}
          onChange={ids => set('typen', ids)}
        />

        {/* Zeitraum */}
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-gray-500 dark:text-gray-400">Von</span>
          <div className="relative flex items-center">
            <input
              type="date"
              value={filter.datumVon ?? ''}
              onChange={e => set('datumVon', e.target.value || null)}
              className="border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1.5 sm:py-1 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[36px]"
            />
            {filter.datumVon && (
              <button
                onClick={() => set('datumVon', null)}
                className="absolute right-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">Bis</span>
          <div className="relative flex items-center">
            <input
              type="date"
              value={filter.datumBis ?? ''}
              onChange={e => set('datumBis', e.target.value || null)}
              className="border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1.5 sm:py-1 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[36px]"
            />
            {filter.datumBis && (
              <button
                onClick={() => set('datumBis', null)}
                className="absolute right-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Zurücksetzen */}
        {!isDefaultFilter(filter) && (
          <button
            onClick={() => onChange(defaultAufgabenFilter)}
            className="flex items-center gap-1 px-2 py-1.5 sm:py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 min-h-[36px]"
          >
            <X className="w-3 h-3" />
            Zurücksetzen
          </button>
        )}

      </div>
    </div>
  )
}
