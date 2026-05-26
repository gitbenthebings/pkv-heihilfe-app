import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { getAntraege, createAntrag, getAntragRechnungen } from '../api/beihilfe_antraege'
import { getBeihilfestellen } from '../api/beihilfestellen'
import { getPkv } from '../api/pkv'
import { getRechnungen } from '../api/rechnungen'
import BeihilfeAntraege from '../components/BeihilfeAntraege'
import BeihilfeAntragDetail from '../components/BeihilfeAntragDetail'
import type { CreateBeihilfeAntrag, Beihilfestelle, Pkv, Rechnung } from '../types'

// ── 2-step CreateModal ───────────────────────────────────────────────────────
function CreateModal({
  beihilfestellen,
  pkvListe,
  onClose,
  onCreate,
}: {
  beihilfestellen: Beihilfestelle[]
  pkvListe: Pkv[]
  onClose: () => void
  onCreate: (data: CreateBeihilfeAntrag) => void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [typ, setTyp] = useState<'beihilfe' | 'pkv' | null>(null)
  const [beihilfestelle_id, setBH] = useState('')
  const [pkv_id, setPkv] = useState('')
  const [pkv_versicherer, setPkvVersicherer] = useState('')
  const [titel, setTitel] = useState('')

  const canSubmit = typ === 'beihilfe'
    ? !!beihilfestelle_id
    : !!(pkv_id || pkv_versicherer)

  const doCreate = () => {
    if (!typ || !canSubmit) return
    const data: CreateBeihilfeAntrag = {
      typ,
      titel: titel.trim() || undefined,
      ...(typ === 'beihilfe'
        ? { beihilfestelle_id: beihilfestelle_id || undefined }
        : { pkv_id: pkv_id || undefined, pkv_versicherer: pkv_versicherer || undefined }),
    }
    onCreate(data)
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
          width: 460, boxShadow: '0 40px 100px rgba(0,0,0,.5)', overflow: 'hidden',
          animation: 'fade-in .22s ease',
        }}
      >
        {/* Modal header */}
        <div style={{
          padding: '20px 24px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.01em' }}>Neuer Antrag</div>
            <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 2 }}>Schritt {step} / 2</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {[0, 1].map(i => (
              <div key={i} style={{
                height: 4, borderRadius: 2,
                transition: 'width .3s ease',
                width: i < step ? 20 : 8,
                background: i < step - 1 ? 'var(--green)' : i === step - 1 ? 'var(--primary)' : 'var(--border)',
              }} />
            ))}
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          {step === 1 ? (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>
                An welche Stelle soll der Antrag gehen?
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {([
                  { t: 'beihilfe' as const, label: 'Beihilfe', sub: 'Beihilfestelle des Arbeitgebers', icon: '🏛', color: 'var(--blue)', dim: 'var(--blue-dim)', border: 'rgba(74,136,245,.2)' },
                  { t: 'pkv' as const,      label: 'PKV',      sub: 'Private Krankenversicherung',     icon: '🏥', color: 'var(--teal)', dim: 'var(--teal-dim)', border: 'rgba(0,196,176,.2)' },
                ]).map(opt => (
                  <div
                    key={opt.t}
                    onClick={() => { setTyp(opt.t); setBH(''); setPkv(''); setPkvVersicherer(''); setStep(2) }}
                    style={{
                      padding: '22px 18px', borderRadius: 12, cursor: 'pointer',
                      border: `2px solid ${opt.border}`, background: opt.dim,
                      transition: 'transform .12s, box-shadow .12s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${opt.border}` }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '' }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 10 }}>{opt.icon}</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: opt.color, marginBottom: 5, letterSpacing: '-.01em' }}>{opt.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{opt.sub}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <button
                  onClick={() => setStep(1)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 11, padding: 0 }}
                >
                  ← zurück
                </button>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                  background: typ === 'pkv' ? 'var(--teal-dim)' : 'var(--blue-dim)',
                  color: typ === 'pkv' ? 'var(--teal)' : 'var(--blue)',
                  border: `1px solid ${typ === 'pkv' ? 'rgba(0,196,176,.2)' : 'rgba(74,136,245,.2)'}`,
                }}>
                  {typ === 'pkv' ? 'PKV' : 'BH'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {typ === 'beihilfe' ? (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '.08em', marginBottom: 6 }}>BEIHILFESTELLE *</div>
                    <select
                      style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                      value={beihilfestelle_id}
                      onChange={e => setBH(e.target.value)}
                    >
                      <option value="">Stelle auswählen…</option>
                      {beihilfestellen.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '.08em', marginBottom: 6 }}>PKV *</div>
                    {pkvListe.length > 0 ? (
                      <select
                        style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                        value={pkv_id}
                        onChange={e => setPkv(e.target.value)}
                      >
                        <option value="">PKV auswählen…</option>
                        {pkvListe.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    ) : (
                      <input
                        style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                        placeholder="z. B. DKV, Debeka, …"
                        value={pkv_versicherer}
                        onChange={e => setPkvVersicherer(e.target.value)}
                      />
                    )}
                  </div>
                )}

                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '.08em', marginBottom: 6 }}>
                    TITEL <span style={{ fontWeight: 400 }}>optional</span>
                  </div>
                  <input
                    style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                    placeholder="z. B. Q1 2026 Kinder"
                    value={titel}
                    onChange={e => setTitel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && canSubmit) doCreate() }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                <button
                  className="app-btn-secondary"
                  onClick={onClose}
                  style={{ flex: 1 }}
                >
                  Abbrechen
                </button>
                <button
                  className="app-btn-primary"
                  onClick={doCreate}
                  disabled={!canSubmit}
                  style={{ flex: 2, opacity: canSubmit ? 1 : 0.45 }}
                >
                  Antrag anlegen →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── List panel ───────────────────────────────────────────────────────────────
const STATUS_FILTER_OPTIONS = [
  { value: 'aktiv', label: 'Aktive Anträge' },
  { value: '', label: 'Alle Status' },
  { value: 'entwurf', label: 'Entwurf' },
  { value: 'versendet', label: 'Versendet' },
  { value: 'in_bearbeitung', label: 'In Bearbeitung' },
  { value: 'beschieden', label: 'Beschieden' },
  { value: 'archiviert', label: 'Archiviert' },
]

const AKTIV_STATUS = new Set(['entwurf', 'versendet', 'in_bearbeitung'])

function ListPanel({
  selectedId,
  onSelect,
}: {
  selectedId: string | undefined
  onSelect: (id: string) => void
}) {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('aktiv')
  const [typFilter, setTypFilter] = useState<'' | 'beihilfe' | 'pkv'>('')

  const { data: antraegeAll = [], isLoading } = useQuery({
    queryKey: ['antraege', statusFilter === 'aktiv' || statusFilter === '' ? undefined : statusFilter],
    queryFn: () => getAntraege(statusFilter === 'aktiv' || statusFilter === '' ? undefined : statusFilter),
  })

  const { data: beihilfestellen = [] } = useQuery({ queryKey: ['beihilfestellen'], queryFn: getBeihilfestellen })
  const { data: pkvListe = [] } = useQuery({ queryKey: ['pkv'], queryFn: getPkv })
  const { data: alleRechnungen = [] } = useQuery({ queryKey: ['rechnungen'], queryFn: () => getRechnungen() })

  const antraege = useMemo(() => {
    let list = antraegeAll
    if (statusFilter === 'aktiv') list = list.filter(a => AKTIV_STATUS.has(a.status))
    if (typFilter) list = list.filter(a => a.typ === typFilter)
    return list
  }, [antraegeAll, statusFilter, typFilter])

  const openCount = antraege.filter(a => AKTIV_STATUS.has(a.status)).length

  const antragRechnungenResults = useQueries({
    queries: antraege.map(a => ({
      queryKey: ['antragRechnungen', a.id],
      queryFn: () => getAntragRechnungen(a.id),
      staleTime: 60_000,
    })),
  })

  const summaries = useMemo(() => {
    const result: Record<string, { betrag: number; erwartet: number | null; tatsaechlich: number | null }> = {}
    antraege.forEach((a, i) => {
      const ar = antragRechnungenResults[i]?.data ?? []
      const matched = ar
        .map(x => alleRechnungen.find(r => r.id === x.rechnung_id))
        .filter((r): r is Rechnung => r != null)
      const betrag = matched.reduce((s, r) => s + r.betrag, 0)
      const isPkv = a.typ === 'pkv'
      const hasErwartet = matched.some(r => isPkv ? r.pkv_anteil_erwartet != null : r.beihilfe_anteil_erwartet != null)
      const erwartet = hasErwartet
        ? matched.reduce((s, r) => s + (isPkv ? (r.pkv_anteil_erwartet ?? 0) : (r.beihilfe_anteil_erwartet ?? 0)), 0)
        : null
      const hasTats = matched.some(r => isPkv ? r.pkv_erstattet_betrag != null : r.beihilfe_erstattet_betrag != null)
      const tatsaechlich = hasTats
        ? matched.reduce((s, r) => s + (isPkv ? (r.pkv_erstattet_betrag ?? 0) : (r.beihilfe_erstattet_betrag ?? 0)), 0)
        : null
      result[a.id] = { betrag, erwartet, tatsaechlich }
    })
    return result
  }, [antraege, antragRechnungenResults, alleRechnungen])

  const createMut = useMutation({
    mutationFn: (data: CreateBeihilfeAntrag) => createAntrag(data),
    onSuccess: (antrag) => {
      qc.invalidateQueries({ queryKey: ['antraege'] })
      onSelect(antrag.id)
    },
  })

  return (
    <>
      {showModal && (
        <CreateModal
          beihilfestellen={beihilfestellen}
          pkvListe={pkvListe}
          onClose={() => setShowModal(false)}
          onCreate={data => createMut.mutate(data)}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--surface)' }}>
        {/* Header */}
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.01em' }}>Anträge</h2>
            <button
              className="app-btn-primary"
              style={{ padding: '6px 14px', fontSize: 11, borderRadius: 20 }}
              onClick={() => setShowModal(true)}
            >
              + Neuer Antrag
            </button>
          </div>

          {/* Quick-stats pill */}
          {openCount > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--amber-dim)', border: '1px solid rgba(232,160,48,.2)',
              borderRadius: 20, padding: '3px 10px', marginBottom: 10,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)' }} />
              <span style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 700 }}>{openCount} offen</span>
            </div>
          )}

          {/* Typ tabs */}
          <div style={{ display: 'flex', background: 'var(--surface-alt)', borderRadius: 8, padding: 3, marginBottom: 8 }}>
            {(['', 'beihilfe', 'pkv'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTypFilter(t)}
                style={{
                  flex: 1, border: 'none', borderRadius: 6, padding: '5px 0', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: typFilter === t ? 'var(--surface)' : 'transparent',
                  color: typFilter === t ? 'var(--text)' : 'var(--text-subtle)',
                  boxShadow: typFilter === t ? '0 1px 4px rgba(0,0,0,.12)' : 'none',
                  transition: 'all .15s',
                }}
              >
                {t === '' ? 'Alle' : t === 'pkv' ? 'PKV' : 'BH'}
              </button>
            ))}
          </div>

          {/* Status select */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ width: '100%', fontSize: 11, padding: '6px 10px', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}
          >
            {STATUS_FILTER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {isLoading
            ? <p style={{ padding: '16px', fontSize: 13, color: 'var(--text-muted)' }}>Lade…</p>
            : <BeihilfeAntraege
                antraege={antraege}
                beihilfestellen={beihilfestellen}
                pkvListe={pkvListe}
                selectedId={selectedId}
                onSelect={onSelect}
                summaries={summaries}
              />
          }
        </div>

        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: 'var(--text-subtle)' }}>
            {antraege.length} Antrag{antraege.length !== 1 ? 'e' : ''}
          </span>
        </div>
      </div>
    </>
  )
}

export default function BeihilfeAntraegePage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()

  const handleSelect = (antragId: string) => {
    navigate(`/beihilfe-antraege/${antragId}`)
  }

  return (
    <>
      {/* ── Desktop split layout (sm+) ── */}
      <div
        className="hidden sm:flex"
        style={{ position: 'fixed', top: 46, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}
      >
        <div style={{ width: 372, flexShrink: 0, borderRight: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <ListPanel selectedId={id} onSelect={handleSelect} />
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
          {id
            ? <BeihilfeAntragDetail key={id} antragId={id} />
            : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--surface-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="22" height="22" viewBox="0 0 12 12" fill="none">
                    <rect x="1" y="1" width="4" height="5" rx="1" fill="var(--primary)" opacity=".6" />
                    <rect x="7" y="1" width="4" height="3" rx="1" fill="var(--primary)" opacity=".35" />
                    <rect x="1" y="8" width="10" height="3" rx="1" fill="var(--primary)" opacity=".5" />
                  </svg>
                </div>
                <span style={{ fontSize: 13, color: 'var(--text-subtle)' }}>Antrag auswählen</span>
              </div>
            )
          }
        </div>
      </div>

      {/* ── Mobile layout ── */}
      <div className="sm:hidden">
        {id
          ? <BeihilfeAntragDetail key={id} antragId={id} onBack={() => navigate('/beihilfe-antraege')} />
          : (
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 46px)' }}>
              <ListPanel selectedId={undefined} onSelect={handleSelect} />
            </div>
          )
        }
      </div>
    </>
  )
}
