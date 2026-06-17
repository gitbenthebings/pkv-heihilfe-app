import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { getAntraege, createAntrag, getAntragRechnungen } from '../api/beihilfe_antraege'
import { getBescheide } from '../api/beihilfe_bescheide'
import { getBeihilfestellen } from '../api/beihilfestellen'
import { getPkv } from '../api/pkv'
import { getRechnungen } from '../api/rechnungen'
import BeihilfeAntraege from '../components/BeihilfeAntraege'
import BeihilfeAntragSlider from '../components/BeihilfeAntragSlider'
import type { CreateBeihilfeAntrag, Beihilfestelle, Pkv, Rechnung } from '../types'

const AKTIV_STATUS = new Set(['entwurf', 'versendet', 'in_bearbeitung'])

const STATUS_FILTERS = [
  { value: 'aktiv',         label: 'Aktiv',          dot: 'var(--primary)' },
  { value: '',              label: 'Alle',            dot: 'var(--text-subtle)' },
  { value: 'entwurf',      label: 'Entwurf',         dot: 'var(--text-subtle)' },
  { value: 'versendet',    label: 'Versendet',        dot: 'var(--blue)' },
  { value: 'in_bearbeitung', label: 'In Bearbeitung', dot: 'var(--amber)' },
  { value: 'beschieden',   label: 'Beschieden',       dot: 'var(--green)' },
  { value: 'archiviert',   label: 'Archiviert',       dot: 'var(--text-subtle)' },
]

const TYP_FILTERS = [
  { value: '',         label: 'Alle',      dot: 'var(--primary)' },
  { value: 'beihilfe', label: 'Beihilfe',  dot: 'var(--blue)' },
  { value: 'pkv',      label: 'PKV',       dot: 'var(--teal)' },
]

// ── Sidebar-Komponenten ────────────────────────────────────────────────────────
function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: 'var(--text-subtle)',
        letterSpacing: '0.07em', textTransform: 'uppercase',
        marginBottom: 8, padding: '0 4px',
      }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {children}
      </div>
    </div>
  )
}

function FilterRow({ label, count, active, dot, onClick }: {
  label: string; count: number; active: boolean; dot?: string; onClick: () => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
        background: active ? 'var(--row-active)' : hov ? 'var(--row-hover)' : 'transparent',
        transition: 'background 0.12s',
      }}
    >
      {dot && (
        <span style={{ width: 8, height: 8, borderRadius: 3, background: dot, flexShrink: 0 }} />
      )}
      <span style={{
        flex: 1, fontSize: 13,
        color: active ? 'var(--text)' : 'var(--text-muted)',
        fontWeight: active ? 600 : 400,
      }}>{label}</span>
      <span style={{
        fontSize: 11, color: 'var(--text-subtle)',
        background: active ? 'var(--surface-hi)' : 'transparent',
        borderRadius: 10, padding: '1px 7px',
        minWidth: 22, textAlign: 'center',
        fontVariantNumeric: 'tabular-nums',
      }}>{count}</span>
    </div>
  )
}

// ── 2-step CreateModal ─────────────────────────────────────────────────────────
function CreateModal({
  beihilfestellen, pkvListe, onClose, onCreate,
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

  const canSubmit = typ === 'beihilfe' ? !!beihilfestelle_id : !!(pkv_id || pkv_versicherer)

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
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.01em' }}>Neuer Antrag</div>
            <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 2 }}>Schritt {step} / 2</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {[0, 1].map(i => (
              <div key={i} style={{
                height: 4, borderRadius: 2, transition: 'width .3s ease',
                width: i < step ? 20 : 8,
                background: i < step - 1 ? 'var(--green)' : i === step - 1 ? 'var(--primary)' : 'var(--border)',
              }} />
            ))}
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          {step === 1 ? (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>An welche Stelle soll der Antrag gehen?</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {([
                  { t: 'beihilfe' as const, label: 'Beihilfe', sub: 'Beihilfestelle des Arbeitgebers', icon: '🏛', color: 'var(--blue)', dim: 'var(--blue-dim)', border: 'rgba(74,136,245,.2)' },
                  { t: 'pkv' as const,      label: 'PKV',      sub: 'Private Krankenversicherung',     icon: '🏥', color: 'var(--teal)', dim: 'var(--teal-dim)', border: 'rgba(0,196,176,.2)' },
                ]).map(opt => (
                  <div
                    key={opt.t}
                    onClick={() => { setTyp(opt.t); setBH(''); setPkv(''); setPkvVersicherer(''); setStep(2) }}
                    style={{ padding: '22px 18px', borderRadius: 12, cursor: 'pointer', border: `2px solid ${opt.border}`, background: opt.dim, transition: 'transform .12s, box-shadow .12s' }}
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
                <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 11, padding: 0 }}>← zurück</button>
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
                      value={beihilfestelle_id} onChange={e => setBH(e.target.value)}
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
                        value={pkv_id} onChange={e => setPkv(e.target.value)}
                      >
                        <option value="">PKV auswählen…</option>
                        {pkvListe.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    ) : (
                      <input
                        style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                        placeholder="z. B. DKV, Debeka, …"
                        value={pkv_versicherer} onChange={e => setPkvVersicherer(e.target.value)}
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
                    value={titel} onChange={e => setTitel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && canSubmit) doCreate() }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                <button className="app-btn-secondary" onClick={onClose} style={{ flex: 1 }}>Abbrechen</button>
                <button className="app-btn-primary" onClick={doCreate} disabled={!canSubmit} style={{ flex: 2, opacity: canSubmit ? 1 : 0.45 }}>
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

// ── Page ───────────────────────────────────────────────────────────────────────
export default function BeihilfeAntraegePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('antrag') || null

  const [showModal, setShowModal] = useState(false)
  const [typFilter, setTypFilter] = useState<'' | 'beihilfe' | 'pkv'>('')
  const [statusFilter, setStatusFilter] = useState<string>('aktiv')

  const qc = useQueryClient()

  const { data: antraegeAll = [], isLoading } = useQuery({
    queryKey: ['antraege'],
    queryFn: () => getAntraege(),
  })
  const { data: beihilfestellen = [] } = useQuery({ queryKey: ['beihilfestellen'], queryFn: getBeihilfestellen })
  const { data: pkvListe = [] } = useQuery({ queryKey: ['pkv'], queryFn: getPkv })
  const { data: alleRechnungen = [] } = useQuery({ queryKey: ['rechnungen'], queryFn: () => getRechnungen() })

  // Facet counts
  const baseForTypFacets = useMemo(() => antraegeAll.filter(a => {
    if (statusFilter === 'aktiv') return AKTIV_STATUS.has(a.status)
    if (statusFilter) return a.status === statusFilter
    return true
  }), [antraegeAll, statusFilter])

  const typCounts = useMemo(() => ({
    '': baseForTypFacets.length,
    beihilfe: baseForTypFacets.filter(a => a.typ === 'beihilfe').length,
    pkv: baseForTypFacets.filter(a => a.typ === 'pkv').length,
  }), [baseForTypFacets])

  const baseForStatusFacets = useMemo(() => antraegeAll.filter(a => {
    if (typFilter && a.typ !== typFilter) return false
    return true
  }), [antraegeAll, typFilter])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      '': baseForStatusFacets.length,
      aktiv: baseForStatusFacets.filter(a => AKTIV_STATUS.has(a.status)).length,
    }
    for (const a of baseForStatusFacets) counts[a.status] = (counts[a.status] ?? 0) + 1
    return counts
  }, [baseForStatusFacets])

  const antraege = useMemo(() => {
    let list = antraegeAll
    if (typFilter) list = list.filter(a => a.typ === typFilter)
    if (statusFilter === 'aktiv') list = list.filter(a => AKTIV_STATUS.has(a.status))
    else if (statusFilter) list = list.filter(a => a.status === statusFilter)
    return list
  }, [antraegeAll, typFilter, statusFilter])

  const antragRechnungenResults = useQueries({
    queries: antraege.map(a => ({
      queryKey: ['antragRechnungen', a.id],
      queryFn: () => getAntragRechnungen(a.id),
      staleTime: 60_000,
    })),
  })

  const antragBescheideResults = useQueries({
    queries: antraege.map(a => ({
      queryKey: ['bescheide', a.id],
      queryFn: () => getBescheide(a.id),
      staleTime: 60_000,
    })),
  })

  const summaries = useMemo(() => {
    const result: Record<string, { betrag: number; erwartet: number | null; tatsaechlich: number | null; has_widerspruch: boolean }> = {}
    antraege.forEach((a, i) => {
      const ar = antragRechnungenResults[i]?.data ?? []
      const matched = ar.map(x => alleRechnungen.find(r => r.id === x.rechnung_id)).filter((r): r is Rechnung => r != null)
      const betrag = matched.reduce((s, r) => s + r.betrag, 0)
      const isPkv = a.typ === 'pkv'
      const hasErwartet = matched.some(r => isPkv ? r.pkv_anteil_erwartet != null : r.beihilfe_anteil_erwartet != null)
      const erwartet = hasErwartet ? matched.reduce((s, r) => s + (isPkv ? (r.pkv_anteil_erwartet ?? 0) : (r.beihilfe_anteil_erwartet ?? 0)), 0) : null
      const hasTats = matched.some(r => isPkv ? r.pkv_erstattet_betrag != null : r.beihilfe_erstattet_betrag != null)
      const tatsaechlich = hasTats ? matched.reduce((s, r) => s + (isPkv ? (r.pkv_erstattet_betrag ?? 0) : (r.beihilfe_erstattet_betrag ?? 0)), 0) : null
      const has_widerspruch = (antragBescheideResults[i]?.data ?? []).some(b => b.typ === 'widerspruchsbescheid')
      result[a.id] = { betrag, erwartet, tatsaechlich, has_widerspruch }
    })
    return result
  }, [antraege, antragRechnungenResults, antragBescheideResults, alleRechnungen])

  const createMut = useMutation({
    mutationFn: (data: CreateBeihilfeAntrag) => createAntrag(data),
    onSuccess: (antrag) => {
      qc.invalidateQueries({ queryKey: ['antraege'] })
      setSearchParams({ antrag: antrag.id })
    },
  })

  const handleSelect = (antragId: string) => setSearchParams({ antrag: antragId })
  const handleClose = () => setSearchParams({})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Mobile Typ-Tabs */}
      <div className="flex sm:hidden" style={{ overflowX: 'auto', flexShrink: 0, borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        {TYP_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setTypFilter(f.value as '' | 'beihilfe' | 'pkv')}
            style={{
              minWidth: 'max-content', padding: '10px 14px',
              fontSize: 13, border: 'none', background: 'none', cursor: 'pointer',
              color: typFilter === f.value ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: `2px solid ${typFilter === f.value ? 'var(--primary)' : 'transparent'}`,
              fontWeight: typFilter === f.value ? 600 : 400, whiteSpace: 'nowrap',
            }}
          >{f.label}</button>
        ))}
      </div>

      {/* Mobile Status-Tabs */}
      <div className="flex sm:hidden" style={{ overflowX: 'auto', flexShrink: 0, borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value + '-s'}
            onClick={() => setStatusFilter(f.value)}
            style={{
              minWidth: 'max-content', padding: '8px 14px',
              fontSize: 12, border: 'none', background: 'none', cursor: 'pointer',
              color: statusFilter === f.value ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: `2px solid ${statusFilter === f.value ? 'var(--primary)' : 'transparent'}`,
              fontWeight: statusFilter === f.value ? 600 : 400, whiteSpace: 'nowrap',
            }}
          >{f.label}</button>
        ))}
      </div>

      {/* Body: Sidebar + Hauptbereich */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* ── Sidebar ── */}
        <div className="hidden sm:flex" style={{
          width: 236, minWidth: 236, flexShrink: 0,
          borderRight: '1px solid var(--border)',
          background: 'var(--surface)',
          flexDirection: 'column',
          overflowY: 'auto',
        }}>
          <div style={{ padding: '18px 14px 8px' }}>
            <FilterGroup title="Typ">
              {TYP_FILTERS.map(f => (
                <FilterRow
                  key={f.value}
                  label={f.label}
                  count={typCounts[f.value as keyof typeof typCounts] ?? 0}
                  active={typFilter === f.value}
                  dot={f.dot}
                  onClick={() => setTypFilter(f.value as '' | 'beihilfe' | 'pkv')}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="Status">
              {STATUS_FILTERS.map(f => (
                <FilterRow
                  key={f.value + '-s'}
                  label={f.label}
                  count={statusCounts[f.value] ?? 0}
                  active={statusFilter === f.value}
                  dot={f.dot}
                  onClick={() => setStatusFilter(f.value)}
                />
              ))}
            </FilterGroup>
          </div>
        </div>

        {/* ── Hauptbereich ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

          {/* Toolbar */}
          <div style={{
            padding: '16px 24px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          }}>
            <div>
              <h1 style={{ fontSize: 21, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }}>Anträge</h1>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                {antraege.length} {antraege.length === 1 ? 'Antrag' : 'Anträge'}
                {statusFilter === 'aktiv' ? ' · Aktiv' : statusFilter ? ` · ${STATUS_FILTERS.find(s => s.value === statusFilter)?.label}` : ''}
                {typFilter ? ` · ${typFilter === 'beihilfe' ? 'Beihilfe' : 'PKV'}` : ''}
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              style={{
                background: 'var(--primary)', color: '#fff', border: 'none',
                borderRadius: 20, padding: '8px 18px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              + Neuer Antrag
            </button>
          </div>

          {/* Liste */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {isLoading ? (
              <p style={{ padding: '16px', fontSize: 13, color: 'var(--text-muted)' }}>Lade…</p>
            ) : antraege.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70%', gap: 10, color: 'var(--text-subtle)' }}>
                <div style={{ fontSize: 28, opacity: 0.4 }}>📋</div>
                <span style={{ fontSize: 13 }}>Keine Anträge gefunden</span>
              </div>
            ) : (
              <BeihilfeAntraege
                antraege={antraege}
                beihilfestellen={beihilfestellen}
                pkvListe={pkvListe}
                selectedId={selectedId || undefined}
                onSelect={handleSelect}
                summaries={summaries}
              />
            )}
          </div>
        </div>
      </div>

      <BeihilfeAntragSlider antragId={selectedId} onClose={handleClose} />

      {showModal && (
        <CreateModal
          beihilfestellen={beihilfestellen}
          pkvListe={pkvListe}
          onClose={() => setShowModal(false)}
          onCreate={data => createMut.mutate(data)}
        />
      )}
    </div>
  )
}
