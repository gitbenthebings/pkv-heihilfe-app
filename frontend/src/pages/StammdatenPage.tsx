import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getBeihilfestellen, createBeihilfestelle, updateBeihilfestelle, deleteBeihilfestelle } from '../api/beihilfestellen'
import { getPersonen, createPerson, updatePerson, deletePerson } from '../api/personen'
import { getCorrespondents, createCorrespondent, updateCorrespondent, deleteCorrespondent } from '../api/correspondents'
import { getBenutzer, createBenutzer, updateBenutzer, changePasswort, deleteBenutzer } from '../api/benutzer'
import { getEinstellungen, updateEinstellungen, testPaperlessConnection, testGdriveConnection } from '../api/einstellungen'
import { getScanMaxDim, getScanJpegQuality, setScanMaxDim, setScanJpegQuality, DEFAULT_MAX_DIM, DEFAULT_JPEG_QUALITY } from '../utils/scanSettings'
import type {
  Beihilfestelle, CreateBeihilfestelle, UpdateBeihilfestelle,
  Person, CreatePerson, UpdatePerson,
  Correspondent, CreateCorrespondent, UpdateCorrespondent,
  Benutzer, CreateBenutzer, UpdateBenutzer,
} from '../types'

type Tab = 'personen' | 'correspondents' | 'beihilfestellen' | 'benutzer' | 'einstellungen'

const tabLabels: Record<Tab, string> = {
  personen: 'Personen',
  correspondents: 'Leistungserbringer',
  beihilfestellen: 'Beihilfestellen',
  benutzer: 'Benutzer',
  einstellungen: 'Einstellungen',
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const inputCls = 'border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full'
const btnPrimary = 'px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50'
const btnSecondary = 'px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600'
const btnEdit = 'px-2 py-1 text-xs text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30'
const btnDelete = 'px-2 py-1 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/30'

function th(label: string) {
  return (
    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">
      {label}
    </th>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">{label}</label>
      {children}
    </div>
  )
}

function DeleteError({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded p-3 text-sm text-red-700 dark:text-red-300 flex justify-between">
      <span>{msg}</span>
      <button onClick={onClose} className="text-red-400 hover:text-red-600 ml-2">×</button>
    </div>
  )
}

// ─── Beihilfestellen ──────────────────────────────────────────────────────────

const dienstherr_typen = ['bund', 'land', 'kommune'] as const
const dienstherr_label: Record<string, string> = { bund: 'Bund', land: 'Land', kommune: 'Kommune' }

function BeihilfestellenTab() {
  const qc = useQueryClient()
  const { data: items = [], isLoading, error } = useQuery({ queryKey: ['beihilfestellen'], queryFn: getBeihilfestellen })
  const [editId, setEditId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<UpdateBeihilfestelle>({})
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState<CreateBeihilfestelle>({ name: '', dienstherr_typ: 'bund' })
  const [saving, setSaving] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const inv = () => qc.invalidateQueries({ queryKey: ['beihilfestellen'] })
  const createMut = useMutation({ mutationFn: createBeihilfestelle, onSuccess: () => { inv(); setShowNew(false); setNewForm({ name: '', dienstherr_typ: 'bund' }) } })
  const updateMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: UpdateBeihilfestelle }) => updateBeihilfestelle(id, data), onSuccess: () => { inv(); setEditId(null) } })
  const deleteMut = useMutation({ mutationFn: deleteBeihilfestelle, onSuccess: () => { inv(); setDeleteError('') }, onError: (e: Error) => setDeleteError(e.message) })

  const startEdit = (b: Beihilfestelle) => { setEditId(b.id); setEditValues({ name: b.name, dienstherr_typ: b.dienstherr_typ }) }
  const saveEdit = async () => { setSaving(true); try { await updateMut.mutateAsync({ id: editId!, data: editValues }) } finally { setSaving(false) } }
  const handleDelete = (id: string) => { if (confirm('Beihilfestelle wirklich löschen?')) deleteMut.mutate(id) }

  if (isLoading) return <p className="text-gray-500 dark:text-gray-400 text-sm py-4">Lade...</p>
  if (error) return <p className="text-red-600 dark:text-red-400 text-sm py-4">Fehler: {(error as Error).message}</p>

  const editForm = (onSave: () => void, onCancel: () => void) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Name"><input className={inputCls} value={editValues.name ?? ''} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} /></Field>
      <Field label="Dienstherr">
        <select className={inputCls} value={editValues.dienstherr_typ ?? ''} onChange={e => setEditValues(v => ({ ...v, dienstherr_typ: e.target.value as UpdateBeihilfestelle['dienstherr_typ'] }))}>
          {dienstherr_typen.map(t => <option key={t} value={t}>{dienstherr_label[t]}</option>)}
        </select>
      </Field>
      <div className="flex gap-2 sm:col-span-2">
        <button className={btnPrimary} disabled={saving} onClick={onSave}>Sichern</button>
        <button className={btnSecondary} onClick={onCancel}>Abbrechen</button>
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      {deleteError && <DeleteError msg={deleteError} onClose={() => setDeleteError('')} />}

      <div className="flex justify-end">
        <button onClick={() => setShowNew(s => !s)} className={btnPrimary + ' text-sm px-4'}>
          {showNew ? 'Abbrechen' : '+ Neue Beihilfestelle'}
        </button>
      </div>

      {showNew && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-3">Neue Beihilfestelle</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
            <Field label="Name"><input className={inputCls} value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Dienstherr">
              <select className={inputCls} value={newForm.dienstherr_typ} onChange={e => setNewForm(f => ({ ...f, dienstherr_typ: e.target.value as CreateBeihilfestelle['dienstherr_typ'] }))}>
                {dienstherr_typen.map(t => <option key={t} value={t}>{dienstherr_label[t]}</option>)}
              </select>
            </Field>
          </div>
          <div className="flex gap-2 mt-3">
            <button className={btnPrimary} disabled={!newForm.name} onClick={() => createMut.mutate(newForm)}>Speichern</button>
            <button className={btnSecondary} onClick={() => setShowNew(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      {/* Mobile: Karten */}
      <div className="sm:hidden space-y-2">
        {items.length === 0 && <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-6">Keine Einträge</p>}
        {items.map(b => editId === b.id ? (
          <div key={b.id} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
            {editForm(saveEdit, () => setEditId(null))}
          </div>
        ) : (
          <div key={b.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{b.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{dienstherr_label[b.dienstherr_typ]}</p>
            </div>
            <div className="flex gap-1.5 shrink-0 ml-2">
              <button className={btnEdit} onClick={() => startEdit(b)}>Bearb.</button>
              <button className={btnDelete} onClick={() => handleDelete(b.id)}>Lösch.</button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Tabelle */}
      <div className="hidden sm:block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700"><tr>{th('Name')}{th('Dienstherr')}<th /></tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.length === 0 && <tr><td colSpan={3} className="px-3 py-8 text-center text-gray-400 dark:text-gray-500">Keine Einträge</td></tr>}
            {items.map(b => editId === b.id ? (
              <tr key={b.id} className="bg-blue-50 dark:bg-blue-900/10">
                <td className="px-3 py-2"><input className={inputCls} value={editValues.name ?? ''} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} /></td>
                <td className="px-3 py-2"><select className={inputCls} value={editValues.dienstherr_typ ?? ''} onChange={e => setEditValues(v => ({ ...v, dienstherr_typ: e.target.value as UpdateBeihilfestelle['dienstherr_typ'] }))}>{dienstherr_typen.map(t => <option key={t} value={t}>{dienstherr_label[t]}</option>)}</select></td>
                <td className="px-3 py-2 whitespace-nowrap"><div className="flex gap-1"><button className={btnPrimary} disabled={saving} onClick={saveEdit}>Sichern</button><button className={btnSecondary} onClick={() => setEditId(null)}>Abbruch</button></div></td>
              </tr>
            ) : (
              <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-3 py-3 text-gray-800 dark:text-gray-200">{b.name}</td>
                <td className="px-3 py-3 text-gray-600 dark:text-gray-400">{dienstherr_label[b.dienstherr_typ]}</td>
                <td className="px-3 py-3 whitespace-nowrap"><div className="flex gap-1"><button className={btnEdit} onClick={() => startEdit(b)}>Bearbeiten</button><button className={btnDelete} onClick={() => handleDelete(b.id)}>Löschen</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Personen ─────────────────────────────────────────────────────────────────

function PersonenTab() {
  const qc = useQueryClient()
  const { data: personen = [], isLoading, error } = useQuery({ queryKey: ['personen'], queryFn: getPersonen })
  const { data: beihilfestellen = [] } = useQuery({ queryKey: ['beihilfestellen'], queryFn: getBeihilfestellen })
  const [editId, setEditId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<UpdatePerson>({})
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState<CreatePerson>({ name: '', geburtsdatum: '', typ: 'erwachsener', beihilfe_satz: 0, pkv_satz: 0, bre_schwelle: null })
  const [saving, setSaving] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const inv = () => { qc.invalidateQueries({ queryKey: ['personen'] }); qc.invalidateQueries({ queryKey: ['rechnungen'] }) }
  const createMut = useMutation({ mutationFn: createPerson, onSuccess: () => { inv(); setShowNew(false); setNewForm({ name: '', geburtsdatum: '', typ: 'erwachsener', beihilfe_satz: 0, pkv_satz: 0, bre_schwelle: null }) } })
  const updateMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: UpdatePerson }) => updatePerson(id, data), onSuccess: () => { inv(); setEditId(null) } })
  const deleteMut = useMutation({ mutationFn: deletePerson, onSuccess: () => { inv(); setDeleteError('') }, onError: (e: Error) => setDeleteError(e.message) })

  const startEdit = (p: Person) => { setEditId(p.id); setEditValues({ name: p.name, geburtsdatum: p.geburtsdatum, typ: p.typ, beihilfestelle_id: p.beihilfestelle_id ?? '', beihilfe_satz: p.beihilfe_satz, pkv_satz: p.pkv_satz, bre_schwelle: p.bre_schwelle }) }
  const saveEdit = async () => { setSaving(true); try { await updateMut.mutateAsync({ id: editId!, data: editValues }) } finally { setSaving(false) } }
  const handleDelete = (id: string) => { if (confirm('Person wirklich löschen?')) deleteMut.mutate(id) }

  const bhMap = Object.fromEntries(beihilfestellen.map(b => [b.id, b.name]))

  if (isLoading) return <p className="text-gray-500 dark:text-gray-400 text-sm py-4">Lade...</p>
  if (error) return <p className="text-red-600 dark:text-red-400 text-sm py-4">Fehler: {(error as Error).message}</p>

  const personEditFields = (vals: UpdatePerson, setVals: (fn: (v: UpdatePerson) => UpdatePerson) => void) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <Field label="Name"><input className={inputCls} value={vals.name ?? ''} onChange={e => setVals(v => ({ ...v, name: e.target.value }))} /></Field>
      <Field label="Geburtsdatum"><input type="date" className={inputCls} value={vals.geburtsdatum ?? ''} onChange={e => setVals(v => ({ ...v, geburtsdatum: e.target.value }))} /></Field>
      <Field label="Typ">
        <select className={inputCls} value={vals.typ ?? ''} onChange={e => setVals(v => ({ ...v, typ: e.target.value as UpdatePerson['typ'] }))}>
          <option value="erwachsener">Erwachsener</option><option value="kind">Kind</option>
        </select>
      </Field>
      <Field label="Beihilfestelle">
        <select className={inputCls} value={vals.beihilfestelle_id ?? ''} onChange={e => setVals(v => ({ ...v, beihilfestelle_id: e.target.value }))}>
          <option value="">— keine —</option>
          {beihilfestellen.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </Field>
      <Field label="Beihilfe-Satz (%)"><input type="number" min="0" max="100" className={inputCls} value={vals.beihilfe_satz ?? 0} onChange={e => setVals(v => ({ ...v, beihilfe_satz: parseInt(e.target.value) || 0 }))} /></Field>
      <Field label="PKV-Satz (%)"><input type="number" min="0" max="100" className={inputCls} value={vals.pkv_satz ?? 0} onChange={e => setVals(v => ({ ...v, pkv_satz: parseInt(e.target.value) || 0 }))} /></Field>
      <Field label="BRE-Schwelle (€)"><input type="number" min="0" step="0.01" className={inputCls} placeholder="— keine —" value={vals.bre_schwelle ?? ''} onChange={e => setVals(v => ({ ...v, bre_schwelle: e.target.value === '' ? null : parseFloat(e.target.value) }))} /></Field>
    </div>
  )

  return (
    <div className="space-y-3">
      {deleteError && <DeleteError msg={deleteError} onClose={() => setDeleteError('')} />}

      <div className="flex justify-end">
        <button onClick={() => setShowNew(s => !s)} className={btnPrimary + ' text-sm px-4'}>
          {showNew ? 'Abbrechen' : '+ Neue Person'}
        </button>
      </div>

      {showNew && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-3">Neue Person</h3>
          {personEditFields(newForm as UpdatePerson, fn => setNewForm(f => fn(f as UpdatePerson) as CreatePerson))}
          <div className="flex gap-2 mt-3">
            <button className={btnPrimary} disabled={!newForm.name || !newForm.geburtsdatum} onClick={() => createMut.mutate(newForm)}>Speichern</button>
            <button className={btnSecondary} onClick={() => setShowNew(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      {/* Mobile: Karten */}
      <div className="sm:hidden space-y-2">
        {personen.length === 0 && <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-6">Keine Einträge</p>}
        {personen.map(p => editId === p.id ? (
          <div key={p.id} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 space-y-3">
            {personEditFields(editValues, setEditValues)}
            <div className="flex gap-2">
              <button className={btnPrimary} disabled={saving} onClick={saveEdit}>Sichern</button>
              <button className={btnSecondary} onClick={() => setEditId(null)}>Abbrechen</button>
            </div>
          </div>
        ) : (
          <div key={p.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="flex justify-between items-start">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{p.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {new Date(p.geburtsdatum).toLocaleDateString('de-DE')} · {p.typ === 'erwachsener' ? 'Erwachsener' : 'Kind'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {p.beihilfestelle_id ? bhMap[p.beihilfestelle_id] ?? '—' : '— keine Beihilfe —'}
                  {' · '}Beihilfe {p.beihilfe_satz} % / PKV {p.pkv_satz} %
                </p>
                {p.bre_schwelle != null && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    BRE-Schwelle: {p.bre_schwelle.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </p>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0 ml-2">
                <button className={btnEdit} onClick={() => startEdit(p)}>Bearb.</button>
                <button className={btnDelete} onClick={() => handleDelete(p.id)}>Lösch.</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Tabelle */}
      <div className="hidden sm:block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>{th('Name')}{th('Geburtsdatum')}{th('Typ')}{th('Beihilfestelle')}{th('Beihilfe %')}{th('PKV %')}{th('BRE-Schwelle')}<th /></tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {personen.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400 dark:text-gray-500">Keine Einträge</td></tr>}
            {personen.map(p => editId === p.id ? (
              <tr key={p.id} className="bg-blue-50 dark:bg-blue-900/10">
                <td className="px-3 py-2"><input className={inputCls} value={editValues.name ?? ''} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} /></td>
                <td className="px-3 py-2"><input type="date" className={inputCls} value={editValues.geburtsdatum ?? ''} onChange={e => setEditValues(v => ({ ...v, geburtsdatum: e.target.value }))} /></td>
                <td className="px-3 py-2"><select className={inputCls} value={editValues.typ ?? ''} onChange={e => setEditValues(v => ({ ...v, typ: e.target.value as UpdatePerson['typ'] }))}><option value="erwachsener">Erwachsener</option><option value="kind">Kind</option></select></td>
                <td className="px-3 py-2"><select className={inputCls} value={editValues.beihilfestelle_id ?? ''} onChange={e => setEditValues(v => ({ ...v, beihilfestelle_id: e.target.value }))}><option value="">— keine —</option>{beihilfestellen.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></td>
                <td className="px-3 py-2"><input type="number" min="0" max="100" className={inputCls} value={editValues.beihilfe_satz ?? 0} onChange={e => setEditValues(v => ({ ...v, beihilfe_satz: parseInt(e.target.value) || 0 }))} /></td>
                <td className="px-3 py-2"><input type="number" min="0" max="100" className={inputCls} value={editValues.pkv_satz ?? 0} onChange={e => setEditValues(v => ({ ...v, pkv_satz: parseInt(e.target.value) || 0 }))} /></td>
                <td className="px-3 py-2"><input type="number" min="0" step="0.01" className={inputCls} placeholder="— keine —" value={editValues.bre_schwelle ?? ''} onChange={e => setEditValues(v => ({ ...v, bre_schwelle: e.target.value === '' ? null : parseFloat(e.target.value) }))} /></td>
                <td className="px-3 py-2 whitespace-nowrap"><div className="flex gap-1"><button className={btnPrimary} disabled={saving} onClick={saveEdit}>Sichern</button><button className={btnSecondary} onClick={() => setEditId(null)}>Abbruch</button></div></td>
              </tr>
            ) : (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-3 py-3 font-medium text-gray-800 dark:text-gray-200">{p.name}</td>
                <td className="px-3 py-3 text-gray-600 dark:text-gray-400">{new Date(p.geburtsdatum).toLocaleDateString('de-DE')}</td>
                <td className="px-3 py-3 text-gray-600 dark:text-gray-400 capitalize">{p.typ}</td>
                <td className="px-3 py-3 text-gray-600 dark:text-gray-400">{p.beihilfestelle_id ? (bhMap[p.beihilfestelle_id] ?? '—') : '—'}</td>
                <td className="px-3 py-3 text-gray-600 dark:text-gray-400">{p.beihilfe_satz} %</td>
                <td className="px-3 py-3 text-gray-600 dark:text-gray-400">{p.pkv_satz} %</td>
                <td className="px-3 py-3 text-gray-600 dark:text-gray-400">{p.bre_schwelle != null ? p.bre_schwelle.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '—'}</td>
                <td className="px-3 py-3 whitespace-nowrap"><div className="flex gap-1"><button className={btnEdit} onClick={() => startEdit(p)}>Bearbeiten</button><button className={btnDelete} onClick={() => handleDelete(p.id)}>Löschen</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Correspondents ───────────────────────────────────────────────────────────

const corrTypen = ['arzt', 'krankenhaus', 'apotheke', 'abrechnungsstelle'] as const
const corrTypLabel: Record<string, string> = { arzt: 'Arzt', krankenhaus: 'Krankenhaus', apotheke: 'Apotheke', abrechnungsstelle: 'Abrechnungsstelle' }

function CorrespondentsTab() {
  const qc = useQueryClient()
  const { data: items = [], isLoading, error } = useQuery({ queryKey: ['correspondents'], queryFn: getCorrespondents })
  const [editId, setEditId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<UpdateCorrespondent>({})
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState<CreateCorrespondent>({ name: '', typ: 'arzt' })
  const [saving, setSaving] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const inv = () => { qc.invalidateQueries({ queryKey: ['correspondents'] }); qc.invalidateQueries({ queryKey: ['rechnungen'] }) }
  const createMut = useMutation({ mutationFn: createCorrespondent, onSuccess: () => { inv(); setShowNew(false); setNewForm({ name: '', typ: 'arzt' }) } })
  const updateMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: UpdateCorrespondent }) => updateCorrespondent(id, data), onSuccess: () => { inv(); setEditId(null) } })
  const deleteMut = useMutation({ mutationFn: deleteCorrespondent, onSuccess: () => { inv(); setDeleteError('') }, onError: (e: Error) => setDeleteError(e.message) })

  const startEdit = (c: Correspondent) => { setEditId(c.id); setEditValues({ name: c.name, typ: c.typ }) }
  const saveEdit = async () => { setSaving(true); try { await updateMut.mutateAsync({ id: editId!, data: editValues }) } finally { setSaving(false) } }
  const handleDelete = (id: string) => { if (confirm('Leistungserbringer wirklich löschen?')) deleteMut.mutate(id) }

  if (isLoading) return <p className="text-gray-500 dark:text-gray-400 text-sm py-4">Lade...</p>
  if (error) return <p className="text-red-600 dark:text-red-400 text-sm py-4">Fehler: {(error as Error).message}</p>

  return (
    <div className="space-y-3">
      {deleteError && <DeleteError msg={deleteError} onClose={() => setDeleteError('')} />}

      <div className="flex justify-end">
        <button onClick={() => setShowNew(s => !s)} className={btnPrimary + ' text-sm px-4'}>
          {showNew ? 'Abbrechen' : '+ Neuer Leistungserbringer'}
        </button>
      </div>

      {showNew && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-3">Neuer Leistungserbringer</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
            <Field label="Name"><input className={inputCls} value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Typ">
              <select className={inputCls} value={newForm.typ} onChange={e => setNewForm(f => ({ ...f, typ: e.target.value as CreateCorrespondent['typ'] }))}>
                {corrTypen.map(t => <option key={t} value={t}>{corrTypLabel[t]}</option>)}
              </select>
            </Field>
          </div>
          <div className="flex gap-2 mt-3">
            <button className={btnPrimary} disabled={!newForm.name} onClick={() => createMut.mutate(newForm)}>Speichern</button>
            <button className={btnSecondary} onClick={() => setShowNew(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      {/* Mobile: Karten */}
      <div className="sm:hidden space-y-2">
        {items.length === 0 && <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-6">Keine Einträge</p>}
        {items.map(c => editId === c.id ? (
          <div key={c.id} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <Field label="Name"><input className={inputCls} value={editValues.name ?? ''} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} /></Field>
              <Field label="Typ">
                <select className={inputCls} value={editValues.typ ?? ''} onChange={e => setEditValues(v => ({ ...v, typ: e.target.value as UpdateCorrespondent['typ'] }))}>
                  {corrTypen.map(t => <option key={t} value={t}>{corrTypLabel[t]}</option>)}
                </select>
              </Field>
            </div>
            <div className="flex gap-2">
              <button className={btnPrimary} disabled={saving} onClick={saveEdit}>Sichern</button>
              <button className={btnSecondary} onClick={() => setEditId(null)}>Abbrechen</button>
            </div>
          </div>
        ) : (
          <div key={c.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{c.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{corrTypLabel[c.typ]}</p>
            </div>
            <div className="flex gap-1.5 shrink-0 ml-2">
              <button className={btnEdit} onClick={() => startEdit(c)}>Bearb.</button>
              <button className={btnDelete} onClick={() => handleDelete(c.id)}>Lösch.</button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Tabelle */}
      <div className="hidden sm:block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700"><tr>{th('Name')}{th('Typ')}<th /></tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.length === 0 && <tr><td colSpan={3} className="px-3 py-8 text-center text-gray-400 dark:text-gray-500">Keine Einträge</td></tr>}
            {items.map(c => editId === c.id ? (
              <tr key={c.id} className="bg-blue-50 dark:bg-blue-900/10">
                <td className="px-3 py-2"><input className={inputCls} value={editValues.name ?? ''} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} /></td>
                <td className="px-3 py-2"><select className={inputCls} value={editValues.typ ?? ''} onChange={e => setEditValues(v => ({ ...v, typ: e.target.value as UpdateCorrespondent['typ'] }))}>{corrTypen.map(t => <option key={t} value={t}>{corrTypLabel[t]}</option>)}</select></td>
                <td className="px-3 py-2 whitespace-nowrap"><div className="flex gap-1"><button className={btnPrimary} disabled={saving} onClick={saveEdit}>Sichern</button><button className={btnSecondary} onClick={() => setEditId(null)}>Abbruch</button></div></td>
              </tr>
            ) : (
              <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-3 py-3 font-medium text-gray-800 dark:text-gray-200">{c.name}</td>
                <td className="px-3 py-3 text-gray-600 dark:text-gray-400">{corrTypLabel[c.typ]}</td>
                <td className="px-3 py-3 whitespace-nowrap"><div className="flex gap-1"><button className={btnEdit} onClick={() => startEdit(c)}>Bearbeiten</button><button className={btnDelete} onClick={() => handleDelete(c.id)}>Löschen</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Benutzer ─────────────────────────────────────────────────────────────────

function BenutzerTab() {
  const qc = useQueryClient()
  const { data: items = [], isLoading, error } = useQuery({ queryKey: ['benutzer'], queryFn: getBenutzer })
  const [editId, setEditId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<UpdateBenutzer>({})
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState<CreateBenutzer>({ name: '', email: '', passwort: '' })
  const [saving, setSaving] = useState(false)

  const [pwId, setPwId] = useState<string | null>(null)
  const [pwForm, setPwForm] = useState({ altes_passwort: '', neues_passwort: '', bestaetigung: '' })
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)

  const inv = () => qc.invalidateQueries({ queryKey: ['benutzer'] })
  const createMut = useMutation({ mutationFn: createBenutzer, onSuccess: () => { inv(); setShowNew(false); setNewForm({ name: '', email: '', passwort: '' }) } })
  const updateMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: UpdateBenutzer }) => updateBenutzer(id, data), onSuccess: () => { inv(); setEditId(null) } })
  const deleteMut = useMutation({ mutationFn: deleteBenutzer, onSuccess: inv })

  const startEdit = (b: Benutzer) => { setEditId(b.id); setEditValues({ name: b.name, email: b.email }) }
  const saveEdit = async () => { setSaving(true); try { await updateMut.mutateAsync({ id: editId!, data: editValues }) } finally { setSaving(false) } }
  const handleDelete = (id: string) => { if (confirm('Benutzer wirklich löschen?')) deleteMut.mutate(id) }

  const openPw = (id: string) => { setPwId(id); setPwForm({ altes_passwort: '', neues_passwort: '', bestaetigung: '' }); setPwError('') }
  const savePw = async () => {
    if (pwForm.neues_passwort !== pwForm.bestaetigung) { setPwError('Passwörter stimmen nicht überein'); return }
    if (pwForm.neues_passwort.length < 6) { setPwError('Mindestens 6 Zeichen'); return }
    setPwSaving(true); setPwError('')
    try {
      await changePasswort(pwId!, pwForm.altes_passwort, pwForm.neues_passwort)
      setPwId(null); setPwSuccess(true)
      setTimeout(() => setPwSuccess(false), 3000)
    } catch (e) {
      setPwError((e as Error).message)
    } finally {
      setPwSaving(false)
    }
  }

  if (isLoading) return <p className="text-gray-500 dark:text-gray-400 text-sm py-4">Lade...</p>
  if (error) return <p className="text-red-600 dark:text-red-400 text-sm py-4">Fehler: {(error as Error).message}</p>

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setShowNew(s => !s)} className={btnPrimary + ' text-sm px-4'}>
          {showNew ? 'Abbrechen' : '+ Neuer Benutzer'}
        </button>
      </div>

      {pwSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded p-3 text-sm text-green-700 dark:text-green-300">
          Passwort erfolgreich geändert.
        </div>
      )}

      {showNew && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-3">Neuer Benutzer</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Name"><input className={inputCls} value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="E-Mail"><input type="email" className={inputCls} value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} /></Field>
            <Field label="Passwort"><input type="password" className={inputCls} value={newForm.passwort} onChange={e => setNewForm(f => ({ ...f, passwort: e.target.value }))} /></Field>
          </div>
          <div className="flex gap-2 mt-3">
            <button className={btnPrimary} disabled={!newForm.name || !newForm.email || !newForm.passwort} onClick={() => createMut.mutate(newForm)}>Speichern</button>
            <button className={btnSecondary} onClick={() => setShowNew(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      {pwId && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-200 mb-3">Passwort ändern</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Aktuelles Passwort"><input type="password" className={inputCls} value={pwForm.altes_passwort} onChange={e => setPwForm(f => ({ ...f, altes_passwort: e.target.value }))} /></Field>
            <Field label="Neues Passwort"><input type="password" className={inputCls} value={pwForm.neues_passwort} onChange={e => setPwForm(f => ({ ...f, neues_passwort: e.target.value }))} /></Field>
            <Field label="Bestätigung"><input type="password" className={inputCls} value={pwForm.bestaetigung} onChange={e => setPwForm(f => ({ ...f, bestaetigung: e.target.value }))} /></Field>
          </div>
          {pwError && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{pwError}</p>}
          <div className="flex gap-2 mt-3">
            <button className={btnPrimary} disabled={pwSaving || !pwForm.altes_passwort || !pwForm.neues_passwort} onClick={savePw}>Speichern</button>
            <button className={btnSecondary} onClick={() => setPwId(null)}>Abbrechen</button>
          </div>
        </div>
      )}

      {/* Mobile: Karten */}
      <div className="sm:hidden space-y-2">
        {items.length === 0 && <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-6">Keine Einträge</p>}
        {items.map(b => editId === b.id ? (
          <div key={b.id} className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 space-y-3">
            <div className="grid grid-cols-1 gap-3">
              <Field label="Name"><input className={inputCls} value={editValues.name ?? ''} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} /></Field>
              <Field label="E-Mail"><input type="email" className={inputCls} value={editValues.email ?? ''} onChange={e => setEditValues(v => ({ ...v, email: e.target.value }))} /></Field>
            </div>
            <div className="flex gap-2">
              <button className={btnPrimary} disabled={saving} onClick={saveEdit}>Sichern</button>
              <button className={btnSecondary} onClick={() => setEditId(null)}>Abbrechen</button>
            </div>
          </div>
        ) : (
          <div key={b.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="flex justify-between items-start">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{b.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{b.email}</p>
              </div>
              <div className="flex gap-1.5 shrink-0 ml-2">
                <button className={btnEdit} onClick={() => startEdit(b)}>Bearb.</button>
                <button className="px-2 py-1 text-xs text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700 rounded hover:bg-yellow-50 dark:hover:bg-yellow-900/30" onClick={() => openPw(b.id)}>PW</button>
                <button className={btnDelete} onClick={() => handleDelete(b.id)}>Lösch.</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Tabelle */}
      <div className="hidden sm:block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700"><tr>{th('Name')}{th('E-Mail')}<th /></tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.length === 0 && <tr><td colSpan={3} className="px-3 py-8 text-center text-gray-400 dark:text-gray-500">Keine Einträge</td></tr>}
            {items.map(b => editId === b.id ? (
              <tr key={b.id} className="bg-blue-50 dark:bg-blue-900/10">
                <td className="px-3 py-2"><input className={inputCls} value={editValues.name ?? ''} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} /></td>
                <td className="px-3 py-2"><input type="email" className={inputCls} value={editValues.email ?? ''} onChange={e => setEditValues(v => ({ ...v, email: e.target.value }))} /></td>
                <td className="px-3 py-2 whitespace-nowrap"><div className="flex gap-1"><button className={btnPrimary} disabled={saving} onClick={saveEdit}>Sichern</button><button className={btnSecondary} onClick={() => setEditId(null)}>Abbruch</button></div></td>
              </tr>
            ) : (
              <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-3 py-3 font-medium text-gray-800 dark:text-gray-200">{b.name}</td>
                <td className="px-3 py-3 text-gray-600 dark:text-gray-400">{b.email}</td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="flex gap-1">
                    <button className={btnEdit} onClick={() => startEdit(b)}>Bearbeiten</button>
                    <button className="px-2 py-1 text-xs text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700 rounded hover:bg-yellow-50 dark:hover:bg-yellow-900/30" onClick={() => openPw(b.id)}>Passwort</button>
                    <button className={btnDelete} onClick={() => handleDelete(b.id)}>Löschen</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Einstellungen ────────────────────────────────────────────────────────────

function GdriveAnleitung() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-md border border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-800 dark:text-blue-200">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 font-medium text-left"
      >
        <span>Einrichtungsanleitung</span>
        <span className="text-blue-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-blue-100 dark:border-blue-900 pt-2">
          <div>
            <p className="font-semibold mb-1">1. Google Cloud Projekt & Service Account</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700 dark:text-blue-300">
              <li>Gehe zu <span className="font-mono">console.cloud.google.com</span> und erstelle ein Projekt</li>
              <li>Suche nach <span className="font-semibold">Google Drive API</span> und aktiviere sie</li>
              <li>Navigiere zu <span className="font-semibold">IAM &amp; Admin → Service Accounts → Service Account erstellen</span></li>
              <li>Name vergeben (z. B. <span className="font-mono">pkv-export</span>), keine Rolle nötig</li>
              <li>Service Account öffnen → <span className="font-semibold">Schlüssel → Schlüssel hinzufügen → JSON</span></li>
              <li>Die heruntergeladene JSON-Datei vollständig in das Feld unten einfügen</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold mb-1">2. Ordner in Google Drive freigeben</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700 dark:text-blue-300">
              <li>Einen Ordner in Google Drive erstellen (z. B. <span className="font-mono">PKV-Rechnungen</span>)</li>
              <li>Rechtsklick auf den Ordner → <span className="font-semibold">Freigeben</span></li>
              <li>Die <span className="font-semibold">client_email</span> aus dem JSON eintragen (z. B. <span className="font-mono">pkv-export@projekt.iam.gserviceaccount.com</span>)</li>
              <li>Rolle <span className="font-semibold">Bearbeiter</span> wählen → Senden</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold mb-1">3. Ordner-ID ermitteln</p>
            <p className="text-blue-700 dark:text-blue-300">
              Den Ordner in Google Drive öffnen – die ID steht in der URL:{' '}
              <span className="font-mono break-all">drive.google.com/drive/folders/<span className="font-semibold underline">1BxiMVs0XRA5…</span></span>
            </p>
          </div>
          <div className="border-t border-blue-100 dark:border-blue-900 pt-2">
            <p className="font-semibold mb-1">4. Einrichten &amp; testen</p>
            <p className="text-blue-700 dark:text-blue-300">JSON einfügen, Ordner-ID eingeben, auf <span className="font-semibold">Verbindung testen</span> klicken. Bei Erfolg speichern – der Google Drive-Export ist damit in der Rechnungstabelle verfügbar.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function EinstellungenTab() {
  const qc = useQueryClient()
  const { data: srv } = useQuery({ queryKey: ['einstellungen'], queryFn: getEinstellungen })

  // Paperless fields
  const [plUrl, setPlUrl] = useState<string | null>(null)
  const [plToken, setPlToken] = useState<string | null>(null)
  const [plTestResult, setPlTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [plTesting, setPlTesting] = useState(false)
  const [plSaving, setPlSaving] = useState(false)

  // Google Drive fields
  const [gdJson, setGdJson] = useState('')
  const [gdFolderId, setGdFolderId] = useState<string | null>(null)
  const [gdShowJsonInput, setGdShowJsonInput] = useState(false)
  const [gdTestResult, setGdTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [gdTesting, setGdTesting] = useState(false)
  const [gdSaving, setGdSaving] = useState(false)

  // Shared save message
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  // Scan settings (localStorage)
  const [maxDim, setMaxDimState] = useState(() => getScanMaxDim())
  const [jpegQuality, setJpegQualityState] = useState(() => Math.round(getScanJpegQuality() * 100))

  const effectivePlUrl = plUrl ?? srv?.paperless_ngx_url ?? ''
  const effectivePlToken = plToken ?? srv?.paperless_ngx_token ?? ''
  const effectiveGdFolderId = gdFolderId ?? srv?.gdrive_folder_id ?? ''

  const savePaperless = async () => {
    setPlSaving(true)
    setSaveMsg(null)
    try {
      await updateEinstellungen({ paperless_ngx_url: effectivePlUrl, paperless_ngx_token: effectivePlToken })
      qc.invalidateQueries({ queryKey: ['einstellungen'] })
      qc.invalidateQueries({ queryKey: ['config'] })
      setSaveMsg('Paperless gespeichert')
      setPlUrl(null)
      setPlToken(null)
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setPlSaving(false)
    }
  }

  const testPaperless = async () => {
    setPlTesting(true)
    setPlTestResult(null)
    try {
      const res = await testPaperlessConnection(effectivePlUrl, effectivePlToken)
      setPlTestResult(res)
    } catch (e) {
      setPlTestResult({ ok: false, message: e instanceof Error ? e.message : 'Fehler' })
    } finally {
      setPlTesting(false)
    }
  }

  const saveGdrive = async () => {
    setGdSaving(true)
    setSaveMsg(null)
    try {
      const update: Record<string, string> = { gdrive_folder_id: effectiveGdFolderId }
      if (gdJson.trim()) update.gdrive_service_account_json = gdJson.trim()
      await updateEinstellungen(update)
      qc.invalidateQueries({ queryKey: ['einstellungen'] })
      qc.invalidateQueries({ queryKey: ['config'] })
      setSaveMsg('Google Drive gespeichert')
      setGdJson('')
      setGdShowJsonInput(false)
      setGdFolderId(null)
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'Fehler')
    } finally {
      setGdSaving(false)
    }
  }

  const testGdrive = async () => {
    const jsonToTest = gdJson.trim() || null
    if (!jsonToTest && !srv?.gdrive_service_account_configured) {
      setGdTestResult({ ok: false, message: 'Bitte zuerst Service Account JSON eingeben' })
      return
    }
    setGdTesting(true)
    setGdTestResult(null)
    try {
      // Wenn kein neues JSON eingegeben: wir können nicht direkt testen (Server gibt JSON nicht zurück)
      // → Nur testen wenn ein JSON vorliegt
      if (!jsonToTest) {
        setGdTestResult({ ok: false, message: 'Für den Test bitte das Service Account JSON erneut eingeben' })
        return
      }
      const res = await testGdriveConnection(jsonToTest, effectiveGdFolderId || undefined)
      setGdTestResult(res)
    } catch (e) {
      setGdTestResult({ ok: false, message: e instanceof Error ? e.message : 'Fehler' })
    } finally {
      setGdTesting(false)
    }
  }

  const saveScanSettings = () => {
    setScanMaxDim(maxDim)
    setScanJpegQuality(jpegQuality / 100)
    setSaveMsg('Scan-Einstellungen gespeichert')
    setTimeout(() => setSaveMsg(null), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Scan-Einstellungen */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Scan-Einstellungen</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">Werden lokal im Browser gespeichert.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Field label={`Max. Auflösung: ${maxDim} px`}>
              <input type="range" min={500} max={8000} step={100} value={maxDim}
                onChange={e => setMaxDimState(Number(e.target.value))} className="w-full" />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>500 px</span>
                <span className="font-medium text-gray-600 dark:text-gray-300">{maxDim} px</span>
                <span>8000 px</span>
              </div>
            </Field>
          </div>
          <div>
            <Field label={`JPEG-Qualität: ${jpegQuality} %`}>
              <input type="range" min={10} max={100} step={1} value={jpegQuality}
                onChange={e => setJpegQualityState(Number(e.target.value))} className="w-full" />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>10 %</span>
                <span className="font-medium text-gray-600 dark:text-gray-300">{jpegQuality} %</span>
                <span>100 %</span>
              </div>
            </Field>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className={btnPrimary} onClick={saveScanSettings}>Speichern</button>
          <button className={btnSecondary} onClick={() => { setMaxDimState(DEFAULT_MAX_DIM); setJpegQualityState(Math.round(DEFAULT_JPEG_QUALITY * 100)) }}>
            Zurücksetzen ({DEFAULT_MAX_DIM} px / {Math.round(DEFAULT_JPEG_QUALITY * 100)} %)
          </button>
        </div>
        {saveMsg?.includes('Scan') && <p className="text-xs text-green-600 dark:text-green-400">{saveMsg}</p>}
      </div>

      {/* Paperless NGX */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Paperless NGX</h3>
        <div className="grid grid-cols-1 gap-3">
          <Field label="URL (z. B. http://paperless:8000)">
            <input className={inputCls} value={effectivePlUrl} onChange={e => setPlUrl(e.target.value)}
              placeholder="http://paperless:8000" />
          </Field>
          <Field label="API-Token">
            <input type="password" className={inputCls} value={effectivePlToken}
              onChange={e => setPlToken(e.target.value)} placeholder="Token aus Paperless-Einstellungen" />
          </Field>
        </div>
        {plTestResult && (
          <p className={`text-xs ${plTestResult.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {plTestResult.ok ? '✓ ' : '✗ '}{plTestResult.message}
          </p>
        )}
        {saveMsg?.includes('Paperless') && <p className="text-xs text-green-600 dark:text-green-400">{saveMsg}</p>}
        <div className="flex gap-2 flex-wrap">
          <button className={btnPrimary} disabled={plSaving} onClick={savePaperless}>
            {plSaving ? 'Speichern…' : 'Speichern'}
          </button>
          <button className={btnSecondary} disabled={plTesting || !effectivePlUrl} onClick={testPaperless}>
            {plTesting ? 'Teste…' : 'Verbindung testen'}
          </button>
        </div>
      </div>

      {/* Google Drive */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Google Drive Export</h3>
          {srv?.gdrive_service_account_configured && (
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">✓ Konfiguriert</span>
          )}
        </div>

        <GdriveAnleitung />

        <div className="space-y-3">
          {/* Service Account JSON */}
          {srv?.gdrive_service_account_configured && !gdShowJsonInput ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 dark:text-gray-400">Service Account JSON: konfiguriert</span>
              <button className={btnSecondary} onClick={() => setGdShowJsonInput(true)}>Ersetzen</button>
            </div>
          ) : (
            <Field label="Service Account JSON">
              <textarea
                className={`${inputCls} font-mono text-xs h-28 resize-y`}
                value={gdJson}
                onChange={e => setGdJson(e.target.value)}
                placeholder={'{\n  "type": "service_account",\n  "client_email": "...",\n  "private_key": "..."\n}'}
              />
            </Field>
          )}

          <Field label="Ziel-Ordner ID">
            <input
              className={inputCls}
              value={effectiveGdFolderId}
              onChange={e => setGdFolderId(e.target.value)}
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
            />
            <p className="text-xs text-gray-400 mt-1">
              Die Ordner-ID aus der Google Drive URL: drive.google.com/drive/folders/<strong>ID</strong>
            </p>
          </Field>
        </div>

        {gdTestResult && (
          <p className={`text-xs ${gdTestResult.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {gdTestResult.ok ? '✓ ' : '✗ '}{gdTestResult.message}
          </p>
        )}
        {saveMsg?.includes('Google') && <p className="text-xs text-green-600 dark:text-green-400">{saveMsg}</p>}
        <div className="flex gap-2 flex-wrap">
          <button
            className={btnPrimary}
            disabled={gdSaving || (!gdJson.trim() && !srv?.gdrive_service_account_configured)}
            onClick={saveGdrive}
          >
            {gdSaving ? 'Speichern…' : 'Speichern'}
          </button>
          <button
            className={btnSecondary}
            disabled={gdTesting || (!gdJson.trim() && !srv?.gdrive_service_account_configured)}
            onClick={testGdrive}
          >
            {gdTesting ? 'Teste…' : 'Verbindung testen'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StammdatenPage() {
  const [tab, setTab] = useState<Tab>('personen')

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Stammdaten</h1>

      <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {(Object.keys(tabLabels) as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 sm:py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {tabLabels[t]}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'personen' && <PersonenTab />}
      {tab === 'correspondents' && <CorrespondentsTab />}
      {tab === 'beihilfestellen' && <BeihilfestellenTab />}
      {tab === 'benutzer' && <BenutzerTab />}
      {tab === 'einstellungen' && <EinstellungenTab />}
    </div>
  )
}
