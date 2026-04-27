import React, { useState } from 'react'
import type { Rechnung, Person, Correspondent, UpdateRechnung } from '../types'
import StatusBadge from './StatusBadge'
import AnhangUpload from './AnhangUpload'

interface Props {
  rechnungen: Rechnung[]
  personen: Person[]
  correspondents: Correspondent[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleAll: () => void
  onUpdate: (id: string, data: UpdateRechnung) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onArchivToggle: (id: string, archivieren: boolean) => Promise<void>
  archivModus?: boolean
  paperlessNgxUrl?: string
}

function formatEuro(betrag: number) {
  return betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function formatReferenz(nr: number | null) {
  if (nr === null) return '—'
  return `R-${String(nr).padStart(4, '0')}`
}

function formatDate(date: string | null | undefined) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('de-DE')
}

type SortKey = 'referenz_nr' | 'datum' | 'person' | 'korrespondent' | 'typ' | 'betrag' | 'zahlung_status'
type SortDir = 'asc' | 'desc'

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`ml-1 inline-block ${active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-gray-600'}`}>
      {active && dir === 'desc' ? '↓' : '↑'}
    </span>
  )
}

function PaperlessBadge({ r, paperlessNgxUrl }: { r: Rechnung; paperlessNgxUrl?: string }) {
  if (r.paperless_uebertragen_am) {
    const datum = formatDate(r.paperless_uebertragen_am)
    if (r.paperless_doc_id && paperlessNgxUrl) {
      const url = `${paperlessNgxUrl.replace(/\/$/, '')}/documents/${r.paperless_doc_id}/`
      return (
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 hover:bg-teal-200 dark:hover:bg-teal-800/60 transition-colors"
          title={`In Paperless öffnen · Übertragen am ${datum}`}>
          <span>Paperless</span>
          <span className="opacity-70">#{r.paperless_doc_id}</span>
        </a>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300"
        title={`Übertragen am ${datum}`}>
        Paperless ✓
      </span>
    )
  }
  if (r.archiviert_am && paperlessNgxUrl) {
    return (
      <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
        <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-pulse shrink-0" />
        Wird übertragen…
      </span>
    )
  }
  return null
}

export default function RechnungenTable({
  rechnungen, personen, correspondents,
  selectedIds, onToggleSelect, onToggleAll,
  onUpdate, onDelete, onArchivToggle, archivModus, paperlessNgxUrl,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<UpdateRechnung>({})
  const [saving, setSaving] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('datum')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [anhangExpandedId, setAnhangExpandedId] = useState<string | null>(null)

  const personMap = Object.fromEntries(personen.map(p => [p.id, p]))
  const corrMap = Object.fromEntries(correspondents.map(c => [c.id, c]))

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...rechnungen].sort((a, b) => {
    let cmp = 0
    switch (sortKey) {
      case 'referenz_nr': cmp = (a.referenz_nr ?? -1) - (b.referenz_nr ?? -1); break
      case 'datum': cmp = a.datum.localeCompare(b.datum); break
      case 'person': cmp = (personMap[a.person_id]?.name ?? '').localeCompare(personMap[b.person_id]?.name ?? ''); break
      case 'korrespondent': cmp = (corrMap[a.leistungserbringer_id]?.name ?? '').localeCompare(corrMap[b.leistungserbringer_id]?.name ?? ''); break
      case 'typ': cmp = a.typ.localeCompare(b.typ); break
      case 'betrag': cmp = a.betrag - b.betrag; break
      case 'zahlung_status': cmp = a.zahlung_status.localeCompare(b.zahlung_status); break
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  const allSelected = sorted.length > 0 && sorted.every(r => selectedIds.has(r.id))

  const startEdit = (r: Rechnung) => {
    setEditingId(r.id)
    setEditValues({
      betrag: r.betrag,
      datum: r.datum,
      zahlungsziel: r.zahlungsziel ?? '',
      bezahlt_am: r.bezahlt_am ?? '',
      beihilfe_eingereicht_am: r.beihilfe_eingereicht_am ?? '',
      pkv_eingereicht_am: r.pkv_eingereicht_am ?? '',
      notiz: r.notiz ?? '',
      leistungserbringer_id: r.leistungserbringer_id,
      typ: r.typ,
      person_id: r.person_id,
      beihilfe_erstattet_betrag: r.beihilfe_erstattet_betrag,
      pkv_erstattet_betrag: r.pkv_erstattet_betrag,
    })
  }

  const saveEdit = async (id: string) => {
    setSaving(true)
    try {
      await onUpdate(id, editValues)
      setEditingId(null)
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 text-xs w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500'
  const mobileInputClass = 'border border-gray-300 dark:border-gray-600 rounded px-2 py-2 text-sm w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500'

  return (
    <div>
      {/* ── Mobile-Ansicht: Karten ───────────────────────────────────────── */}
      <div className="sm:hidden">
        {/* Alle auswählen */}
        {sorted.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
            <input type="checkbox" checked={allSelected} onChange={onToggleAll}
              className="rounded border-gray-300 dark:border-gray-600 w-4 h-4" />
            <span className="text-xs text-gray-500 dark:text-gray-400">Alle auswählen</span>
          </div>
        )}

        {rechnungen.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-sm">
            Keine Rechnungen vorhanden
          </div>
        )}

        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {sorted.map((r) => {
            const isEditing = editingId === r.id
            const person = personMap[r.person_id]
            const corr = corrMap[r.leistungserbringer_id]

            return (
              <div key={r.id} className={`px-4 py-3 ${selectedIds.has(r.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                {isEditing ? (
                  /* Mobile Edit Form */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{formatReferenz(r.referenz_nr)}</span>
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(r.id)} disabled={saving}
                          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50">
                          Sichern
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-600">
                          Abbruch
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500 dark:text-gray-400">Person</label>
                        <select className={mobileInputClass} value={editValues.person_id ?? ''}
                          onChange={e => setEditValues(v => ({ ...v, person_id: e.target.value }))}>
                          {personen.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500 dark:text-gray-400">Typ</label>
                        <select className={mobileInputClass} value={editValues.typ ?? ''}
                          onChange={e => setEditValues(v => ({ ...v, typ: e.target.value }))}>
                          <option value="arzt">Arzt</option>
                          <option value="apotheke">Apotheke</option>
                          <option value="krankenhaus">Krankenhaus</option>
                        </select>
                      </div>
                      <div className="col-span-2 flex flex-col gap-1">
                        <label className="text-xs text-gray-500 dark:text-gray-400">Leistungserbringer</label>
                        <select className={mobileInputClass} value={editValues.leistungserbringer_id ?? ''}
                          onChange={e => setEditValues(v => ({ ...v, leistungserbringer_id: e.target.value }))}>
                          {correspondents.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500 dark:text-gray-400">Datum</label>
                        <input type="date" className={mobileInputClass} value={editValues.datum ?? ''}
                          onChange={e => setEditValues(v => ({ ...v, datum: e.target.value }))} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500 dark:text-gray-400">Betrag (€)</label>
                        <input type="number" step="0.01" className={mobileInputClass}
                          value={editValues.betrag ?? ''}
                          onChange={e => setEditValues(v => ({ ...v, betrag: parseFloat(e.target.value) || 0 }))} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500 dark:text-gray-400">Bezahlt am</label>
                        <input type="date" className={mobileInputClass} value={editValues.bezahlt_am ?? ''}
                          onChange={e => setEditValues(v => ({ ...v, bezahlt_am: e.target.value }))} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500 dark:text-gray-400">Beihilfe eingereicht</label>
                        <input type="date" className={mobileInputClass} value={editValues.beihilfe_eingereicht_am ?? ''}
                          onChange={e => setEditValues(v => ({ ...v, beihilfe_eingereicht_am: e.target.value }))} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500 dark:text-gray-400">PKV eingereicht</label>
                        <input type="date" className={mobileInputClass} value={editValues.pkv_eingereicht_am ?? ''}
                          onChange={e => setEditValues(v => ({ ...v, pkv_eingereicht_am: e.target.value }))} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500 dark:text-gray-400">BH erstattet (€)</label>
                        <input type="number" step="0.01" className={mobileInputClass}
                          placeholder="—"
                          value={editValues.beihilfe_erstattet_betrag ?? ''}
                          onChange={e => {
                            const v = e.target.value
                            setEditValues(prev => ({ ...prev, beihilfe_erstattet_betrag: v === '' ? null : parseFloat(v) || 0 }))
                          }} />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500 dark:text-gray-400">PKV erstattet (€)</label>
                        <input type="number" step="0.01" className={mobileInputClass}
                          placeholder="—"
                          value={editValues.pkv_erstattet_betrag ?? ''}
                          onChange={e => {
                            const v = e.target.value
                            setEditValues(prev => ({ ...prev, pkv_erstattet_betrag: v === '' ? null : parseFloat(v) || 0 }))
                          }} />
                      </div>
                      <div className="col-span-2 flex flex-col gap-1">
                        <label className="text-xs text-gray-500 dark:text-gray-400">Notiz</label>
                        <input type="text" className={mobileInputClass} value={editValues.notiz ?? ''}
                          onChange={e => setEditValues(v => ({ ...v, notiz: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Mobile View Card */
                  <div>
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={selectedIds.has(r.id)}
                        onChange={() => onToggleSelect(r.id)}
                        className="mt-1 rounded border-gray-300 dark:border-gray-600 w-4 h-4 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="font-semibold text-gray-800 dark:text-gray-100">{formatEuro(r.betrag)}</span>
                          <span className="text-xs font-mono text-gray-400 dark:text-gray-500 shrink-0">{formatReferenz(r.referenz_nr)}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{person?.name ?? r.person_id}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{formatDate(r.datum)}</span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate mb-1.5">
                          {corr?.name ?? r.leistungserbringer_id} · <span className="capitalize">{r.typ}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <StatusBadge label="Zahlung" status={r.zahlung_status} />
                          <StatusBadge label="Beihilfe" status={r.beihilfe_status} />
                          <StatusBadge label="PKV" status={r.pkv_status} />
                        </div>
                        {(r.beihilfe_anteil_erwartet != null || r.beihilfe_erstattet_betrag != null || r.pkv_anteil_erwartet != null || r.pkv_erstattet_betrag != null) && (
                          <div className="flex gap-3 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                            {r.beihilfe_anteil_erwartet != null && (
                              <span>BH: {formatEuro(r.beihilfe_anteil_erwartet)}{r.beihilfe_erstattet_betrag != null && ` → ${formatEuro(r.beihilfe_erstattet_betrag)}`}</span>
                            )}
                            {r.pkv_anteil_erwartet != null && (
                              <span>PKV: {formatEuro(r.pkv_anteil_erwartet)}{r.pkv_erstattet_betrag != null && ` → ${formatEuro(r.pkv_erstattet_betrag)}`}</span>
                            )}
                          </div>
                        )}
                        {r.paperless_uebertragen_am && (
                          <div className="mt-1.5">
                            <PaperlessBadge r={r} paperlessNgxUrl={paperlessNgxUrl} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2.5 ml-7">
                      {!archivModus && (
                        <button onClick={() => startEdit(r)}
                          className="flex-1 px-2 py-2 text-xs text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30">
                          Bearbeiten
                        </button>
                      )}
                      <button onClick={() => onArchivToggle(r.id, !archivModus)}
                        className="flex-1 px-2 py-2 text-xs text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700 rounded hover:bg-amber-50 dark:hover:bg-amber-900/30">
                        {archivModus ? 'Wiederherstellen' : 'Archivieren'}
                      </button>
                      <button onClick={() => onDelete(r.id)}
                        className="flex-1 px-2 py-2 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/30">
                        Löschen
                      </button>
                    </div>
                    {/* Anhänge (Mobile) */}
                    <div className="mt-2 ml-7">
                      <AnhangUpload rechnungId={r.id} referenzNr={r.referenz_nr} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Desktop-Ansicht: Tabelle ─────────────────────────────────────── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="w-8 px-3 py-3">
                <input type="checkbox" checked={allSelected} onChange={onToggleAll}
                  className="rounded border-gray-300 dark:border-gray-600" />
              </th>
              {(
                [
                  ['referenz_nr', 'Ref.', 'left'],
                  ['datum', 'Datum', 'left'],
                  ['person', 'Person', 'left'],
                  ['korrespondent', 'Leistungserbringer', 'left'],
                  ['typ', 'Typ', 'left'],
                  ['betrag', 'Betrag', 'right'],
                  ['zahlung_status', 'Status', 'left'],
                ] as [SortKey, string, string][]
              ).map(([key, label, align]) => (
                <th key={key}
                  className={`px-3 py-3 text-${align} text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 whitespace-nowrap`}
                  onClick={() => toggleSort(key)}
                >
                  {label}<SortIcon active={sortKey === key} dir={sortDir} />
                </th>
              ))}
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">Beihilfe</th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">PKV</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Notiz</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">Paperless</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
            {rechnungen.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-gray-400 dark:text-gray-500">
                  Keine Rechnungen vorhanden
                </td>
              </tr>
            )}
            {sorted.map((r) => {
              const isEditing = editingId === r.id
              return (
                <React.Fragment key={r.id}>
                <tr className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${selectedIds.has(r.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={selectedIds.has(r.id)}
                      onChange={() => onToggleSelect(r.id)}
                      className="rounded border-gray-300 dark:border-gray-600" />
                  </td>
                  {isEditing ? (
                    <>
                      <td className="px-3 py-2 text-gray-400 dark:text-gray-500 text-xs font-mono">
                        {formatReferenz(r.referenz_nr)}
                      </td>
                      <td className="px-3 py-2">
                        <input type="date" className={inputClass} value={editValues.datum ?? ''}
                          onChange={e => setEditValues(v => ({ ...v, datum: e.target.value }))} />
                      </td>
                      <td className="px-3 py-2">
                        <select className={inputClass} value={editValues.person_id ?? ''}
                          onChange={e => setEditValues(v => ({ ...v, person_id: e.target.value }))}>
                          {personen.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select className={inputClass} value={editValues.leistungserbringer_id ?? ''}
                          onChange={e => setEditValues(v => ({ ...v, leistungserbringer_id: e.target.value }))}>
                          {correspondents.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select className={inputClass} value={editValues.typ ?? ''}
                          onChange={e => setEditValues(v => ({ ...v, typ: e.target.value }))}>
                          <option value="arzt">Arzt</option>
                          <option value="apotheke">Apotheke</option>
                          <option value="krankenhaus">Krankenhaus</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input type="number" step="0.01" className={inputClass + ' text-right'}
                          value={editValues.betrag ?? ''}
                          onChange={e => setEditValues(v => ({ ...v, betrag: parseFloat(e.target.value) || 0 }))} />
                      </td>
                      <td className="px-3 py-2 space-y-1">
                        <div className="flex items-center gap-1">
                          <label className="text-xs text-gray-500 dark:text-gray-400 w-16">Bezahlt</label>
                          <input type="date" className={inputClass}
                            value={editValues.bezahlt_am ?? ''}
                            onChange={e => setEditValues(v => ({ ...v, bezahlt_am: e.target.value }))} />
                        </div>
                        <div className="flex items-center gap-1">
                          <label className="text-xs text-gray-500 dark:text-gray-400 w-16">Beihilfe</label>
                          <input type="date" className={inputClass}
                            value={editValues.beihilfe_eingereicht_am ?? ''}
                            onChange={e => setEditValues(v => ({ ...v, beihilfe_eingereicht_am: e.target.value }))} />
                        </div>
                        <div className="flex items-center gap-1">
                          <label className="text-xs text-gray-500 dark:text-gray-400 w-16">PKV</label>
                          <input type="date" className={inputClass}
                            value={editValues.pkv_eingereicht_am ?? ''}
                            onChange={e => setEditValues(v => ({ ...v, pkv_eingereicht_am: e.target.value }))} />
                        </div>
                      </td>
                      <td className="px-3 py-2 space-y-1">
                        <div className="text-xs text-gray-400 dark:text-gray-500 text-right">
                          {r.beihilfe_anteil_erwartet != null ? formatEuro(r.beihilfe_anteil_erwartet) : '—'}
                        </div>
                        <input type="number" step="0.01" className={inputClass + ' text-right'}
                          placeholder="erstattet"
                          value={editValues.beihilfe_erstattet_betrag ?? ''}
                          onChange={e => {
                            const v = e.target.value
                            setEditValues(prev => ({ ...prev, beihilfe_erstattet_betrag: v === '' ? null : parseFloat(v) || 0 }))
                          }} />
                      </td>
                      <td className="px-3 py-2 space-y-1">
                        <div className="text-xs text-gray-400 dark:text-gray-500 text-right">
                          {r.pkv_anteil_erwartet != null ? formatEuro(r.pkv_anteil_erwartet) : '—'}
                        </div>
                        <input type="number" step="0.01" className={inputClass + ' text-right'}
                          placeholder="erstattet"
                          value={editValues.pkv_erstattet_betrag ?? ''}
                          onChange={e => {
                            const v = e.target.value
                            setEditValues(prev => ({ ...prev, pkv_erstattet_betrag: v === '' ? null : parseFloat(v) || 0 }))
                          }} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" className={inputClass} value={editValues.notiz ?? ''}
                          onChange={e => setEditValues(v => ({ ...v, notiz: e.target.value }))} />
                      </td>
                      <td className="px-3 py-2">
                        <PaperlessBadge r={r} paperlessNgxUrl={paperlessNgxUrl} />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex gap-1">
                          <button onClick={() => saveEdit(r.id)} disabled={saving}
                            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50">
                            Sichern
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600">
                            Abbruch
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-3 whitespace-nowrap font-mono text-xs text-gray-500 dark:text-gray-400">{formatReferenz(r.referenz_nr)}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">{formatDate(r.datum)}</td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{personMap[r.person_id]?.name ?? r.person_id}</td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-300">{corrMap[r.leistungserbringer_id]?.name ?? r.leistungserbringer_id}</td>
                      <td className="px-3 py-3 text-gray-500 dark:text-gray-400 capitalize">{r.typ}</td>
                      <td className="px-3 py-3 text-right font-medium text-gray-800 dark:text-gray-200">{formatEuro(r.betrag)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          <StatusBadge label="Zahlung" status={r.zahlung_status} />
                          <StatusBadge label="Beihilfe" status={r.beihilfe_status} />
                          <StatusBadge label="PKV" status={r.pkv_status} />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {r.beihilfe_anteil_erwartet != null ? (
                          <div className="text-xs text-gray-500 dark:text-gray-400">{formatEuro(r.beihilfe_anteil_erwartet)}</div>
                        ) : null}
                        {r.beihilfe_erstattet_betrag != null ? (
                          <div className={`text-xs font-medium ${r.beihilfe_differenz != null && r.beihilfe_differenz !== 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                            {formatEuro(r.beihilfe_erstattet_betrag)}
                          </div>
                        ) : null}
                        {r.beihilfe_anteil_erwartet == null && r.beihilfe_erstattet_betrag == null ? <span className="text-gray-400">—</span> : null}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {r.pkv_anteil_erwartet != null ? (
                          <div className="text-xs text-gray-500 dark:text-gray-400">{formatEuro(r.pkv_anteil_erwartet)}</div>
                        ) : null}
                        {r.pkv_erstattet_betrag != null ? (
                          <div className={`text-xs font-medium ${r.pkv_differenz != null && r.pkv_differenz !== 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                            {formatEuro(r.pkv_erstattet_betrag)}
                          </div>
                        ) : null}
                        {r.pkv_anteil_erwartet == null && r.pkv_erstattet_betrag == null ? <span className="text-gray-400">—</span> : null}
                      </td>
                      <td className="px-3 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">{r.notiz ?? '—'}</td>
                      <td className="px-3 py-3">
                        <PaperlessBadge r={r} paperlessNgxUrl={paperlessNgxUrl} />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex gap-1">
                          {!archivModus && (
                            <button onClick={() => startEdit(r)}
                              className="px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-700 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30">
                              Bearbeiten
                            </button>
                          )}
                          <button
                            onClick={() => setAnhangExpandedId(id => id === r.id ? null : r.id)}
                            className={`px-2 py-1 text-xs border rounded ${anhangExpandedId === r.id ? 'border-gray-400 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                            title="Anhänge"
                          >
                            📎
                          </button>
                          <button
                            onClick={() => onArchivToggle(r.id, !archivModus)}
                            className="px-2 py-1 text-xs text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700 rounded hover:bg-amber-50 dark:hover:bg-amber-900/30"
                          >
                            {archivModus ? 'Wiederherstellen' : 'Archivieren'}
                          </button>
                          <button onClick={() => onDelete(r.id)}
                            className="px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 border border-red-200 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/30">
                            Löschen
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
                {/* Anhang-Expandier-Zeile (Desktop) */}
                {anhangExpandedId === r.id && (
                  <tr className="bg-gray-50 dark:bg-gray-700/30">
                    <td colSpan={12} className="px-6 py-3">
                      <AnhangUpload rechnungId={r.id} compact />
                    </td>
                  </tr>
                )}
                </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  </div>
  )
}
