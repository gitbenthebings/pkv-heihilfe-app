import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAntraege, createAntrag, deleteAntrag } from '../api/beihilfe_antraege'
import { getBeihilfestellen } from '../api/beihilfestellen'
import { getPkv } from '../api/pkv'
import BeihilfeAntragDetail from '../components/BeihilfeAntragDetail'
import type { BeihilfeAntrag, CreateBeihilfeAntrag } from '../types'

const STATUS_LABEL: Record<string, string> = {
  entwurf: 'Entwurf', versendet: 'Versendet', in_bearbeitung: 'In Bearb.',
  beschieden: 'Beschieden', archiviert: 'Archiviert',
}

const STATUS_COLOR: Record<string, string> = {
  entwurf: 'var(--text-muted)', versendet: 'var(--blue)',
  in_bearbeitung: 'var(--amber)', beschieden: 'var(--green)', archiviert: 'var(--text-subtle)',
}

function formatDatum(s: string) {
  const [y, m, d] = s.split('T')[0].split('-')
  return `${d}.${m}.${y}`
}

export default function AntraegePage() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState<CreateBeihilfeAntrag>({ typ: 'beihilfe' })
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { data: antraege = [], isLoading } = useQuery({ queryKey: ['antraege'], queryFn: getAntraege })
  const { data: beihilfestellen = [] } = useQuery({ queryKey: ['beihilfestellen'], queryFn: getBeihilfestellen })
  const { data: pkvListe = [] } = useQuery({ queryKey: ['pkv'], queryFn: getPkv })

  const inv = () => qc.invalidateQueries({ queryKey: ['antraege'] })

  const createMut = useMutation({
    mutationFn: createAntrag,
    onSuccess: (antrag) => {
      inv()
      setShowNew(false)
      setNewForm({ typ: 'beihilfe' })
      setSelectedId(antrag.id)
    },
  })

  const deleteMut = useMutation({
    mutationFn: deleteAntrag,
    onSuccess: () => { inv(); setDeleteError(null) },
    onError: (e: Error) => setDeleteError(e.message),
  })

  if (selectedId) {
    return (
      <BeihilfeAntragDetail
        antragId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    )
  }

  const AntragTypBadge = ({ typ }: { typ: string }) => (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
      background: typ === 'pkv' ? 'var(--teal-dim)' : 'var(--blue-dim)',
      color: typ === 'pkv' ? 'var(--teal)' : 'var(--blue)',
      border: typ === 'pkv' ? '1px solid rgba(0,196,176,.2)' : '1px solid rgba(74,136,245,.2)',
    }}>
      {typ === 'pkv' ? 'PKV' : 'BH'}
    </span>
  )

  const AntragCard = ({ a }: { a: BeihilfeAntrag }) => {
    const stelle = a.typ === 'beihilfe' ? beihilfestellen.find(b => b.id === a.beihilfestelle_id) : null
    const pkv = a.typ === 'pkv' ? pkvListe.find(p => p.id === a.pkv_id) : null
    const institution = stelle?.name ?? pkv?.name ?? a.pkv_versicherer

    return (
      <div
        onClick={() => setSelectedId(a.id)}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          padding: '14px 16px', cursor: 'pointer', transition: 'border-color .15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
              <AntragTypBadge typ={a.typ} />
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                color: STATUS_COLOR[a.status] ?? 'var(--text-muted)',
                background: 'var(--surface-alt)',
              }}>
                {STATUS_LABEL[a.status] ?? a.status}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontWeight: 600 }}>
                #{String(a.referenz_nr ?? 0).padStart(4, '0')}
              </span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: a.titel ? 'var(--text)' : 'var(--text-subtle)', fontStyle: a.titel ? 'normal' : 'italic', marginBottom: 2 }}>
              {a.titel ?? 'Kein Titel'}
            </div>
            {institution && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{institution}</div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{formatDatum(a.erstellt_am)}</div>
            <button
              onClick={e => {
                e.stopPropagation()
                if (confirm('Antrag wirklich löschen?')) deleteMut.mutate(a.id)
              }}
              style={{ marginTop: 6, fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--rose)', background: 'transparent', color: 'var(--rose)', cursor: 'pointer' }}
            >
              Löschen
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em' }}>Anträge</h1>
        <button className="app-btn-primary" onClick={() => setShowNew(s => !s)}>
          {showNew ? 'Abbrechen' : '+ Neuer Antrag'}
        </button>
      </div>

      {deleteError && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--rose-dim)', border: '1px solid var(--rose)', fontSize: 13, color: 'var(--rose)', marginBottom: 12 }}>
          {deleteError}
        </div>
      )}

      {showNew && (
        <div style={{
          background: 'var(--blue-dim)', border: '1px solid rgba(74,136,245,.3)',
          borderRadius: 12, padding: '18px 20px', marginBottom: 20, animation: 'fade-in .15s ease',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Neuer Antrag</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>TYP</label>
              <select
                style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6 }}
                value={newForm.typ}
                onChange={e => setNewForm(f => ({ ...f, typ: e.target.value as 'beihilfe' | 'pkv', beihilfestelle_id: undefined, pkv_id: undefined }))}
              >
                <option value="beihilfe">Beihilfe</option>
                <option value="pkv">PKV</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>TITEL (optional)</label>
              <input
                style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6 }}
                placeholder="z.B. Q1 2026"
                value={newForm.titel ?? ''}
                onChange={e => setNewForm(f => ({ ...f, titel: e.target.value || undefined }))}
              />
            </div>
            {newForm.typ === 'beihilfe' ? (
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>BEIHILFESTELLE</label>
                <select
                  style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6 }}
                  value={newForm.beihilfestelle_id ?? ''}
                  onChange={e => setNewForm(f => ({ ...f, beihilfestelle_id: e.target.value || undefined }))}
                >
                  <option value="">(keine)</option>
                  {beihilfestellen.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            ) : (
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>PKV</label>
                <select
                  style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 6 }}
                  value={newForm.pkv_id ?? ''}
                  onChange={e => setNewForm(f => ({ ...f, pkv_id: e.target.value || undefined }))}
                >
                  <option value="">(keine)</option>
                  {pkvListe.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <button
              className="app-btn-primary"
              disabled={createMut.isPending}
              onClick={() => createMut.mutate(newForm)}
            >
              {createMut.isPending ? 'Erstelle…' : 'Erstellen'}
            </button>
            <button className="app-btn-secondary" onClick={() => setShowNew(false)}>Abbrechen</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Lade…</p>
      ) : antraege.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-subtle)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Noch keine Anträge</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Erstelle deinen ersten Beihilfe- oder PKV-Antrag.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {antraege.map(a => <AntragCard key={a.id} a={a} />)}
        </div>
      )}
    </div>
  )
}
