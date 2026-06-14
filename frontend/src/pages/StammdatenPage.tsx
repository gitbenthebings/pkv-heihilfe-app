import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getBeihilfestellen, createBeihilfestelle, updateBeihilfestelle, deleteBeihilfestelle, addPersonToBeihilfestelle, removePersonFromBeihilfestelle } from '../api/beihilfestellen'
import { getPkv, createPkv, updatePkv, deletePkv, addPersonToPkv, removePersonFromPkv } from '../api/pkv'
import { getPersonen, createPerson, updatePerson, deletePerson, getSatzHistorie, createSatzHistorie, deleteSatzHistorie } from '../api/personen'
import { getCorrespondents, createCorrespondent, updateCorrespondent, deleteCorrespondent } from '../api/correspondents'
import { getBenutzer, createBenutzer, updateBenutzer, changePasswort, deleteBenutzer } from '../api/benutzer'
import { getEinstellungen, updateEinstellungen, testPaperlessConnection, testGdriveConnection } from '../api/einstellungen'
import { uploadLogo, deleteLogo, LOGO_URL } from '../api/logo'
import { getScanMaxDim, getScanJpegQuality, setScanMaxDim, setScanJpegQuality, DEFAULT_MAX_DIM, DEFAULT_JPEG_QUALITY } from '../utils/scanSettings'
import type {
  Beihilfestelle, CreateBeihilfestelle, UpdateBeihilfestelle,
  Pkv, CreatePkv, UpdatePkv,
  Person, CreatePerson, UpdatePerson, PersonSatzHistorie, CreatePersonSatzHistorie,
  Correspondent, CreateCorrespondent, UpdateCorrespondent,
  Benutzer, CreateBenutzer, UpdateBenutzer,
} from '../types'

type Tab = 'personen' | 'correspondents' | 'beihilfestellen' | 'pkv' | 'benutzer' | 'einstellungen'

const tabLabels: Record<Tab, string> = {
  personen: 'Personen',
  correspondents: 'Leistungserbringer',
  beihilfestellen: 'Beihilfestellen',
  pkv: 'PKV',
  benutzer: 'Benutzer',
  einstellungen: 'Einstellungen',
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

function DeleteError({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div className="flex justify-between rounded p-3" style={{ background: 'var(--rose-dim)', border: '1px solid var(--rose)', fontSize: 13, color: 'var(--rose)' }}>
      <span>{msg}</span>
      <button onClick={onClose} style={{ color: 'var(--rose)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 8, fontWeight: 700 }}>×</button>
    </div>
  )
}

// ─── Beihilfestellen ──────────────────────────────────────────────────────────

const dienstherr_typen = ['bund', 'land', 'kommune'] as const
const dienstherr_label: Record<string, string> = { bund: 'Bund', land: 'Land', kommune: 'Kommune' }

interface PersonenZuweisungProps {
  bh: Beihilfestelle
  allePersonen: Person[]
  onAdd: (personId: string) => void
  onRemove: (personId: string) => void
}

function PersonenZuweisung({ bh, allePersonen, onAdd, onRemove }: PersonenZuweisungProps) {
  const [showSelect, setShowSelect] = useState(false)
  const personenById = new Map(allePersonen.map(p => [p.id, p]))
  const nichtZugewiesen = allePersonen.filter(p => !bh.personen_ids.includes(p.id))

  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Berechtigte Personen</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {bh.personen_ids.length === 0 ? (
          <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontStyle: 'italic' }}>Alle Personen erlaubt</span>
        ) : (
          bh.personen_ids.map(pid => {
            const person = personenById.get(pid)
            if (!person) return null
            return (
              <span key={pid} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 4, background: 'var(--blue-dim)', border: '1px solid var(--blue)', color: 'var(--text)' }}>
                {person.name}
                <button
                  onClick={() => onRemove(pid)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1, padding: 0, fontSize: 13, fontWeight: 700 }}
                  title="Entfernen"
                >×</button>
              </span>
            )
          })
        )}
        {showSelect ? (
          <select
            autoFocus
            style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
            defaultValue=""
            onChange={e => { if (e.target.value) { onAdd(e.target.value); setShowSelect(false) } }}
            onBlur={() => setShowSelect(false)}
          >
            <option value="">Person wählen…</option>
            {nichtZugewiesen.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : nichtZugewiesen.length > 0 ? (
          <button
            onClick={() => setShowSelect(true)}
            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
          >+ Person</button>
        ) : null}
      </div>
    </div>
  )
}

function BeihilfestellenTab() {
  const qc = useQueryClient()
  const { data: items = [], isLoading, error } = useQuery({ queryKey: ['beihilfestellen'], queryFn: getBeihilfestellen })
  const { data: personen = [] } = useQuery({ queryKey: ['personen'], queryFn: getPersonen })
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
  const addPersonMut = useMutation({
    mutationFn: ({ bh_id, person_id }: { bh_id: string; person_id: string }) => addPersonToBeihilfestelle(bh_id, person_id),
    onSuccess: inv,
  })
  const removePersonMut = useMutation({
    mutationFn: ({ bh_id, person_id }: { bh_id: string; person_id: string }) => removePersonFromBeihilfestelle(bh_id, person_id),
    onSuccess: inv,
  })

  const startEdit = (b: Beihilfestelle) => { setEditId(b.id); setEditValues({ name: b.name, dienstherr_typ: b.dienstherr_typ }) }
  const saveEdit = async () => { setSaving(true); try { await updateMut.mutateAsync({ id: editId!, data: editValues }) } finally { setSaving(false) } }
  const handleDelete = (id: string) => { if (confirm('Beihilfestelle wirklich löschen?')) deleteMut.mutate(id) }

  if (isLoading) return <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0' }}>Lade...</p>
  if (error) return <p style={{ fontSize: 13, color: 'var(--rose)', padding: '16px 0' }}>Fehler: {(error as Error).message}</p>

  const editForm = (onSave: () => void, onCancel: () => void) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Name"><input style={{ padding: '6px 10px', fontSize: 13, borderRadius: 5, width: '100%' }} value={editValues.name ?? ''} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} /></Field>
      <Field label="Dienstherr">
        <select style={{ padding: '6px 10px', fontSize: 13, borderRadius: 5, width: '100%' }} value={editValues.dienstherr_typ ?? ''} onChange={e => setEditValues(v => ({ ...v, dienstherr_typ: e.target.value as UpdateBeihilfestelle['dienstherr_typ'] }))}>
          {dienstherr_typen.map(t => <option key={t} value={t}>{dienstherr_label[t]}</option>)}
        </select>
      </Field>
      <div className="flex gap-2 sm:col-span-2">
        <button className="app-btn-primary" disabled={saving} onClick={onSave}>Sichern</button>
        <button className="app-btn-secondary" onClick={onCancel}>Abbrechen</button>
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      {deleteError && <DeleteError msg={deleteError} onClose={() => setDeleteError('')} />}

      <div className="flex justify-end">
        <button onClick={() => setShowNew(s => !s)} className="app-btn-primary">
          {showNew ? 'Abbrechen' : '+ Neue Beihilfestelle'}
        </button>
      </div>

      {showNew && (
        <div className="rounded-lg p-4" style={{ background: 'var(--blue-dim)', border: '1px solid var(--blue)' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Neue Beihilfestelle</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ maxWidth: 480 }}>
            <Field label="Name"><input style={{ padding: '6px 10px', fontSize: 13, borderRadius: 5, width: '100%' }} value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Dienstherr">
              <select style={{ padding: '6px 10px', fontSize: 13, borderRadius: 5, width: '100%' }} value={newForm.dienstherr_typ} onChange={e => setNewForm(f => ({ ...f, dienstherr_typ: e.target.value as CreateBeihilfestelle['dienstherr_typ'] }))}>
                {dienstherr_typen.map(t => <option key={t} value={t}>{dienstherr_label[t]}</option>)}
              </select>
            </Field>
          </div>
          <div className="flex gap-2 mt-3">
            <button className="app-btn-primary" disabled={!newForm.name} onClick={() => createMut.mutate(newForm)}>Speichern</button>
            <button className="app-btn-secondary" onClick={() => setShowNew(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      {/* Mobile: Karten */}
      <div className="sm:hidden space-y-2">
        {items.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13, padding: '24px 0' }}>Keine Einträge</p>}
        {items.map(b => editId === b.id ? (
          <div key={b.id} className="rounded-lg p-3" style={{ background: 'var(--blue-dim)', border: '1px solid var(--blue)' }}>
            {editForm(saveEdit, () => setEditId(null))}
          </div>
        ) : (
          <div key={b.id} className="rounded-lg p-3 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex justify-between items-start">
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{b.name}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{dienstherr_label[b.dienstherr_typ]}</p>
              </div>
              <div className="flex gap-1.5 shrink-0 ml-2">
                <button className="app-btn-edit" onClick={() => startEdit(b)}>Bearb.</button>
                <button className="app-btn-danger" onClick={() => handleDelete(b.id)}>Lösch.</button>
              </div>
            </div>
            <PersonenZuweisung
              bh={b}
              allePersonen={personen}
              onAdd={pid => addPersonMut.mutate({ bh_id: b.id, person_id: pid })}
              onRemove={pid => removePersonMut.mutate({ bh_id: b.id, person_id: pid })}
            />
          </div>
        ))}
      </div>

      {/* Desktop: Karten (statt Tabelle, da Personen-Sektion extra Platz braucht) */}
      <div className="hidden sm:block space-y-2">
        {items.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13, padding: '24px 0' }}>Keine Einträge</p>}
        {items.map(b => editId === b.id ? (
          <div key={b.id} className="rounded-lg p-4" style={{ background: 'var(--blue-dim)', border: '1px solid var(--blue)' }}>
            {editForm(saveEdit, () => setEditId(null))}
          </div>
        ) : (
          <div key={b.id} className="rounded-lg p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{b.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{dienstherr_label[b.dienstherr_typ]}</span>
              </div>
              <div className="flex gap-1.5">
                <button className="app-btn-edit" onClick={() => startEdit(b)}>Bearbeiten</button>
                <button className="app-btn-danger" onClick={() => handleDelete(b.id)}>Löschen</button>
              </div>
            </div>
            <PersonenZuweisung
              bh={b}
              allePersonen={personen}
              onAdd={pid => addPersonMut.mutate({ bh_id: b.id, person_id: pid })}
              onRemove={pid => removePersonMut.mutate({ bh_id: b.id, person_id: pid })}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── PKV ──────────────────────────────────────────────────────────────────────

interface PkvPersonenZuweisungProps {
  pkv: Pkv
  allePersonen: Person[]
  onAdd: (personId: string) => void
  onRemove: (personId: string) => void
}

function PkvPersonenZuweisung({ pkv, allePersonen, onAdd, onRemove }: PkvPersonenZuweisungProps) {
  const [showSelect, setShowSelect] = useState(false)
  const personenById = new Map(allePersonen.map(p => [p.id, p]))
  const nichtZugewiesen = allePersonen.filter(p => !pkv.personen_ids.includes(p.id))

  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Versicherte Personen</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {pkv.personen_ids.length === 0 ? (
          <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontStyle: 'italic' }}>Keine Personen zugewiesen</span>
        ) : (
          pkv.personen_ids.map(pid => {
            const person = personenById.get(pid)
            if (!person) return null
            return (
              <span key={pid} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, padding: '2px 6px', borderRadius: 4, background: 'var(--teal-dim)', border: '1px solid var(--teal)', color: 'var(--text)' }}>
                {person.name}
                <button
                  onClick={() => onRemove(pid)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1, padding: 0, fontSize: 13, fontWeight: 700 }}
                  title="Entfernen"
                >×</button>
              </span>
            )
          })
        )}
        {showSelect ? (
          <select
            autoFocus
            style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
            defaultValue=""
            onChange={e => { if (e.target.value) { onAdd(e.target.value); setShowSelect(false) } }}
            onBlur={() => setShowSelect(false)}
          >
            <option value="">Person wählen…</option>
            {nichtZugewiesen.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : nichtZugewiesen.length > 0 ? (
          <button
            onClick={() => setShowSelect(true)}
            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
          >+ Person</button>
        ) : null}
      </div>
    </div>
  )
}

function PkvTab() {
  const qc = useQueryClient()
  const { data: items = [], isLoading, error } = useQuery({ queryKey: ['pkv'], queryFn: getPkv })
  const { data: personen = [] } = useQuery({ queryKey: ['personen'], queryFn: getPersonen })
  const [editId, setEditId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<UpdatePkv>({})
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState<CreatePkv>({ name: '' })
  const [saving, setSaving] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const inv = () => qc.invalidateQueries({ queryKey: ['pkv'] })
  const createMut = useMutation({ mutationFn: createPkv, onSuccess: () => { inv(); setShowNew(false); setNewForm({ name: '' }) } })
  const updateMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: UpdatePkv }) => updatePkv(id, data), onSuccess: () => { inv(); setEditId(null) } })
  const deleteMut = useMutation({ mutationFn: deletePkv, onSuccess: () => { inv(); setDeleteError('') }, onError: (e: Error) => setDeleteError(e.message) })
  const addPersonMut = useMutation({
    mutationFn: ({ pkv_id, person_id }: { pkv_id: string; person_id: string }) => addPersonToPkv(pkv_id, person_id),
    onSuccess: inv,
  })
  const removePersonMut = useMutation({
    mutationFn: ({ pkv_id, person_id }: { pkv_id: string; person_id: string }) => removePersonFromPkv(pkv_id, person_id),
    onSuccess: inv,
  })

  const startEdit = (p: Pkv) => { setEditId(p.id); setEditValues({ name: p.name }) }
  const saveEdit = async () => { setSaving(true); try { await updateMut.mutateAsync({ id: editId!, data: editValues }) } finally { setSaving(false) } }
  const handleDelete = (id: string) => { if (confirm('PKV wirklich löschen?')) deleteMut.mutate(id) }

  if (isLoading) return <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0' }}>Lade...</p>
  if (error) return <p style={{ fontSize: 13, color: 'var(--rose)', padding: '16px 0' }}>Fehler: {(error as Error).message}</p>

  const editForm = (onSave: () => void, onCancel: () => void) => (
    <div className="grid grid-cols-1 gap-3">
      <Field label="Name (Versicherungsname)">
        <input style={{ padding: '6px 10px', fontSize: 13, borderRadius: 5, width: '100%' }} value={editValues.name ?? ''} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} />
      </Field>
      <div className="flex gap-2">
        <button className="app-btn-primary" disabled={saving} onClick={onSave}>Sichern</button>
        <button className="app-btn-secondary" onClick={onCancel}>Abbrechen</button>
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      {deleteError && <DeleteError msg={deleteError} onClose={() => setDeleteError('')} />}

      <div className="flex justify-end">
        <button onClick={() => setShowNew(s => !s)} className="app-btn-primary">
          {showNew ? 'Abbrechen' : '+ Neue PKV'}
        </button>
      </div>

      {showNew && (
        <div className="rounded-lg p-4" style={{ background: 'var(--teal-dim)', border: '1px solid var(--teal)' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Neue PKV</h3>
          <div style={{ maxWidth: 320 }}>
            <Field label="Name (z. B. DKV, Debeka, Signal Iduna)">
              <input
                style={{ padding: '6px 10px', fontSize: 13, borderRadius: 5, width: '100%' }}
                value={newForm.name}
                onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                placeholder="z. B. DKV"
              />
            </Field>
          </div>
          <div className="flex gap-2 mt-3">
            <button className="app-btn-primary" disabled={!newForm.name.trim()} onClick={() => createMut.mutate(newForm)}>Speichern</button>
            <button className="app-btn-secondary" onClick={() => setShowNew(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      {/* Mobile: Karten */}
      <div className="sm:hidden space-y-2">
        {items.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13, padding: '24px 0' }}>Keine Einträge</p>}
        {items.map(p => editId === p.id ? (
          <div key={p.id} className="rounded-lg p-3" style={{ background: 'var(--teal-dim)', border: '1px solid var(--teal)' }}>
            {editForm(saveEdit, () => setEditId(null))}
          </div>
        ) : (
          <div key={p.id} className="rounded-lg p-3 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex justify-between items-start">
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{p.name}</p>
              <div className="flex gap-1.5 shrink-0 ml-2">
                <button className="app-btn-edit" onClick={() => startEdit(p)}>Bearb.</button>
                <button className="app-btn-danger" onClick={() => handleDelete(p.id)}>Lösch.</button>
              </div>
            </div>
            <PkvPersonenZuweisung
              pkv={p}
              allePersonen={personen}
              onAdd={pid => addPersonMut.mutate({ pkv_id: p.id, person_id: pid })}
              onRemove={pid => removePersonMut.mutate({ pkv_id: p.id, person_id: pid })}
            />
          </div>
        ))}
      </div>

      {/* Desktop: Karten */}
      <div className="hidden sm:block space-y-2">
        {items.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13, padding: '24px 0' }}>Keine Einträge</p>}
        {items.map(p => editId === p.id ? (
          <div key={p.id} className="rounded-lg p-4" style={{ background: 'var(--teal-dim)', border: '1px solid var(--teal)' }}>
            {editForm(saveEdit, () => setEditId(null))}
          </div>
        ) : (
          <div key={p.id} className="rounded-lg p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
              <div className="flex gap-1.5">
                <button className="app-btn-edit" onClick={() => startEdit(p)}>Bearbeiten</button>
                <button className="app-btn-danger" onClick={() => handleDelete(p.id)}>Löschen</button>
              </div>
            </div>
            <PkvPersonenZuweisung
              pkv={p}
              allePersonen={personen}
              onAdd={pid => addPersonMut.mutate({ pkv_id: p.id, person_id: pid })}
              onRemove={pid => removePersonMut.mutate({ pkv_id: p.id, person_id: pid })}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Satz-Historie ────────────────────────────────────────────────────────────

function SatzHistoriePanel({ person }: { person: Person }) {
  const qc = useQueryClient()
  const { data: historie = [], isLoading } = useQuery({
    queryKey: ['satz-historie', person.id],
    queryFn: () => getSatzHistorie(person.id),
  })

  const emptyForm: CreatePersonSatzHistorie = { beihilfe_satz: person.beihilfe_satz, pkv_satz: person.pkv_satz, gueltig_ab: '' }
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState<CreatePersonSatzHistorie>(emptyForm)
  const [saving, setSaving] = useState(false)

  const inv = () => {
    qc.invalidateQueries({ queryKey: ['satz-historie', person.id] })
    qc.invalidateQueries({ queryKey: ['personen'] })
    qc.invalidateQueries({ queryKey: ['rechnungen'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const createMut = useMutation({
    mutationFn: (data: CreatePersonSatzHistorie) => createSatzHistorie(person.id, data),
    onSuccess: () => { inv(); setShowNew(false); setNewForm(emptyForm) },
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteSatzHistorie(person.id, id),
    onSuccess: inv,
  })

  const handleCreate = async () => {
    if (!newForm.gueltig_ab) return
    setSaving(true)
    try { await createMut.mutateAsync(newForm) } finally { setSaving(false) }
  }

  const inp: React.CSSProperties = { padding: '4px 8px', fontSize: 12, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', width: '100%' }

  return (
    <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Satz-Historie</p>
        <button
          onClick={() => { setShowNew(s => !s); setNewForm(emptyForm) }}
          style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          {showNew ? 'Abbrechen' : '+ Neuer Satz'}
        </button>
      </div>

      {showNew && (
        <div className="rounded-md p-3 space-y-2" style={{ background: 'var(--blue-dim)', border: '1px solid var(--blue)', marginBottom: 8 }}>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Gültig ab</label>
              <input type="date" style={inp} value={newForm.gueltig_ab} onChange={e => setNewForm(f => ({ ...f, gueltig_ab: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Beihilfe %</label>
              <input type="number" min="0" max="100" style={inp} value={newForm.beihilfe_satz}
                onChange={e => setNewForm(f => ({ ...f, beihilfe_satz: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>PKV %</label>
              <input type="number" min="0" max="100" style={inp} value={newForm.pkv_satz}
                onChange={e => setNewForm(f => ({ ...f, pkv_satz: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <button
            className="app-btn-primary"
            style={{ fontSize: 11, padding: '4px 12px' }}
            disabled={saving || !newForm.gueltig_ab}
            onClick={handleCreate}
          >
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      )}

      {isLoading ? (
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Lade…</p>
      ) : historie.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-subtle)', fontStyle: 'italic' }}>Keine Einträge</p>
      ) : (
        <div className="space-y-1">
          {(historie as PersonSatzHistorie[]).map((h, i) => {
            const isLatest = i === 0
            return (
              <div key={h.id} className="flex items-center justify-between rounded" style={{ padding: '4px 8px', background: isLatest ? 'var(--green-dim)' : 'var(--surface)', border: `1px solid ${isLatest ? 'var(--green)' : 'var(--border)'}` }}>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {h.gueltig_ab === '1900-01-01' ? 'Anfang' : new Date(h.gueltig_ab).toLocaleDateString('de-DE')}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text)' }}>
                    Beihilfe {h.beihilfe_satz} % / PKV {h.pkv_satz} %
                  </span>
                  {isLatest && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)', padding: '1px 5px', borderRadius: 3, background: 'var(--green-dim)', border: '1px solid var(--green)' }}>aktuell</span>}
                </div>
                {historie.length > 1 && (
                  <button
                    onClick={() => { if (confirm('Diesen Satz-Eintrag löschen?')) deleteMut.mutate(h.id) }}
                    style={{ fontSize: 13, fontWeight: 700, color: 'var(--rose)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
                    title="Löschen"
                  >×</button>
                )}
              </div>
            )
          })}
        </div>
      )}
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
  const [historiePersonId, setHistoriePersonId] = useState<string | null>(null)

  const inv = () => { qc.invalidateQueries({ queryKey: ['personen'] }); qc.invalidateQueries({ queryKey: ['rechnungen'] }) }
  const createMut = useMutation({ mutationFn: createPerson, onSuccess: () => { inv(); setShowNew(false); setNewForm({ name: '', geburtsdatum: '', typ: 'erwachsener', beihilfe_satz: 0, pkv_satz: 0, bre_schwelle: null }) } })
  const updateMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: UpdatePerson }) => updatePerson(id, data), onSuccess: () => { inv(); setEditId(null) } })
  const deleteMut = useMutation({ mutationFn: deletePerson, onSuccess: () => { inv(); setDeleteError('') }, onError: (e: Error) => setDeleteError(e.message) })

  const startEdit = (p: Person) => { setEditId(p.id); setEditValues({ name: p.name, geburtsdatum: p.geburtsdatum, typ: p.typ, beihilfestelle_id: p.beihilfestelle_id ?? '', bre_schwelle: p.bre_schwelle }) }
  const saveEdit = async () => { setSaving(true); try { await updateMut.mutateAsync({ id: editId!, data: editValues }) } finally { setSaving(false) } }
  const handleDelete = (id: string) => { if (confirm('Person wirklich löschen?')) deleteMut.mutate(id) }

  const bhMap = Object.fromEntries(beihilfestellen.map(b => [b.id, b.name]))

  if (isLoading) return <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0' }}>Lade...</p>
  if (error) return <p style={{ fontSize: 13, color: 'var(--rose)', padding: '16px 0' }}>Fehler: {(error as Error).message}</p>

  const inpStyle: React.CSSProperties = { padding: '6px 10px', fontSize: 13, borderRadius: 5, width: '100%' }
  const inpStyleSm: React.CSSProperties = { padding: '5px 8px', fontSize: 12, borderRadius: 5, width: '100%' }

  const personEditFields = (vals: UpdatePerson, setVals: (fn: (v: UpdatePerson) => UpdatePerson) => void, showSatz = false) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <Field label="Name"><input style={inpStyle} value={vals.name ?? ''} onChange={e => setVals(v => ({ ...v, name: e.target.value }))} /></Field>
      <Field label="Geburtsdatum"><input type="date" style={inpStyle} value={vals.geburtsdatum ?? ''} onChange={e => setVals(v => ({ ...v, geburtsdatum: e.target.value }))} /></Field>
      <Field label="Typ">
        <select style={inpStyle} value={vals.typ ?? ''} onChange={e => setVals(v => ({ ...v, typ: e.target.value as UpdatePerson['typ'] }))}>
          <option value="erwachsener">Erwachsener</option><option value="kind">Kind</option>
        </select>
      </Field>
      <Field label="Beihilfestelle">
        <select style={inpStyle} value={vals.beihilfestelle_id ?? ''} onChange={e => setVals(v => ({ ...v, beihilfestelle_id: e.target.value }))}>
          <option value="">— keine —</option>
          {beihilfestellen.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </Field>
      {showSatz && <Field label="Beihilfe-Satz (%)"><input type="number" min="0" max="100" style={inpStyle} value={vals.beihilfe_satz ?? 0} onChange={e => setVals(v => ({ ...v, beihilfe_satz: parseInt(e.target.value) || 0 }))} /></Field>}
      {showSatz && <Field label="PKV-Satz (%)"><input type="number" min="0" max="100" style={inpStyle} value={vals.pkv_satz ?? 0} onChange={e => setVals(v => ({ ...v, pkv_satz: parseInt(e.target.value) || 0 }))} /></Field>}
      <Field label="BRE-Schwelle (€)"><input type="number" min="0" step="0.01" style={inpStyle} placeholder="— keine —" value={vals.bre_schwelle ?? ''} onChange={e => setVals(v => ({ ...v, bre_schwelle: e.target.value === '' ? null : parseFloat(e.target.value) }))} /></Field>
    </div>
  )

  return (
    <div className="space-y-3">
      {deleteError && <DeleteError msg={deleteError} onClose={() => setDeleteError('')} />}

      <div className="flex justify-end">
        <button onClick={() => setShowNew(s => !s)} className="app-btn-primary">
          {showNew ? 'Abbrechen' : '+ Neue Person'}
        </button>
      </div>

      {showNew && (
        <div className="rounded-lg p-4" style={{ background: 'var(--blue-dim)', border: '1px solid var(--blue)' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Neue Person</h3>
          {personEditFields(newForm as UpdatePerson, fn => setNewForm(f => fn(f as UpdatePerson) as CreatePerson), true)}
          <div className="flex gap-2 mt-3">
            <button className="app-btn-primary" disabled={!newForm.name || !newForm.geburtsdatum} onClick={() => createMut.mutate(newForm)}>Speichern</button>
            <button className="app-btn-secondary" onClick={() => setShowNew(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      {/* Mobile: Karten */}
      <div className="sm:hidden space-y-2">
        {personen.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13, padding: '24px 0' }}>Keine Einträge</p>}
        {personen.map(p => editId === p.id ? (
          <div key={p.id} className="rounded-lg p-3 space-y-3" style={{ background: 'var(--blue-dim)', border: '1px solid var(--blue)' }}>
            {personEditFields(editValues, setEditValues)}
            <div className="flex gap-2">
              <button className="app-btn-primary" disabled={saving} onClick={saveEdit}>Sichern</button>
              <button className="app-btn-secondary" onClick={() => setEditId(null)}>Abbrechen</button>
            </div>
          </div>
        ) : (
          <div key={p.id} className="rounded-lg p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex justify-between items-start">
              <div className="min-w-0">
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{p.name}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {new Date(p.geburtsdatum).toLocaleDateString('de-DE')} · {p.typ === 'erwachsener' ? 'Erwachsener' : 'Kind'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                  {p.beihilfestelle_id ? bhMap[p.beihilfestelle_id] ?? '—' : '— keine Beihilfe —'}
                  {' · '}Beihilfe {p.beihilfe_satz} % / PKV {p.pkv_satz} %
                </p>
                {p.bre_schwelle != null && (
                  <p style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 1 }}>
                    BRE-Schwelle: {p.bre_schwelle.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </p>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0 ml-2">
                <button className="app-btn-edit" onClick={() => startEdit(p)}>Bearb.</button>
                <button className="app-btn-danger" onClick={() => handleDelete(p.id)}>Lösch.</button>
              </div>
            </div>
            <SatzHistoriePanel person={p} />
          </div>
        ))}
      </div>

      {/* Desktop: Tabelle + Satz-Historie-Panel */}
      <div className="hidden sm:block">
        <div className="overflow-x-auto rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead className="app-table-head">
              <tr><th>Name</th><th>Geburtsdatum</th><th>Typ</th><th>Beihilfestelle</th><th>Beihilfe %</th><th>PKV %</th><th>BRE-Schwelle</th><th></th></tr>
            </thead>
            <tbody>
              {personen.length === 0 && <tr><td colSpan={8} className="app-table-empty">Keine Einträge</td></tr>}
              {personen.map(p => editId === p.id ? (
                <tr key={p.id} className="app-table-row-edit">
                  <td style={{ padding: '8px 12px' }}><input style={inpStyleSm} value={editValues.name ?? ''} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} /></td>
                  <td style={{ padding: '8px 12px' }}><input type="date" style={inpStyleSm} value={editValues.geburtsdatum ?? ''} onChange={e => setEditValues(v => ({ ...v, geburtsdatum: e.target.value }))} /></td>
                  <td style={{ padding: '8px 12px' }}><select style={inpStyleSm} value={editValues.typ ?? ''} onChange={e => setEditValues(v => ({ ...v, typ: e.target.value as UpdatePerson['typ'] }))}><option value="erwachsener">Erwachsener</option><option value="kind">Kind</option></select></td>
                  <td style={{ padding: '8px 12px' }}><select style={inpStyleSm} value={editValues.beihilfestelle_id ?? ''} onChange={e => setEditValues(v => ({ ...v, beihilfestelle_id: e.target.value }))}><option value="">— keine —</option>{beihilfestellen.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 12 }}>{personen.find(p => p.id === editId)?.beihilfe_satz ?? 0} %<br/><span style={{ fontSize: 10, opacity: 0.7 }}>→ Verlauf</span></td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 12 }}>{personen.find(p => p.id === editId)?.pkv_satz ?? 0} %<br/><span style={{ fontSize: 10, opacity: 0.7 }}>→ Verlauf</span></td>
                  <td style={{ padding: '8px 12px' }}><input type="number" min="0" step="0.01" style={inpStyleSm} placeholder="— keine —" value={editValues.bre_schwelle ?? ''} onChange={e => setEditValues(v => ({ ...v, bre_schwelle: e.target.value === '' ? null : parseFloat(e.target.value) }))} /></td>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}><div className="flex gap-1"><button className="app-btn-primary" style={{ fontSize: 11 }} disabled={saving} onClick={saveEdit}>Sichern</button><button className="app-btn-secondary" style={{ fontSize: 11 }} onClick={() => setEditId(null)}>Abbruch</button></div></td>
                </tr>
              ) : (
                <tr key={p.id} className="app-table-row">
                  <td style={{ fontWeight: 500, color: 'var(--text)' }}>{p.name}</td>
                  <td>{new Date(p.geburtsdatum).toLocaleDateString('de-DE')}</td>
                  <td style={{ textTransform: 'capitalize' }}>{p.typ}</td>
                  <td>{p.beihilfestelle_id ? (bhMap[p.beihilfestelle_id] ?? '—') : '—'}</td>
                  <td>{p.beihilfe_satz} %</td>
                  <td>{p.pkv_satz} %</td>
                  <td>{p.bre_schwelle != null ? p.bre_schwelle.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '—'}</td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    <div className="flex gap-1">
                      <button className="app-btn-edit" onClick={() => startEdit(p)}>Bearbeiten</button>
                      <button
                        onClick={() => setHistoriePersonId(hp => hp === p.id ? null : p.id)}
                        style={{ padding: '4px 8px', fontSize: 12, fontWeight: 500, background: 'transparent', color: 'var(--blue)', border: '1px solid var(--blue-dim)', borderRadius: 5, cursor: 'pointer' }}
                      >
                        Verlauf
                      </button>
                      <button className="app-btn-danger" onClick={() => handleDelete(p.id)}>Löschen</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {historiePersonId && (() => {
          const p = personen.find(x => x.id === historiePersonId)
          if (!p) return null
          return (
            <div className="rounded-lg p-4 mt-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{p.name} — Satz-Verlauf</p>
              <SatzHistoriePanel person={p} />
            </div>
          )
        })()}
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

  if (isLoading) return <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0' }}>Lade...</p>
  if (error) return <p style={{ fontSize: 13, color: 'var(--rose)', padding: '16px 0' }}>Fehler: {(error as Error).message}</p>

  const inpStyle: React.CSSProperties = { padding: '6px 10px', fontSize: 13, borderRadius: 5, width: '100%' }
  const inpStyleSm: React.CSSProperties = { padding: '5px 8px', fontSize: 12, borderRadius: 5, width: '100%' }

  return (
    <div className="space-y-3">
      {deleteError && <DeleteError msg={deleteError} onClose={() => setDeleteError('')} />}

      <div className="flex justify-end">
        <button onClick={() => setShowNew(s => !s)} className="app-btn-primary">
          {showNew ? 'Abbrechen' : '+ Neuer Leistungserbringer'}
        </button>
      </div>

      {showNew && (
        <div className="rounded-lg p-4" style={{ background: 'var(--blue-dim)', border: '1px solid var(--blue)' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Neuer Leistungserbringer</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ maxWidth: 480 }}>
            <Field label="Name"><input style={inpStyle} value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Typ">
              <select style={inpStyle} value={newForm.typ} onChange={e => setNewForm(f => ({ ...f, typ: e.target.value as CreateCorrespondent['typ'] }))}>
                {corrTypen.map(t => <option key={t} value={t}>{corrTypLabel[t]}</option>)}
              </select>
            </Field>
          </div>
          <div className="flex gap-2 mt-3">
            <button className="app-btn-primary" disabled={!newForm.name} onClick={() => createMut.mutate(newForm)}>Speichern</button>
            <button className="app-btn-secondary" onClick={() => setShowNew(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      {/* Mobile: Karten */}
      <div className="sm:hidden space-y-2">
        {items.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13, padding: '24px 0' }}>Keine Einträge</p>}
        {items.map(c => editId === c.id ? (
          <div key={c.id} className="rounded-lg p-3 space-y-3" style={{ background: 'var(--blue-dim)', border: '1px solid var(--blue)' }}>
            <div className="grid grid-cols-1 gap-3">
              <Field label="Name"><input style={inpStyle} value={editValues.name ?? ''} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} /></Field>
              <Field label="Typ">
                <select style={inpStyle} value={editValues.typ ?? ''} onChange={e => setEditValues(v => ({ ...v, typ: e.target.value as UpdateCorrespondent['typ'] }))}>
                  {corrTypen.map(t => <option key={t} value={t}>{corrTypLabel[t]}</option>)}
                </select>
              </Field>
            </div>
            <div className="flex gap-2">
              <button className="app-btn-primary" disabled={saving} onClick={saveEdit}>Sichern</button>
              <button className="app-btn-secondary" onClick={() => setEditId(null)}>Abbrechen</button>
            </div>
          </div>
        ) : (
          <div key={c.id} className="rounded-lg p-3 flex justify-between items-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{c.name}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{corrTypLabel[c.typ]}</p>
            </div>
            <div className="flex gap-1.5 shrink-0 ml-2">
              <button className="app-btn-edit" onClick={() => startEdit(c)}>Bearb.</button>
              <button className="app-btn-danger" onClick={() => handleDelete(c.id)}>Lösch.</button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Tabelle */}
      <div className="hidden sm:block overflow-x-auto rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead className="app-table-head"><tr><th>Name</th><th>Typ</th><th></th></tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={3} className="app-table-empty">Keine Einträge</td></tr>}
            {items.map(c => editId === c.id ? (
              <tr key={c.id} className="app-table-row-edit">
                <td style={{ padding: '8px 12px' }}><input style={inpStyleSm} value={editValues.name ?? ''} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} /></td>
                <td style={{ padding: '8px 12px' }}><select style={inpStyleSm} value={editValues.typ ?? ''} onChange={e => setEditValues(v => ({ ...v, typ: e.target.value as UpdateCorrespondent['typ'] }))}>{corrTypen.map(t => <option key={t} value={t}>{corrTypLabel[t]}</option>)}</select></td>
                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}><div className="flex gap-1"><button className="app-btn-primary" style={{ fontSize: 11 }} disabled={saving} onClick={saveEdit}>Sichern</button><button className="app-btn-secondary" style={{ fontSize: 11 }} onClick={() => setEditId(null)}>Abbruch</button></div></td>
              </tr>
            ) : (
              <tr key={c.id} className="app-table-row">
                <td style={{ fontWeight: 500, color: 'var(--text)' }}>{c.name}</td>
                <td>{corrTypLabel[c.typ]}</td>
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}><div className="flex gap-1"><button className="app-btn-edit" onClick={() => startEdit(c)}>Bearbeiten</button><button className="app-btn-danger" onClick={() => handleDelete(c.id)}>Löschen</button></div></td>
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

  if (isLoading) return <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0' }}>Lade...</p>
  if (error) return <p style={{ fontSize: 13, color: 'var(--rose)', padding: '16px 0' }}>Fehler: {(error as Error).message}</p>

  const inpStyle: React.CSSProperties = { padding: '6px 10px', fontSize: 13, borderRadius: 5, width: '100%' }
  const inpStyleSm: React.CSSProperties = { padding: '5px 8px', fontSize: 12, borderRadius: 5, width: '100%' }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setShowNew(s => !s)} className="app-btn-primary">
          {showNew ? 'Abbrechen' : '+ Neuer Benutzer'}
        </button>
      </div>

      {pwSuccess && (
        <div className="rounded p-3" style={{ background: 'var(--green-dim)', border: '1px solid var(--green)', fontSize: 13, color: 'var(--green)' }}>
          Passwort erfolgreich geändert.
        </div>
      )}

      {showNew && (
        <div className="rounded-lg p-4" style={{ background: 'var(--blue-dim)', border: '1px solid var(--blue)' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Neuer Benutzer</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Name"><input style={inpStyle} value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="E-Mail"><input type="email" style={inpStyle} value={newForm.email} onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} /></Field>
            <Field label="Passwort"><input type="password" style={inpStyle} value={newForm.passwort} onChange={e => setNewForm(f => ({ ...f, passwort: e.target.value }))} /></Field>
          </div>
          <div className="flex gap-2 mt-3">
            <button className="app-btn-primary" disabled={!newForm.name || !newForm.email || !newForm.passwort} onClick={() => createMut.mutate(newForm)}>Speichern</button>
            <button className="app-btn-secondary" onClick={() => setShowNew(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      {pwId && (
        <div className="rounded-lg p-4" style={{ background: 'var(--amber-dim)', border: '1px solid var(--amber)' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Passwort ändern</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Aktuelles Passwort"><input type="password" style={inpStyle} value={pwForm.altes_passwort} onChange={e => setPwForm(f => ({ ...f, altes_passwort: e.target.value }))} /></Field>
            <Field label="Neues Passwort"><input type="password" style={inpStyle} value={pwForm.neues_passwort} onChange={e => setPwForm(f => ({ ...f, neues_passwort: e.target.value }))} /></Field>
            <Field label="Bestätigung"><input type="password" style={inpStyle} value={pwForm.bestaetigung} onChange={e => setPwForm(f => ({ ...f, bestaetigung: e.target.value }))} /></Field>
          </div>
          {pwError && <p style={{ fontSize: 12, color: 'var(--rose)', marginTop: 8 }}>{pwError}</p>}
          <div className="flex gap-2 mt-3">
            <button className="app-btn-primary" disabled={pwSaving || !pwForm.altes_passwort || !pwForm.neues_passwort} onClick={savePw}>Speichern</button>
            <button className="app-btn-secondary" onClick={() => setPwId(null)}>Abbrechen</button>
          </div>
        </div>
      )}

      {/* Mobile: Karten */}
      <div className="sm:hidden space-y-2">
        {items.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13, padding: '24px 0' }}>Keine Einträge</p>}
        {items.map(b => editId === b.id ? (
          <div key={b.id} className="rounded-lg p-3 space-y-3" style={{ background: 'var(--blue-dim)', border: '1px solid var(--blue)' }}>
            <div className="grid grid-cols-1 gap-3">
              <Field label="Name"><input style={inpStyle} value={editValues.name ?? ''} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} /></Field>
              <Field label="E-Mail"><input type="email" style={inpStyle} value={editValues.email ?? ''} onChange={e => setEditValues(v => ({ ...v, email: e.target.value }))} /></Field>
            </div>
            <div className="flex gap-2">
              <button className="app-btn-primary" disabled={saving} onClick={saveEdit}>Sichern</button>
              <button className="app-btn-secondary" onClick={() => setEditId(null)}>Abbrechen</button>
            </div>
          </div>
        ) : (
          <div key={b.id} className="rounded-lg p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex justify-between items-start">
              <div className="min-w-0">
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{b.name}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }} className="truncate">{b.email}</p>
              </div>
              <div className="flex gap-1.5 shrink-0 ml-2">
                <button className="app-btn-edit" onClick={() => startEdit(b)}>Bearb.</button>
                <button onClick={() => openPw(b.id)} style={{ padding: '4px 8px', fontSize: 12, fontWeight: 500, background: 'transparent', color: 'var(--amber)', border: '1px solid var(--amber-dim)', borderRadius: 5, cursor: 'pointer' }}>PW</button>
                <button className="app-btn-danger" onClick={() => handleDelete(b.id)}>Lösch.</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Tabelle */}
      <div className="hidden sm:block overflow-x-auto rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead className="app-table-head"><tr><th>Name</th><th>E-Mail</th><th></th></tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={3} className="app-table-empty">Keine Einträge</td></tr>}
            {items.map(b => editId === b.id ? (
              <tr key={b.id} className="app-table-row-edit">
                <td style={{ padding: '8px 12px' }}><input style={inpStyleSm} value={editValues.name ?? ''} onChange={e => setEditValues(v => ({ ...v, name: e.target.value }))} /></td>
                <td style={{ padding: '8px 12px' }}><input type="email" style={inpStyleSm} value={editValues.email ?? ''} onChange={e => setEditValues(v => ({ ...v, email: e.target.value }))} /></td>
                <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}><div className="flex gap-1"><button className="app-btn-primary" style={{ fontSize: 11 }} disabled={saving} onClick={saveEdit}>Sichern</button><button className="app-btn-secondary" style={{ fontSize: 11 }} onClick={() => setEditId(null)}>Abbruch</button></div></td>
              </tr>
            ) : (
              <tr key={b.id} className="app-table-row">
                <td style={{ fontWeight: 500, color: 'var(--text)' }}>{b.name}</td>
                <td>{b.email}</td>
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                  <div className="flex gap-1">
                    <button className="app-btn-edit" onClick={() => startEdit(b)}>Bearbeiten</button>
                    <button onClick={() => openPw(b.id)} style={{ padding: '4px 8px', fontSize: 12, fontWeight: 500, background: 'transparent', color: 'var(--amber)', border: '1px solid var(--amber-dim)', borderRadius: 5, cursor: 'pointer' }}>Passwort</button>
                    <button className="app-btn-danger" onClick={() => handleDelete(b.id)}>Löschen</button>
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
    <div className="rounded-md" style={{ border: '1px solid var(--blue)', background: 'var(--blue-dim)', fontSize: 12, color: 'var(--text)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 font-medium text-left"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}
      >
        <span>Einrichtungsanleitung</span>
        <span style={{ color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3 pt-2" style={{ borderTop: '1px solid var(--blue)' }}>
          <div>
            <p style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>1. Google Cloud Projekt & Service Account</p>
            <ol className="list-decimal list-inside space-y-1" style={{ color: 'var(--text-muted)' }}>
              <li>Gehe zu <span style={{ fontFamily: 'monospace' }}>console.cloud.google.com</span> und erstelle ein Projekt</li>
              <li>Suche nach <strong>Google Drive API</strong> und aktiviere sie</li>
              <li>Navigiere zu <strong>IAM &amp; Admin → Service Accounts → Service Account erstellen</strong></li>
              <li>Name vergeben (z. B. <span style={{ fontFamily: 'monospace' }}>pkv-export</span>), keine Rolle nötig</li>
              <li>Service Account öffnen → <strong>Schlüssel → Schlüssel hinzufügen → JSON</strong></li>
              <li>Die heruntergeladene JSON-Datei vollständig in das Feld unten einfügen</li>
            </ol>
          </div>
          <div>
            <p style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>2. Ordner in Google Drive freigeben</p>
            <ol className="list-decimal list-inside space-y-1" style={{ color: 'var(--text-muted)' }}>
              <li>Einen Ordner in Google Drive erstellen (z. B. <span style={{ fontFamily: 'monospace' }}>PKV-Rechnungen</span>)</li>
              <li>Rechtsklick auf den Ordner → <strong>Freigeben</strong></li>
              <li>Die <strong>client_email</strong> aus dem JSON eintragen</li>
              <li>Rolle <strong>Bearbeiter</strong> wählen → Senden</li>
            </ol>
          </div>
          <div>
            <p style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>3. Ordner-ID ermitteln</p>
            <p style={{ color: 'var(--text-muted)' }}>
              Den Ordner in Google Drive öffnen – die ID steht in der URL:{' '}
              <span style={{ fontFamily: 'monospace' }}>drive.google.com/drive/folders/<strong>1BxiMVs0XRA5…</strong></span>
            </p>
          </div>
          <div style={{ borderTop: '1px solid var(--blue)', paddingTop: 8 }}>
            <p style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>4. Einrichten &amp; testen</p>
            <p style={{ color: 'var(--text-muted)' }}>JSON einfügen, Ordner-ID eingeben, auf <strong>Verbindung testen</strong> klicken.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function EinstellungenTab() {
  const qc = useQueryClient()
  const { data: srv } = useQuery({ queryKey: ['einstellungen'], queryFn: getEinstellungen })

  const [plUrl, setPlUrl] = useState<string | null>(null)
  const [plToken, setPlToken] = useState<string | null>(null)
  const [plTestResult, setPlTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [plTesting, setPlTesting] = useState(false)
  const [plSaving, setPlSaving] = useState(false)

  const [n8nUrl, setN8nUrl] = useState<string | null>(null)
  const [n8nSaving, setN8nSaving] = useState(false)
  const [n8nRechnungUrl, setN8nRechnungUrl] = useState<string | null>(null)
  const [n8nRechnungSaving, setN8nRechnungSaving] = useState(false)

  const [gdJson, setGdJson] = useState('')
  const [gdFolderId, setGdFolderId] = useState<string | null>(null)
  const [gdShowJsonInput, setGdShowJsonInput] = useState(false)
  const [gdTestResult, setGdTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [gdTesting, setGdTesting] = useState(false)
  const [gdSaving, setGdSaving] = useState(false)

  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const [maxDim, setMaxDimState] = useState(() => getScanMaxDim())
  const [jpegQuality, setJpegQualityState] = useState(() => Math.round(getScanJpegQuality() * 100))

  const effectivePlUrl = plUrl ?? srv?.paperless_ngx_url ?? ''
  const effectivePlToken = plToken ?? srv?.paperless_ngx_token ?? ''
  const effectiveGdFolderId = gdFolderId ?? srv?.gdrive_folder_id ?? ''
  const effectiveN8nUrl = n8nUrl ?? srv?.n8n_webhook_url ?? ''
  const effectiveN8nRechnungUrl = n8nRechnungUrl ?? srv?.n8n_rechnung_webhook_url ?? ''

  const savePaperless = async () => {
    setPlSaving(true); setSaveMsg(null)
    try {
      await updateEinstellungen({ paperless_ngx_url: effectivePlUrl, paperless_ngx_token: effectivePlToken })
      qc.invalidateQueries({ queryKey: ['einstellungen'] }); qc.invalidateQueries({ queryKey: ['config'] })
      setSaveMsg('Paperless gespeichert'); setPlUrl(null); setPlToken(null)
    } catch (e) { setSaveMsg(e instanceof Error ? e.message : 'Fehler') } finally { setPlSaving(false) }
  }

  const testPaperless = async () => {
    setPlTesting(true); setPlTestResult(null)
    try { setPlTestResult(await testPaperlessConnection(effectivePlUrl, effectivePlToken)) }
    catch (e) { setPlTestResult({ ok: false, message: e instanceof Error ? e.message : 'Fehler' }) }
    finally { setPlTesting(false) }
  }

  const saveGdrive = async () => {
    setGdSaving(true); setSaveMsg(null)
    try {
      const update: Record<string, string> = { gdrive_folder_id: effectiveGdFolderId }
      if (gdJson.trim()) update.gdrive_service_account_json = gdJson.trim()
      await updateEinstellungen(update)
      qc.invalidateQueries({ queryKey: ['einstellungen'] }); qc.invalidateQueries({ queryKey: ['config'] })
      setSaveMsg('Google Drive gespeichert'); setGdJson(''); setGdShowJsonInput(false); setGdFolderId(null)
    } catch (e) { setSaveMsg(e instanceof Error ? e.message : 'Fehler') } finally { setGdSaving(false) }
  }

  const testGdrive = async () => {
    const jsonToTest = gdJson.trim() || null
    if (!jsonToTest && !srv?.gdrive_service_account_configured) {
      setGdTestResult({ ok: false, message: 'Bitte zuerst Service Account JSON eingeben' }); return
    }
    setGdTesting(true); setGdTestResult(null)
    try {
      if (!jsonToTest) { setGdTestResult({ ok: false, message: 'Für den Test bitte das Service Account JSON erneut eingeben' }); return }
      setGdTestResult(await testGdriveConnection(jsonToTest, effectiveGdFolderId || undefined))
    } catch (e) { setGdTestResult({ ok: false, message: e instanceof Error ? e.message : 'Fehler' }) }
    finally { setGdTesting(false) }
  }

  const saveN8n = async () => {
    setN8nSaving(true); setSaveMsg(null)
    try {
      await updateEinstellungen({ n8n_webhook_url: effectiveN8nUrl })
      qc.invalidateQueries({ queryKey: ['einstellungen'] }); qc.invalidateQueries({ queryKey: ['config'] })
      setSaveMsg('n8n gespeichert'); setN8nUrl(null)
    } catch (e) { setSaveMsg(e instanceof Error ? e.message : 'Fehler') } finally { setN8nSaving(false) }
  }

  const saveN8nRechnung = async () => {
    setN8nRechnungSaving(true); setSaveMsg(null)
    try {
      await updateEinstellungen({ n8n_rechnung_webhook_url: effectiveN8nRechnungUrl })
      qc.invalidateQueries({ queryKey: ['einstellungen'] }); qc.invalidateQueries({ queryKey: ['config'] })
      setSaveMsg('n8n Rechnung gespeichert'); setN8nRechnungUrl(null)
    } catch (e) { setSaveMsg(e instanceof Error ? e.message : 'Fehler') } finally { setN8nRechnungSaving(false) }
  }

  const saveScanSettings = () => {
    setScanMaxDim(maxDim); setScanJpegQuality(jpegQuality / 100)
    setSaveMsg('Scan-Einstellungen gespeichert')
    setTimeout(() => setSaveMsg(null), 2000)
  }

  const inpStyle: React.CSSProperties = { padding: '6px 10px', fontSize: 13, borderRadius: 5, width: '100%' }

  const sectionStyle: React.CSSProperties = { background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', padding: 16 }

  const [logoHasFile, setLogoHasFile] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const logoInputRef = React.useRef<HTMLInputElement>(null)

  // Prüfen ob Logo vorhanden
  React.useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(c => setLogoHasFile(!!c.has_logo)).catch(() => {})
  }, [])

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.svg') && file.type !== 'image/svg+xml') {
      setLogoError('Nur SVG-Dateien erlaubt'); return
    }
    setLogoUploading(true); setLogoError(null)
    try {
      await uploadLogo(file)
      setLogoHasFile(true)
      setSaveMsg('Logo gespeichert')
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Fehler beim Upload')
    } finally {
      setLogoUploading(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  const handleLogoDelete = async () => {
    setLogoUploading(true); setLogoError(null)
    try {
      await deleteLogo()
      setLogoHasFile(false)
      setSaveMsg('Logo entfernt')
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Fehler')
    } finally {
      setLogoUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Logo */}
      <div style={sectionStyle} className="space-y-3">
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Logo</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          SVG-Datei – wird im Login und in der Navbar angezeigt.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {logoHasFile && (
            <div style={{
              border: '1px solid var(--border)', borderRadius: 8,
              padding: '8px 12px', background: 'var(--surface-alt)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 80, height: 48,
            }}>
              <img src={`${LOGO_URL}?t=${Date.now()}`} alt="Logo" style={{ maxHeight: 36, maxWidth: 160, objectFit: 'contain' }} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              ref={logoInputRef}
              type="file"
              accept=".svg,image/svg+xml"
              style={{ display: 'none' }}
              onChange={handleLogoUpload}
            />
            <button
              onClick={() => logoInputRef.current?.click()}
              disabled={logoUploading}
              style={{
                padding: '6px 14px', fontSize: 12, borderRadius: 6,
                background: 'var(--primary)', color: '#fff', border: 'none',
                cursor: logoUploading ? 'default' : 'pointer',
                opacity: logoUploading ? 0.6 : 1,
              }}
            >
              {logoUploading ? 'Wird hochgeladen…' : logoHasFile ? 'Logo ersetzen' : 'SVG hochladen'}
            </button>
            {logoHasFile && (
              <button
                onClick={handleLogoDelete}
                disabled={logoUploading}
                style={{
                  padding: '6px 12px', fontSize: 12, borderRadius: 6,
                  background: 'none', color: 'var(--rose)',
                  border: '1px solid var(--rose)', cursor: 'pointer',
                  opacity: logoUploading ? 0.5 : 1,
                }}
              >
                Entfernen
              </button>
            )}
          </div>
        </div>
        {logoError && <p style={{ fontSize: 12, color: 'var(--rose)', margin: 0 }}>{logoError}</p>}
      </div>

      {/* Scan-Einstellungen */}
      <div style={sectionStyle} className="space-y-4">
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Scan-Einstellungen</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Werden lokal im Browser gespeichert.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Field label={`Max. Auflösung: ${maxDim} px`}>
              <input type="range" min={500} max={8000} step={100} value={maxDim}
                onChange={e => setMaxDimState(Number(e.target.value))} style={{ width: '100%' }} />
              <div className="flex justify-between mt-0.5" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                <span>500 px</span>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{maxDim} px</span>
                <span>8000 px</span>
              </div>
            </Field>
          </div>
          <div>
            <Field label={`JPEG-Qualität: ${jpegQuality} %`}>
              <input type="range" min={10} max={100} step={1} value={jpegQuality}
                onChange={e => setJpegQualityState(Number(e.target.value))} style={{ width: '100%' }} />
              <div className="flex justify-between mt-0.5" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                <span>10 %</span>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{jpegQuality} %</span>
                <span>100 %</span>
              </div>
            </Field>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="app-btn-primary" onClick={saveScanSettings}>Speichern</button>
          <button className="app-btn-secondary" onClick={() => { setMaxDimState(DEFAULT_MAX_DIM); setJpegQualityState(Math.round(DEFAULT_JPEG_QUALITY * 100)) }}>
            Zurücksetzen ({DEFAULT_MAX_DIM} px / {Math.round(DEFAULT_JPEG_QUALITY * 100)} %)
          </button>
        </div>
        {saveMsg?.includes('Scan') && <p style={{ fontSize: 12, color: 'var(--green)' }}>{saveMsg}</p>}
      </div>

      {/* Paperless NGX */}
      <div style={sectionStyle} className="space-y-4">
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Paperless NGX</h3>
        <div className="grid grid-cols-1 gap-3">
          <Field label="URL (z. B. http://paperless:8000)">
            <input style={inpStyle} value={effectivePlUrl} onChange={e => setPlUrl(e.target.value)} placeholder="http://paperless:8000" />
          </Field>
          <Field label="API-Token">
            <input type="password" style={inpStyle} value={effectivePlToken} onChange={e => setPlToken(e.target.value)} placeholder="Token aus Paperless-Einstellungen" />
          </Field>
        </div>
        {plTestResult && (
          <p style={{ fontSize: 12, color: plTestResult.ok ? 'var(--green)' : 'var(--rose)' }}>
            {plTestResult.ok ? '✓ ' : '✗ '}{plTestResult.message}
          </p>
        )}
        {saveMsg?.includes('Paperless') && <p style={{ fontSize: 12, color: 'var(--green)' }}>{saveMsg}</p>}
        <div className="flex gap-2 flex-wrap">
          <button className="app-btn-primary" disabled={plSaving} onClick={savePaperless}>
            {plSaving ? 'Speichern…' : 'Speichern'}
          </button>
          <button className="app-btn-secondary" disabled={plTesting || !effectivePlUrl} onClick={testPaperless}>
            {plTesting ? 'Teste…' : 'Verbindung testen'}
          </button>
        </div>
      </div>

      {/* n8n KI-Verarbeitung */}
      <div style={sectionStyle} className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>n8n KI-Verarbeitung</h3>
          {(srv?.n8n_webhook_url || srv?.n8n_rechnung_webhook_url) && (
            <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>✓ Konfiguriert</span>
          )}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Webhook-URLs der n8n-Workflows zur automatischen Verarbeitung per KI (Claude).
          Die Workflows befinden sich in <code style={{ fontSize: 11 }}>/home/ben/docker/n8n/</code>.
        </p>

        <Field label="Beihilfebescheid-Webhook-URL">
          <input
            style={inpStyle}
            value={effectiveN8nUrl}
            onChange={e => setN8nUrl(e.target.value)}
            placeholder="https://n8n.fringstar.net/webhook/beihilfebescheid"
          />
        </Field>
        <p style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: -8 }}>
          Bescheid-PDF hochladen → KI extrahiert Daten → Bescheid + Positionen werden automatisch angelegt.
        </p>
        {saveMsg === 'n8n gespeichert' && <p style={{ fontSize: 12, color: 'var(--green)' }}>{saveMsg}</p>}
        <div className="flex gap-2">
          <button className="app-btn-primary" disabled={n8nSaving} onClick={saveN8n}>
            {n8nSaving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
          <Field label="Rechnungsanalyse-Webhook-URL">
            <input
              style={inpStyle}
              value={effectiveN8nRechnungUrl}
              onChange={e => setN8nRechnungUrl(e.target.value)}
              placeholder="https://n8n.fringstar.net/webhook/rechnung-analyse"
            />
          </Field>
          <p style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 4, marginBottom: 8 }}>
            Rechnung als PDF hochladen → KI liest Betrag, Datum, Leistungserbringer aus → Felder in neuem Rechnungsformular vorausfüllen.
          </p>
          {saveMsg === 'n8n Rechnung gespeichert' && <p style={{ fontSize: 12, color: 'var(--green)', marginBottom: 8 }}>{saveMsg}</p>}
          <button className="app-btn-primary" disabled={n8nRechnungSaving} onClick={saveN8nRechnung}>
            {n8nRechnungSaving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>

      {/* Google Drive */}
      <div style={sectionStyle} className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Google Drive Export</h3>
          {srv?.gdrive_service_account_configured && (
            <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>✓ Konfiguriert</span>
          )}
        </div>

        <GdriveAnleitung />

        <div className="space-y-3">
          {srv?.gdrive_service_account_configured && !gdShowJsonInput ? (
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Service Account JSON: konfiguriert</span>
              <button className="app-btn-secondary" style={{ fontSize: 11 }} onClick={() => setGdShowJsonInput(true)}>Ersetzen</button>
            </div>
          ) : (
            <Field label="Service Account JSON">
              <textarea
                style={{ ...inpStyle, fontFamily: 'monospace', fontSize: 11, height: 112, resize: 'vertical' }}
                value={gdJson}
                onChange={e => setGdJson(e.target.value)}
                placeholder={'{\n  "type": "service_account",\n  "client_email": "...",\n  "private_key": "..."\n}'}
              />
            </Field>
          )}

          <Field label="Ziel-Ordner ID">
            <input style={inpStyle} value={effectiveGdFolderId} onChange={e => setGdFolderId(e.target.value)}
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms" />
            <p style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 4 }}>
              Die Ordner-ID aus der Google Drive URL: drive.google.com/drive/folders/<strong>ID</strong>
            </p>
          </Field>
        </div>

        {gdTestResult && (
          <p style={{ fontSize: 12, color: gdTestResult.ok ? 'var(--green)' : 'var(--rose)' }}>
            {gdTestResult.ok ? '✓ ' : '✗ '}{gdTestResult.message}
          </p>
        )}
        {saveMsg?.includes('Google') && <p style={{ fontSize: 12, color: 'var(--green)' }}>{saveMsg}</p>}
        <div className="flex gap-2 flex-wrap">
          <button className="app-btn-primary" disabled={gdSaving || (!gdJson.trim() && !srv?.gdrive_service_account_configured)} onClick={saveGdrive}>
            {gdSaving ? 'Speichern…' : 'Speichern'}
          </button>
          <button className="app-btn-secondary" disabled={gdTesting || (!gdJson.trim() && !srv?.gdrive_service_account_configured)} onClick={testGdrive}>
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
      <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>Stammdaten</h1>

      <div style={{ borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        <nav className="flex gap-1" style={{ minWidth: 'max-content' }}>
          {(Object.keys(tabLabels) as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: tab === t ? 600 : 400,
                color: tab === t ? 'var(--primary)' : 'var(--text-muted)',
                background: 'none',
                border: 'none',
                borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s',
              } as React.CSSProperties}
            >
              {tabLabels[t]}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'personen' && <PersonenTab />}
      {tab === 'correspondents' && <CorrespondentsTab />}
      {tab === 'beihilfestellen' && <BeihilfestellenTab />}
      {tab === 'pkv' && <PkvTab />}
      {tab === 'benutzer' && <BenutzerTab />}
      {tab === 'einstellungen' && <EinstellungenTab />}
    </div>
  )
}
