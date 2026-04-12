import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getBeihilfestellen, createBeihilfestelle, updateBeihilfestelle, deleteBeihilfestelle } from '../api/beihilfestellen'
import { getPersonen, createPerson, updatePerson, deletePerson } from '../api/personen'
import { getCorrespondents, createCorrespondent, updateCorrespondent, deleteCorrespondent } from '../api/correspondents'
import { getBenutzer, createBenutzer, updateBenutzer, changePasswort, deleteBenutzer } from '../api/benutzer'
import type {
  Beihilfestelle, CreateBeihilfestelle, UpdateBeihilfestelle,
  Person, CreatePerson, UpdatePerson,
  Correspondent, CreateCorrespondent, UpdateCorrespondent,
  Benutzer, CreateBenutzer, UpdateBenutzer,
} from '../types'

type Tab = 'personen' | 'correspondents' | 'beihilfestellen' | 'benutzer'

const tabLabels: Record<Tab, string> = {
  personen: 'Personen',
  correspondents: 'Leistungserbringer',
  beihilfestellen: 'Beihilfestellen',
  benutzer: 'Benutzer',
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

const inputCls = 'border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full'
const btnPrimary = 'px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50'
const btnSecondary = 'px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600'
const btnEdit = 'px-2 py-1 text-xs text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30'
const btnDelete = 'px-2 py-1 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/30'

function th(label: string) {
  return (
    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">
      {label}
    </th>
  )
}

// ─── Beihilfestellen ─────────────────────────────────────────────────────────

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

  const inv = () => qc.invalidateQueries({ queryKey: ['beihilfestellen'] })

  const [deleteError, setDeleteError] = useState('')

  const createMut = useMutation({ mutationFn: createBeihilfestelle, onSuccess: () => { inv(); setShowNew(false); setNewForm({ name: '', dienstherr_typ: 'bund' }) } })
  const updateMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: UpdateBeihilfestelle }) => updateBeihilfestelle(id, data), onSuccess: () => { inv(); setEditId(null) } })
  const deleteMut = useMutation({
    mutationFn: deleteBeihilfestelle,
    onSuccess: () => { inv(); setDeleteError('') },
    onError: (e: Error) => setDeleteError(e.message),
  })

  const startEdit = (b: Beihilfestelle) => { setEditId(b.id); setEditValues({ name: b.name, dienstherr_typ: b.dienstherr_typ }) }
  const saveEdit = async () => { setSaving(true); try { await updateMut.mutateAsync({ id: editId!, data: editValues }) } finally { setSaving(false) } }
  const handleDelete = (id: string) => { if (confirm('Beihilfestelle wirklich löschen?')) deleteMut.mutate(id) }

  if (isLoading) return <p className="text-gray-500 dark:text-gray-400 text-sm py-4">Lade...</p>
  if (error) return <p className="text-red-600 dark:text-red-400 text-sm py-4">Fehler: {(error as Error).message}</p>

  return (
    <div className="space-y-3">
      {deleteError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded p-3 text-sm text-red-700 dark:text-red-300 flex justify-between">
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError('')} className="text-red-400 hover:text-red-600 ml-2">×</button>
        </div>
      )}
      <div className="flex justify-end">
        <button onClick={() => setShowNew(s => !s)} className={btnPrimary + ' text-sm px-4 py-1.5'}>
          {showNew ? 'Abbrechen' : '+ Neue Beihilfestelle'}
        </button>
      </div>

      {showNew && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-3">Neue Beihilfestelle</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Name</label>
              <input className={inputCls} value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Dienstherr</label>
              <select className={inputCls} value={newForm.dienstherr_typ} onChange={e => setNewForm(f => ({ ...f, dienstherr_typ: e.target.value as CreateBeihilfestelle['dienstherr_typ'] }))}>
                {dienstherr_typen.map(t => <option key={t} value={t}>{dienstherr_label[t]}</option>)}
              </select></div>
          </div>
          <div className="flex gap-2 mt-3">
            <button className={btnPrimary} disabled={!newForm.name} onClick={() => createMut.mutate(newForm)}>Speichern</button>
            <button className={btnSecondary} onClick={() => setShowNew(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>{th('Name')}{th('Dienstherr')}<th /></tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.length === 0 && (
              <tr><td colSpan={3} className="px-3 py-8 text-center text-gray-400 dark:text-gray-500">Keine Einträge</td></tr>
            )}
            {items.map(b => editId === b.id ? (
              <tr key={b.id} className="bg-blue-50 dark:bg-blue-900/10">
                <td className="px-3 py-2"><input className={inputCls} value={editValues.name ?? ''} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} /></td>
                <td className="px-3 py-2">
                  <select className={inputCls} value={editValues.dienstherr_typ ?? ''} onChange={e => setEditValues(v => ({ ...v, dienstherr_typ: e.target.value as UpdateBeihilfestelle['dienstherr_typ'] }))}>
                    {dienstherr_typen.map(t => <option key={t} value={t}>{dienstherr_label[t]}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex gap-1"><button className={btnPrimary} disabled={saving} onClick={saveEdit}>Sichern</button><button className={btnSecondary} onClick={() => setEditId(null)}>Abbruch</button></div>
                </td>
              </tr>
            ) : (
              <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-3 py-3 text-gray-800 dark:text-gray-200">{b.name}</td>
                <td className="px-3 py-3 text-gray-600 dark:text-gray-400">{dienstherr_label[b.dienstherr_typ]}</td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="flex gap-1"><button className={btnEdit} onClick={() => startEdit(b)}>Bearbeiten</button><button className={btnDelete} onClick={() => handleDelete(b.id)}>Löschen</button></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Personen ────────────────────────────────────────────────────────────────

function PersonenTab() {
  const qc = useQueryClient()
  const { data: personen = [], isLoading, error } = useQuery({ queryKey: ['personen'], queryFn: getPersonen })
  const { data: beihilfestellen = [] } = useQuery({ queryKey: ['beihilfestellen'], queryFn: getBeihilfestellen })

  const [editId, setEditId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<UpdatePerson>({})
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState<CreatePerson>({ name: '', geburtsdatum: '', typ: 'erwachsener', beihilfe_satz: 0, pkv_satz: 0, bre_schwelle: null })
  const [saving, setSaving] = useState(false)

  const inv = () => { qc.invalidateQueries({ queryKey: ['personen'] }); qc.invalidateQueries({ queryKey: ['rechnungen'] }) }

  const [deleteError, setDeleteError] = useState('')

  const createMut = useMutation({ mutationFn: createPerson, onSuccess: () => { inv(); setShowNew(false); setNewForm({ name: '', geburtsdatum: '', typ: 'erwachsener', beihilfe_satz: 0, pkv_satz: 0, bre_schwelle: null }) } })
  const updateMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: UpdatePerson }) => updatePerson(id, data), onSuccess: () => { inv(); setEditId(null) } })
  const deleteMut = useMutation({
    mutationFn: deletePerson,
    onSuccess: () => { inv(); setDeleteError('') },
    onError: (e: Error) => setDeleteError(e.message),
  })

  const startEdit = (p: Person) => {
    setEditId(p.id)
    setEditValues({ name: p.name, geburtsdatum: p.geburtsdatum, typ: p.typ, beihilfestelle_id: p.beihilfestelle_id ?? '', beihilfe_satz: p.beihilfe_satz, pkv_satz: p.pkv_satz, bre_schwelle: p.bre_schwelle })
  }
  const saveEdit = async () => { setSaving(true); try { await updateMut.mutateAsync({ id: editId!, data: editValues }) } finally { setSaving(false) } }
  const handleDelete = (id: string) => { if (confirm('Person wirklich löschen?')) deleteMut.mutate(id) }

  const bhMap = Object.fromEntries(beihilfestellen.map(b => [b.id, b.name]))

  if (isLoading) return <p className="text-gray-500 dark:text-gray-400 text-sm py-4">Lade...</p>
  if (error) return <p className="text-red-600 dark:text-red-400 text-sm py-4">Fehler: {(error as Error).message}</p>

  return (
    <div className="space-y-3">
      {deleteError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded p-3 text-sm text-red-700 dark:text-red-300 flex justify-between">
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError('')} className="text-red-400 hover:text-red-600 ml-2">×</button>
        </div>
      )}
      <div className="flex justify-end">
        <button onClick={() => setShowNew(s => !s)} className={btnPrimary + ' text-sm px-4 py-1.5'}>
          {showNew ? 'Abbrechen' : '+ Neue Person'}
        </button>
      </div>

      {showNew && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-3">Neue Person</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Name</label>
              <input className={inputCls} value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Geburtsdatum</label>
              <input type="date" className={inputCls} value={newForm.geburtsdatum} onChange={e => setNewForm(f => ({ ...f, geburtsdatum: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Typ</label>
              <select className={inputCls} value={newForm.typ} onChange={e => setNewForm(f => ({ ...f, typ: e.target.value as CreatePerson['typ'] }))}>
                <option value="erwachsener">Erwachsener</option><option value="kind">Kind</option>
              </select></div>
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Beihilfestelle</label>
              <select className={inputCls} value={newForm.beihilfestelle_id ?? ''} onChange={e => setNewForm(f => ({ ...f, beihilfestelle_id: e.target.value || undefined }))}>
                <option value="">— keine —</option>
                {beihilfestellen.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select></div>
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Beihilfe-Satz (%)</label>
              <input type="number" min="0" max="100" className={inputCls} value={newForm.beihilfe_satz} onChange={e => setNewForm(f => ({ ...f, beihilfe_satz: parseInt(e.target.value) || 0 }))} /></div>
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">PKV-Satz (%)</label>
              <input type="number" min="0" max="100" className={inputCls} value={newForm.pkv_satz} onChange={e => setNewForm(f => ({ ...f, pkv_satz: parseInt(e.target.value) || 0 }))} /></div>
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">BRE-Schwelle (€)</label>
              <input type="number" min="0" step="0.01" className={inputCls} placeholder="— keine —" value={newForm.bre_schwelle ?? ''} onChange={e => setNewForm(f => ({ ...f, bre_schwelle: e.target.value === '' ? null : parseFloat(e.target.value) }))} /></div>
          </div>
          <div className="flex gap-2 mt-3">
            <button className={btnPrimary} disabled={!newForm.name || !newForm.geburtsdatum} onClick={() => createMut.mutate(newForm)}>Speichern</button>
            <button className={btnSecondary} onClick={() => setShowNew(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>{th('Name')}{th('Geburtsdatum')}{th('Typ')}{th('Beihilfestelle')}{th('Beihilfe %')}{th('PKV %')}{th('BRE-Schwelle')}<th /></tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {personen.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400 dark:text-gray-500">Keine Einträge</td></tr>
            )}
            {personen.map(p => editId === p.id ? (
              <tr key={p.id} className="bg-blue-50 dark:bg-blue-900/10">
                <td className="px-3 py-2"><input className={inputCls} value={editValues.name ?? ''} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} /></td>
                <td className="px-3 py-2"><input type="date" className={inputCls} value={editValues.geburtsdatum ?? ''} onChange={e => setEditValues(v => ({ ...v, geburtsdatum: e.target.value }))} /></td>
                <td className="px-3 py-2">
                  <select className={inputCls} value={editValues.typ ?? ''} onChange={e => setEditValues(v => ({ ...v, typ: e.target.value as UpdatePerson['typ'] }))}>
                    <option value="erwachsener">Erwachsener</option><option value="kind">Kind</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select className={inputCls} value={editValues.beihilfestelle_id ?? ''} onChange={e => setEditValues(v => ({ ...v, beihilfestelle_id: e.target.value }))}>
                    <option value="">— keine —</option>
                    {beihilfestellen.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2"><input type="number" min="0" max="100" className={inputCls} value={editValues.beihilfe_satz ?? 0} onChange={e => setEditValues(v => ({ ...v, beihilfe_satz: parseInt(e.target.value) || 0 }))} /></td>
                <td className="px-3 py-2"><input type="number" min="0" max="100" className={inputCls} value={editValues.pkv_satz ?? 0} onChange={e => setEditValues(v => ({ ...v, pkv_satz: parseInt(e.target.value) || 0 }))} /></td>
                <td className="px-3 py-2"><input type="number" min="0" step="0.01" className={inputCls} placeholder="— keine —" value={editValues.bre_schwelle ?? ''} onChange={e => setEditValues(v => ({ ...v, bre_schwelle: e.target.value === '' ? null : parseFloat(e.target.value) }))} /></td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex gap-1"><button className={btnPrimary} disabled={saving} onClick={saveEdit}>Sichern</button><button className={btnSecondary} onClick={() => setEditId(null)}>Abbruch</button></div>
                </td>
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
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="flex gap-1"><button className={btnEdit} onClick={() => startEdit(p)}>Bearbeiten</button><button className={btnDelete} onClick={() => handleDelete(p.id)}>Löschen</button></div>
                </td>
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

  const inv = () => { qc.invalidateQueries({ queryKey: ['correspondents'] }); qc.invalidateQueries({ queryKey: ['rechnungen'] }) }

  const [deleteError, setDeleteError] = useState('')

  const createMut = useMutation({ mutationFn: createCorrespondent, onSuccess: () => { inv(); setShowNew(false); setNewForm({ name: '', typ: 'arzt' }) } })
  const updateMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: UpdateCorrespondent }) => updateCorrespondent(id, data), onSuccess: () => { inv(); setEditId(null) } })
  const deleteMut = useMutation({
    mutationFn: deleteCorrespondent,
    onSuccess: () => { inv(); setDeleteError('') },
    onError: (e: Error) => setDeleteError(e.message),
  })

  const startEdit = (c: Correspondent) => { setEditId(c.id); setEditValues({ name: c.name, typ: c.typ }) }
  const saveEdit = async () => { setSaving(true); try { await updateMut.mutateAsync({ id: editId!, data: editValues }) } finally { setSaving(false) } }
  const handleDelete = (id: string) => { if (confirm('Leistungserbringer wirklich löschen?')) deleteMut.mutate(id) }

  if (isLoading) return <p className="text-gray-500 dark:text-gray-400 text-sm py-4">Lade...</p>
  if (error) return <p className="text-red-600 dark:text-red-400 text-sm py-4">Fehler: {(error as Error).message}</p>

  return (
    <div className="space-y-3">
      {deleteError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded p-3 text-sm text-red-700 dark:text-red-300 flex justify-between">
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError('')} className="text-red-400 hover:text-red-600 ml-2">×</button>
        </div>
      )}
      <div className="flex justify-end">
        <button onClick={() => setShowNew(s => !s)} className={btnPrimary + ' text-sm px-4 py-1.5'}>
          {showNew ? 'Abbrechen' : '+ Neuer Leistungserbringer'}
        </button>
      </div>

      {showNew && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-3">Neuer Leistungserbringer</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Name</label>
              <input className={inputCls} value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Typ</label>
              <select className={inputCls} value={newForm.typ} onChange={e => setNewForm(f => ({ ...f, typ: e.target.value as CreateCorrespondent['typ'] }))}>
                {corrTypen.map(t => <option key={t} value={t}>{corrTypLabel[t]}</option>)}
              </select></div>
          </div>
          <div className="flex gap-2 mt-3">
            <button className={btnPrimary} disabled={!newForm.name} onClick={() => createMut.mutate(newForm)}>Speichern</button>
            <button className={btnSecondary} onClick={() => setShowNew(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>{th('Name')}{th('Typ')}<th /></tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.length === 0 && (
              <tr><td colSpan={3} className="px-3 py-8 text-center text-gray-400 dark:text-gray-500">Keine Einträge</td></tr>
            )}
            {items.map(c => editId === c.id ? (
              <tr key={c.id} className="bg-blue-50 dark:bg-blue-900/10">
                <td className="px-3 py-2"><input className={inputCls} value={editValues.name ?? ''} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} /></td>
                <td className="px-3 py-2">
                  <select className={inputCls} value={editValues.typ ?? ''} onChange={e => setEditValues(v => ({ ...v, typ: e.target.value as UpdateCorrespondent['typ'] }))}>
                    {corrTypen.map(t => <option key={t} value={t}>{corrTypLabel[t]}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex gap-1"><button className={btnPrimary} disabled={saving} onClick={saveEdit}>Sichern</button><button className={btnSecondary} onClick={() => setEditId(null)}>Abbruch</button></div>
                </td>
              </tr>
            ) : (
              <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-3 py-3 font-medium text-gray-800 dark:text-gray-200">{c.name}</td>
                <td className="px-3 py-3 text-gray-600 dark:text-gray-400">{corrTypLabel[c.typ]}</td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="flex gap-1"><button className={btnEdit} onClick={() => startEdit(c)}>Bearbeiten</button><button className={btnDelete} onClick={() => handleDelete(c.id)}>Löschen</button></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Benutzer ────────────────────────────────────────────────────────────────

function BenutzerTab() {
  const qc = useQueryClient()
  const { data: items = [], isLoading, error } = useQuery({ queryKey: ['benutzer'], queryFn: getBenutzer })

  const [editId, setEditId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<UpdateBenutzer>({})
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState<CreateBenutzer>({ name: '', email: '', passwort: '' })
  const [saving, setSaving] = useState(false)

  // Passwort-Änderung
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
      setPwId(null)
      setPwSuccess(true)
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
        <button onClick={() => setShowNew(s => !s)} className={btnPrimary + ' text-sm px-4 py-1.5'}>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Name</label>
              <input className={inputCls} value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">E-Mail</label>
              <input type="email" className={inputCls} value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Passwort</label>
              <input type="password" className={inputCls} value={newForm.passwort} onChange={e => setNewForm(f => ({ ...f, passwort: e.target.value }))} /></div>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Aktuelles Passwort</label>
              <input type="password" className={inputCls} value={pwForm.altes_passwort} onChange={e => setPwForm(f => ({ ...f, altes_passwort: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Neues Passwort</label>
              <input type="password" className={inputCls} value={pwForm.neues_passwort} onChange={e => setPwForm(f => ({ ...f, neues_passwort: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">Bestätigung</label>
              <input type="password" className={inputCls} value={pwForm.bestaetigung} onChange={e => setPwForm(f => ({ ...f, bestaetigung: e.target.value }))} /></div>
          </div>
          {pwError && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{pwError}</p>}
          <div className="flex gap-2 mt-3">
            <button className={btnPrimary} disabled={pwSaving || !pwForm.altes_passwort || !pwForm.neues_passwort} onClick={savePw}>Speichern</button>
            <button className={btnSecondary} onClick={() => setPwId(null)}>Abbrechen</button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>{th('Name')}{th('E-Mail')}<th /></tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {items.length === 0 && (
              <tr><td colSpan={3} className="px-3 py-8 text-center text-gray-400 dark:text-gray-500">Keine Einträge</td></tr>
            )}
            {items.map(b => editId === b.id ? (
              <tr key={b.id} className="bg-blue-50 dark:bg-blue-900/10">
                <td className="px-3 py-2"><input className={inputCls} value={editValues.name ?? ''} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} /></td>
                <td className="px-3 py-2"><input type="email" className={inputCls} value={editValues.email ?? ''} onChange={e => setEditValues(v => ({ ...v, email: e.target.value }))} /></td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div className="flex gap-1"><button className={btnPrimary} disabled={saving} onClick={saveEdit}>Sichern</button><button className={btnSecondary} onClick={() => setEditId(null)}>Abbruch</button></div>
                </td>
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
    </div>
  )
}
