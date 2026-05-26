import { useState, useRef, type FormEvent, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getConfig } from '../api/config'
import { analysiereRechnungPDF } from '../api/n8n'
import type { Person, Correspondent, CreateRechnung } from '../types'

interface Props {
  personen: Person[]
  correspondents: Correspondent[]
  onSubmit: (data: CreateRechnung) => Promise<void>
  onCancel: () => void
  initialValues?: Partial<CreateRechnung>
}

export default function RechnungForm({ personen, correspondents, onSubmit, onCancel, initialValues }: Props) {
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState<CreateRechnung>({
    person_id: initialValues?.person_id ?? personen[0]?.id ?? '',
    leistungserbringer_id: initialValues?.leistungserbringer_id ?? correspondents[0]?.id ?? '',
    typ: initialValues?.typ ?? 'arzt',
    betrag: initialValues?.betrag ?? 0,
    datum: today,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [kiLoading, setKiLoading] = useState(false)
  const [kiMsg, setKiMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: config } = useQuery({ queryKey: ['config'], queryFn: getConfig })
  const n8nRechnungUrl = config?.n8n_rechnung_webhook_url

  const handleKiImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !n8nRechnungUrl) return
    e.target.value = ''

    setKiLoading(true); setKiMsg(null)
    try {
      const result = await analysiereRechnungPDF(n8nRechnungUrl, file)

      // Leistungserbringer anhand des Namens suchen (case-insensitive Teilstring)
      const name = result.leistungserbringer_name?.toLowerCase() ?? ''
      const matchedCorrespondent = correspondents.find(c =>
        name && (c.name.toLowerCase().includes(name) || name.includes(c.name.toLowerCase()))
      )

      // Person anhand des Namens suchen
      const personName = result.person_name?.toLowerCase() ?? ''
      const matchedPerson = personen.find(p =>
        personName && (p.name.toLowerCase().includes(personName) || personName.includes(p.name.toLowerCase()))
      )

      setForm(f => ({
        ...f,
        betrag: result.betrag,
        datum: result.datum,
        typ: result.typ,
        ...(matchedCorrespondent ? { leistungserbringer_id: matchedCorrespondent.id } : {}),
        ...(matchedPerson ? { person_id: matchedPerson.id } : {}),
        ...(result.zahlungsziel ? { zahlungsziel: result.zahlungsziel } : {}),
        ...(result.notiz ? { notiz: result.notiz } : {}),
      }))

      const hinweise: string[] = []
      if (!matchedCorrespondent && result.leistungserbringer_name) {
        hinweise.push(`Leistungserbringer „${result.leistungserbringer_name}" nicht gefunden`)
      }
      if (!matchedPerson && result.person_name) {
        hinweise.push(`Person „${result.person_name}" nicht gefunden`)
      }

      setKiMsg({
        ok: true,
        text: hinweise.length > 0
          ? `Felder vorausgefüllt. Bitte prüfen: ${hinweise.join('; ')}`
          : 'Felder erfolgreich vorausgefüllt. Bitte prüfen und ggf. anpassen.',
      })
    } catch (err) {
      setKiMsg({ ok: false, text: err instanceof Error ? err.message : 'KI-Analyse fehlgeschlagen' })
    } finally {
      setKiLoading(false)
    }
  }

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
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={handleKiImport}
      />

      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200">
          {initialValues ? 'Ähnliche Rechnung anlegen' : 'Neue Rechnung'}
        </h3>
        {n8nRechnungUrl && !initialValues && (
          <button
            type="button"
            disabled={kiLoading}
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1 text-xs rounded border border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800 disabled:opacity-50"
            title="Rechnung als PDF hochladen und Felder automatisch ausfüllen lassen"
          >
            {kiLoading ? 'Analysiere…' : 'KI-Import'}
          </button>
        )}
      </div>

      {kiMsg && (
        <p className={`text-xs mb-3 ${kiMsg.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {kiMsg.ok ? '✓ ' : '✗ '}{kiMsg.text}
        </p>
      )}

      {error && <p className="text-red-600 dark:text-red-400 text-sm mb-3">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
