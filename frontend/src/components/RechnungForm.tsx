import { useState, type FormEvent, type ReactNode } from 'react'
import type { Person, Correspondent, CreateRechnung } from '../types'

interface Props {
  personen: Person[]
  correspondents: Correspondent[]
  onSubmit: (data: CreateRechnung) => Promise<void>
  onCancel: () => void
}

export default function RechnungForm({ personen, correspondents, onSubmit, onCancel }: Props) {
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState<CreateRechnung>({
    person_id: personen[0]?.id ?? '',
    leistungserbringer_id: correspondents[0]?.id ?? '',
    typ: 'arzt',
    betrag: 0,
    datum: today,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (form.betrag <= 0) {
      setError('Betrag muss größer als 0 sein')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await onSubmit(form)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500'

  function field(label: string, children: ReactNode) {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
        {children}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4">
      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-3">Neue Rechnung</h3>
      {error && <p className="text-red-600 dark:text-red-400 text-sm mb-3">{error}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {field('Person',
          <select className={inputClass} value={form.person_id}
            onChange={e => setForm(f => ({ ...f, person_id: e.target.value }))}>
            {personen.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {field('Leistungserbringer',
          <select className={inputClass} value={form.leistungserbringer_id}
            onChange={e => setForm(f => ({ ...f, leistungserbringer_id: e.target.value }))}>
            {correspondents.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {field('Typ',
          <select className={inputClass} value={form.typ}
            onChange={e => setForm(f => ({ ...f, typ: e.target.value as CreateRechnung['typ'] }))}>
            <option value="arzt">Arzt</option>
            <option value="apotheke">Apotheke</option>
            <option value="krankenhaus">Krankenhaus</option>
          </select>
        )}
        {field('Betrag (€)',
          <input type="number" step="0.01" min="0.01" className={inputClass}
            value={form.betrag || ''} required
            onChange={e => setForm(f => ({ ...f, betrag: parseFloat(e.target.value) || 0 }))} />
        )}
        {field('Datum',
          <input type="date" className={inputClass} value={form.datum} required
            onChange={e => setForm(f => ({ ...f, datum: e.target.value }))} />
        )}
        {field('Zahlungsziel',
          <input type="date" className={inputClass} value={form.zahlungsziel ?? ''}
            onChange={e => setForm(f => ({ ...f, zahlungsziel: e.target.value || undefined }))} />
        )}
        {field('Notiz',
          <input type="text" className={inputClass} value={form.notiz ?? ''}
            onChange={e => setForm(f => ({ ...f, notiz: e.target.value || undefined }))} />
        )}
        <div className="flex flex-col gap-2 justify-end">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" checked={form.pkv_gescannt ?? false}
              onChange={e => setForm(f => ({ ...f, pkv_gescannt: e.target.checked }))}
              className="rounded border-gray-300 dark:border-gray-600 w-4 h-4" />
            PKV gescannt
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input type="checkbox" checked={form.beihilfe_gescannt ?? false}
              onChange={e => setForm(f => ({ ...f, beihilfe_gescannt: e.target.checked }))}
              className="rounded border-gray-300 dark:border-gray-600 w-4 h-4" />
            Beihilfe gescannt
          </label>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button type="submit" disabled={loading}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Speichern...' : 'Speichern'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-1.5 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600">
          Abbrechen
        </button>
      </div>
    </form>
  )
}
