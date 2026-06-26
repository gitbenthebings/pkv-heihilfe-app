import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getAntrag, setAntragStatus, getAntragRechnungen, addRechnung, removeRechnung, updateAntrag,
} from '../api/beihilfe_antraege'
import { getBescheide } from '../api/beihilfe_bescheide'
import { getRechnungen } from '../api/rechnungen'
import { getPersonen } from '../api/personen'
import { getCorrespondents } from '../api/correspondents'
import { getBeihilfestellen } from '../api/beihilfestellen'
import { getPkv } from '../api/pkv'
import BeihilfeBescheidForm from './BeihilfeBescheidForm'
import BelegReferenzListe from './BelegReferenzListe'
import RechnungDetailSlider from './RechnungDetailSlider'
import { useToast } from '../context/ToastContext'
import type { AntragStatus, UpdateBeihilfeAntrag } from '../types'

function formatEuro(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

type Tab = 'details' | 'bescheid' | 'belege'

const STATUSES: AntragStatus[] = ['entwurf', 'versendet', 'in_bearbeitung', 'beschieden', 'archiviert']
const STATUS_LABELS: Record<AntragStatus, string> = {
  entwurf: 'Entwurf', versendet: 'Versendet', in_bearbeitung: 'In Bearbeitung',
  beschieden: 'Beschieden', archiviert: 'Archiviert',
}
const STATUS_COLORS: Record<AntragStatus, { bg: string; color: string; border: string }> = {
  entwurf:        { bg: 'var(--surface-hi)',  color: 'var(--text-muted)',  border: 'var(--border)' },
  versendet:      { bg: 'var(--blue-dim)',    color: 'var(--blue)',        border: 'rgba(74,136,245,.3)' },
  in_bearbeitung: { bg: 'var(--amber-dim)',   color: 'var(--amber)',       border: 'rgba(232,160,48,.3)' },
  beschieden:     { bg: 'var(--green-dim)',   color: 'var(--green)',       border: 'rgba(78,200,122,.3)' },
  archiviert:     { bg: 'var(--surface-hi)',  color: 'var(--text-subtle)', border: 'var(--border)' },
}
const DATE_STEPS: AntragStatus[] = ['versendet', 'in_bearbeitung']

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 13, padding: '3px 0' }}>
      <span style={{ color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  )
}

interface Props {
  antragId: string
  onClose?: () => void
}

export default function BeihilfeAntragDetail({ antragId, onClose }: Props) {
  const qc = useQueryClient()
  const { showToast } = useToast()

  const [tab, setTab] = useState<Tab>('details')
  const [editingMeta, setEditingMeta] = useState(false)
  const [metaValues, setMetaValues] = useState<UpdateBeihilfeAntrag>({})
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [pendingStep, setPendingStep] = useState<AntragStatus | null>(null)
  const [stepDate, setStepDate] = useState(new Date().toISOString().slice(0, 10))
  const [addRechnungError, setAddRechnungError] = useState<string | null>(null)
  const [editingPaperlessUrl, setEditingPaperlessUrl] = useState(false)
  const [paperlessUrlInput, setPaperlessUrlInput] = useState('')
  const [sliderRechnungId, setSliderRechnungId] = useState<string | null>(null)

  useEffect(() => {
    setTab('details')
    setEditingMeta(false)
    setPendingStep(null)
    setAddRechnungError(null)
  }, [antragId])

  const { data: antrag, isLoading } = useQuery({
    queryKey: ['antrag', antragId],
    queryFn: () => getAntrag(antragId),
  })
  const { data: antragRechnungen = [] } = useQuery({
    queryKey: ['antragRechnungen', antragId],
    queryFn: () => getAntragRechnungen(antragId),
  })
  const { data: bescheide = [] } = useQuery({
    queryKey: ['bescheide', antragId],
    queryFn: () => getBescheide(antragId),
  })
  const { data: rechnungen = [] } = useQuery({ queryKey: ['rechnungen'], queryFn: () => getRechnungen() })
  const { data: personen = [] } = useQuery({ queryKey: ['personen'], queryFn: getPersonen })
  const { data: correspondents = [] } = useQuery({ queryKey: ['correspondents'], queryFn: getCorrespondents })
  const { data: beihilfestellen = [] } = useQuery({ queryKey: ['beihilfestellen'], queryFn: getBeihilfestellen })
  const { data: pkvListe = [] } = useQuery({ queryKey: ['pkv'], queryFn: getPkv })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['antrag', antragId] })
    qc.invalidateQueries({ queryKey: ['antragRechnungen', antragId] })
    qc.invalidateQueries({ queryKey: ['antraege'] })
  }

  const statusMut = useMutation({
    mutationFn: ({ status, versendet_am }: { status: AntragStatus; versendet_am?: string }) =>
      setAntragStatus(antragId, { status, versendet_am }),
    onSuccess: (_, vars) => {
      invalidate()
      qc.invalidateQueries({ queryKey: ['rechnungen'] })
      showToast(`Status: ${STATUS_LABELS[vars.status]}`)
    },
  })

  const updateMut = useMutation({
    mutationFn: (data: UpdateBeihilfeAntrag) => updateAntrag(antragId, data),
    onSuccess: () => {
      invalidate()
      setEditingMeta(false)
      setUpdateError(null)
      showToast('Gespeichert')
    },
    onError: (e: Error) => setUpdateError(e.message),
  })

  const addRechnungMut = useMutation({
    mutationFn: ({ rechnungId, widerspruch }: { rechnungId: string; widerspruch: boolean }) =>
      addRechnung(antragId, rechnungId, widerspruch),
    onSuccess: () => { invalidate(); setAddRechnungError(null) },
    onError: (e: Error) => setAddRechnungError(e.message),
  })

  const removeRechnungMut = useMutation({
    mutationFn: (rechnungId: string) => removeRechnung(antragId, rechnungId),
    onSuccess: invalidate,
  })

  if (isLoading) return <div style={{ padding: 24, fontSize: 13, color: 'var(--text-muted)' }}>Lade…</div>
  if (!antrag) return <div style={{ padding: 24, fontSize: 13, color: 'var(--rose)' }}>Antrag nicht gefunden.</div>

  const isPkv = antrag.typ === 'pkv'
  const stelle = beihilfestellen.find(b => b.id === antrag.beihilfestelle_id)
  const pkv = pkvListe.find(p => p.id === antrag.pkv_id)
  const personMap = Object.fromEntries(personen.map(p => [p.id, p]))
  const corrMap = Object.fromEntries(correspondents.map(c => [c.id, c]))
  const hasWiderspruch = bescheide.some(b => b.typ === 'widerspruchsbescheid')
  const institutionName = isPkv ? (pkv?.name ?? antrag.pkv_versicherer) : stelle?.name
  const status = antrag.status as AntragStatus
  const currentStepIdx = STATUSES.indexOf(status)
  const pct = currentStepIdx / (STATUSES.length - 1) * 100

  // Financial summary
  const matchedRechnungen = antragRechnungen
    .map(ar => rechnungen.find(r => r.id === ar.rechnung_id))
    .filter((r): r is NonNullable<typeof r> => r != null)
  const totalBetrag = matchedRechnungen.reduce((s, r) => s + r.betrag, 0)
  const hasErwartet = matchedRechnungen.some(r => isPkv ? r.pkv_anteil_erwartet != null : r.beihilfe_anteil_erwartet != null)
  const totalErwartet = hasErwartet
    ? matchedRechnungen.reduce((s, r) => s + (isPkv ? (r.pkv_anteil_erwartet ?? 0) : (r.beihilfe_anteil_erwartet ?? 0)), 0)
    : null
  const hasErstattet = matchedRechnungen.some(r => isPkv ? r.pkv_erstattet_betrag != null : r.beihilfe_erstattet_betrag != null)
  const totalErstattet = hasErstattet
    ? matchedRechnungen.reduce((s, r) => s + (isPkv ? (r.pkv_erstattet_betrag ?? 0) : (r.beihilfe_erstattet_betrag ?? 0)), 0)
    : null

  // Rechnungen for adding
  const erlaubtePersonenIds = isPkv ? (pkv?.personen_ids ?? []) : (stelle?.personen_ids ?? [])
  const assignedIds = new Set(antragRechnungen.map(ar => ar.rechnung_id))
  const available = rechnungen.filter(r => {
    if (assignedIds.has(r.id) || r.archiviert_am) return false
    if (erlaubtePersonenIds.length > 0 && !erlaubtePersonenIds.includes(r.person_id)) return false
    return true
  })
  // Already-submitted ones shown separately as Widerspruch candidates
  const freshRechnungen = available.filter(r => isPkv ? r.pkv_eingereicht_am == null : r.beihilfe_eingereicht_am == null)
  const widerspruchRechnungen = available.filter(r => isPkv ? r.pkv_eingereicht_am != null : r.beihilfe_eingereicht_am != null)

  const statusStyle = STATUS_COLORS[status] ?? STATUS_COLORS.entwurf

  const startEditMeta = () => {
    setUpdateError(null)
    setMetaValues({
      titel: antrag.titel ?? '',
      beihilfestelle_id: antrag.beihilfestelle_id || undefined,
      pkv_id: antrag.pkv_id,
      pkv_versicherer: antrag.pkv_versicherer || undefined,
      notiz: antrag.notiz ?? '',
    })
    setEditingMeta(true)
  }

  const handleStepClick = (step: AntragStatus, idx: number) => {
    if (idx <= currentStepIdx) return
    setPendingStep(step)
    setStepDate(new Date().toISOString().slice(0, 10))
  }

  const confirmStep = () => {
    if (!pendingStep) return
    statusMut.mutate({ status: pendingStep, versendet_am: DATE_STEPS.includes(pendingStep) ? stepDate : undefined })
    setPendingStep(null)
  }

  const bescheidTabLabel = isPkv ? 'Abrechnungen' : 'Bescheide'
  const TABS = [
    { key: 'details' as Tab, label: 'Details' },
    { key: 'bescheid' as Tab, label: bescheidTabLabel, count: bescheide.length },
    { key: 'belege' as Tab, label: 'Belege' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Header ── */}
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface-alt)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                background: isPkv ? 'var(--teal-dim)' : 'var(--blue-dim)',
                color: isPkv ? 'var(--teal)' : 'var(--blue)',
                border: isPkv ? '1px solid rgba(0,196,176,.2)' : '1px solid rgba(74,136,245,.2)',
              }}>{isPkv ? 'PKV' : 'BH'}</span>
              <span style={{
                ...statusStyle, fontSize: 9, fontWeight: 700,
                padding: '2px 7px', borderRadius: 20, border: `1px solid ${statusStyle.border}`,
              }}>{STATUS_LABELS[status]}</span>
              {hasWiderspruch && (
                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'var(--rose-dim)', color: 'var(--rose)', border: '1px solid rgba(240,96,112,.2)' }}>
                  Widerspruch
                </span>
              )}
              <span style={{ fontSize: 10, color: 'var(--text-subtle)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                #{String(antrag.referenz_nr).padStart(4, '0')}
              </span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              {antrag.titel ?? <span style={{ color: 'var(--text-subtle)', fontStyle: 'italic', fontWeight: 400, fontSize: 15 }}>Kein Titel</span>}
            </div>
            {institutionName && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{institutionName}</div>
            )}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: 18, lineHeight: 1,
                padding: '4px 6px', borderRadius: 6, flexShrink: 0,
                display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-hi)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >✕</button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--border)',
        background: 'var(--surface-alt)', padding: '0 18px', flexShrink: 0,
      }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5,
              fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
              letterSpacing: '0.02em', transition: 'color 0.15s', whiteSpace: 'nowrap',
            }}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                background: tab === t.key ? 'var(--primary)' : 'var(--surface-hi)',
                color: tab === t.key ? '#fff' : 'var(--text-subtle)',
                borderRadius: 9, padding: '0 5px', minWidth: 16, textAlign: 'center',
              }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Details Tab ── */}
      {tab === 'details' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Financial summary */}
          {totalBetrag > 0 && (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
              background: 'var(--surface-alt)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)',
            }}>
              {[
                { label: 'Gesamt', val: formatEuro(totalBetrag), color: 'var(--text)' },
                { label: isPkv ? 'Erw. PKV' : 'Erw. BH', val: totalErwartet != null ? formatEuro(totalErwartet) : '—', color: 'var(--text-muted)' },
                { label: 'Erstattet', val: totalErstattet != null ? formatEuro(totalErstattet) : '—', color: totalErstattet != null ? 'var(--green)' : 'var(--text-subtle)' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 9, color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{val}</span>
                </div>
              ))}
              {totalErstattet != null && totalErwartet != null && totalErwartet > 0 && (
                <div style={{ gridColumn: '1 / -1', marginTop: 2 }}>
                  <div style={{ height: 3, borderRadius: 2, background: 'var(--surface-hi)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(100, (totalErstattet / totalErwartet) * 100)}%`,
                      height: '100%', borderRadius: 2,
                      background: totalErstattet >= totalErwartet ? 'var(--green)' : 'var(--amber)',
                      transition: 'width .5s ease',
                    }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Workflow Stepper */}
          <div>
            <SectionLabel>Workflow</SectionLabel>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: 13, left: 14, right: 14, height: 2, background: 'var(--border)', borderRadius: 2 }} />
              <div style={{
                position: 'absolute', top: 13, left: 14, height: 2, borderRadius: 2,
                width: `calc((100% - 28px) * ${pct / 100})`,
                background: 'linear-gradient(90deg, var(--green), var(--primary))',
                transition: 'width .5s cubic-bezier(.4,0,.2,1)',
              }} />
              <div style={{ display: 'flex', position: 'relative' }}>
                {STATUSES.map((step, i) => {
                  const isPast = i < currentStepIdx
                  const isCurrent = i === currentStepIdx
                  const isFuture = i > currentStepIdx
                  return (
                    <div
                      key={step}
                      onClick={() => isFuture && handleStepClick(step, i)}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: isFuture ? 'pointer' : 'default' }}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700,
                        background: isCurrent ? 'var(--primary)' : isPast ? 'var(--green)' : 'var(--surface-alt)',
                        color: (isCurrent || isPast) ? '#fff' : 'var(--text-subtle)',
                        border: isFuture ? '2px dashed var(--border-hi)' : 'none',
                        boxShadow: isPast ? '0 2px 8px rgba(0,0,0,.15)' : 'none',
                        transition: 'background .25s',
                      }}>
                        {isPast ? '✓' : i + 1}
                      </div>
                      <span style={{
                        fontSize: 9, textAlign: 'center', fontWeight: isCurrent ? 700 : 400, lineHeight: 1.3,
                        color: isCurrent ? 'var(--primary)' : isPast ? 'var(--green)' : 'var(--text-subtle)',
                      }}>
                        {STATUS_LABELS[step]}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {pendingStep && (
              <div style={{
                marginTop: 12, background: 'var(--bg)', border: '1px solid var(--primary)', borderRadius: 8,
                padding: '12px 14px', boxShadow: '0 0 0 3px var(--primary-dim)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--text)', flex: 1 }}>
                    → <strong style={{ color: 'var(--primary)' }}>{STATUS_LABELS[pendingStep]}</strong>
                  </span>
                  {DATE_STEPS.includes(pendingStep) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {pendingStep === 'versendet' ? 'Sendedatum' : 'Datum'}
                      </span>
                      <input type="date" value={stepDate} onChange={e => setStepDate(e.target.value)}
                        style={{ fontSize: 12, padding: '4px 8px', borderRadius: 5 }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setPendingStep(null)} className="app-btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }}>Abbrechen</button>
                    <button onClick={confirmStep} disabled={statusMut.isPending} className="app-btn-primary" style={{ padding: '4px 12px', fontSize: 11 }}>Bestätigen</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Antrag-Meta */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <SectionLabel>Antrag</SectionLabel>
              {!editingMeta
                ? <button className="app-btn-secondary" style={{ padding: '3px 11px', fontSize: 11 }} onClick={startEditMeta}>Bearbeiten</button>
                : <div style={{ display: 'flex', gap: 6 }}>
                    <button className="app-btn-secondary" style={{ padding: '3px 11px', fontSize: 11 }} onClick={() => { setEditingMeta(false); setUpdateError(null) }}>Abbrechen</button>
                    <button className="app-btn-primary" style={{ padding: '3px 13px', fontSize: 11 }} onClick={() => updateMut.mutate(metaValues)} disabled={updateMut.isPending}>
                      {updateMut.isPending ? '…' : 'Speichern'}
                    </button>
                  </div>
              }
            </div>

            {!editingMeta ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <Row label="Titel" value={antrag.titel} />
                <Row label={isPkv ? 'PKV' : 'Beihilfestelle'} value={institutionName} />
                <Row label="Erstellt" value={new Date(antrag.erstellt_am).toLocaleDateString('de-DE')} />
                <Row label="Notiz" value={antrag.notiz} />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>Titel</div>
                  <input style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6, boxSizing: 'border-box' }}
                    value={metaValues.titel ?? ''}
                    onChange={e => setMetaValues(v => ({ ...v, titel: e.target.value }))}
                  />
                </div>
                {isPkv ? (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>PKV</div>
                    <select style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6 }}
                      value={metaValues.pkv_id ?? ''}
                      onChange={e => setMetaValues(v => ({ ...v, pkv_id: e.target.value || null }))}>
                      <option value="">(keine)</option>
                      {pkvListe.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>Beihilfestelle</div>
                    <select style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6 }}
                      value={metaValues.beihilfestelle_id ?? ''}
                      onChange={e => setMetaValues(v => ({ ...v, beihilfestelle_id: e.target.value || undefined }))}>
                      <option value="">(keine)</option>
                      {beihilfestellen.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }}>Notiz</div>
                  <input style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6, boxSizing: 'border-box' }}
                    value={metaValues.notiz ?? ''}
                    onChange={e => setMetaValues(v => ({ ...v, notiz: e.target.value }))}
                  />
                </div>
                {updateError && (
                  <div style={{ gridColumn: 'span 2', padding: '6px 10px', borderRadius: 5, background: 'var(--rose-dim)', border: '1px solid var(--rose)', fontSize: 12, color: 'var(--rose)' }}>
                    {updateError}
                  </div>
                )}
              </div>
            )}

            {/* Paperless-Link */}
            <div style={{ marginTop: 12 }}>
              {editingPaperlessUrl ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="url" value={paperlessUrlInput}
                    onChange={e => setPaperlessUrlInput(e.target.value)}
                    placeholder="https://paperless.example.com/share/…"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') { updateMut.mutate({ paperless_share_url: paperlessUrlInput || null }); setEditingPaperlessUrl(false) }
                      if (e.key === 'Escape') setEditingPaperlessUrl(false)
                    }}
                    style={{ fontSize: 12, padding: '4px 8px', borderRadius: 5, flex: 1, minWidth: 0 }}
                  />
                  <button onClick={() => { updateMut.mutate({ paperless_share_url: paperlessUrlInput || null }); setEditingPaperlessUrl(false) }}
                    className="app-btn-primary" style={{ fontSize: 11, padding: '4px 10px' }}>OK</button>
                  <button onClick={() => setEditingPaperlessUrl(false)}
                    style={{ fontSize: 14, color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}>×</button>
                </div>
              ) : antrag.paperless_share_url ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <a href={antrag.paperless_share_url} target="_blank" rel="noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
                    ↗ Paperless-Dokument
                  </a>
                  <button onClick={() => { setPaperlessUrlInput(antrag.paperless_share_url ?? ''); setEditingPaperlessUrl(true) }}
                    style={{ fontSize: 11, color: 'var(--text-subtle)', cursor: 'pointer', background: 'none', border: 'none' }}>
                    Ändern
                  </button>
                </div>
              ) : (
                <button onClick={() => { setPaperlessUrlInput(''); setEditingPaperlessUrl(true) }}
                  style={{ fontSize: 11, color: 'var(--text-subtle)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
                  + Paperless-Link
                </button>
              )}
            </div>
          </div>

          {/* Rechnungen */}
          <div>
            <SectionLabel>Rechnungen ({antragRechnungen.length})</SectionLabel>

            {antragRechnungen.map(ar => {
              const r = rechnungen.find(x => x.id === ar.rechnung_id)
              if (!r) return null
              const person = personMap[r.person_id]
              const corr = corrMap[r.leistungserbringer_id]
              return (
                <div key={ar.rechnung_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--row-border)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <button onClick={() => setSliderRechnungId(ar.rechnung_id)}
                        style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        {r.referenz_nr != null ? `R-${String(r.referenz_nr).padStart(4, '0')}` : '—'}
                      </button>
                      {ar.widerspruch && (
                        <span style={{ fontSize: 9, padding: '1px 6px', background: 'var(--amber-dim)', color: 'var(--amber)', borderRadius: 4 }}>
                          Widerspruch
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{person?.name} · {corr?.name}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(r.betrag)}</div>
                  </div>
                  <button
                    onClick={() => removeRechnungMut.mutate(ar.rechnung_id)}
                    disabled={removeRechnungMut.isPending}
                    style={{ fontSize: 16, color: 'var(--text-subtle)', cursor: 'pointer', background: 'none', border: 'none', flexShrink: 0, lineHeight: 1 }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--rose)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-subtle)')}
                  >×</button>
                </div>
              )
            })}

            {erlaubtePersonenIds.length > 0 && (
              <p style={{ fontSize: 11, color: 'var(--text-subtle)', margin: '6px 0 0', fontStyle: 'italic' }}>
                Nur Rechnungen {isPkv ? 'versicherter' : 'berechtigter'} Personen ({erlaubtePersonenIds.map(pid => personMap[pid]?.name).filter(Boolean).join(', ')}).
              </p>
            )}
            {addRechnungError && (
              <div style={{ marginTop: 6, padding: '5px 10px', borderRadius: 5, background: 'var(--rose-dim)', fontSize: 12, color: 'var(--rose)' }}>
                {addRechnungError}
              </div>
            )}
            {(freshRechnungen.length > 0 || widerspruchRechnungen.length > 0) && (
              <select
                style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 12px', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', marginTop: 8 }}
                defaultValue=""
                onChange={e => {
                  const val = e.target.value
                  if (!val) return
                  const isWiderspruch = val.startsWith('w:')
                  const rechnungId = isWiderspruch ? val.slice(2) : val
                  addRechnungMut.mutate({ rechnungId, widerspruch: isWiderspruch })
                  e.target.value = ''
                }}
              >
                <option value="">+ Rechnung hinzufügen…</option>
                {freshRechnungen.map(r => {
                  const person = personMap[r.person_id]
                  const corr = corrMap[r.leistungserbringer_id]
                  return (
                    <option key={r.id} value={r.id}>
                      {r.referenz_nr != null ? `R-${String(r.referenz_nr).padStart(4, '0')}` : '?'} · {formatEuro(r.betrag)} · {person?.name} · {corr?.name}
                    </option>
                  )
                })}
                {widerspruchRechnungen.length > 0 && (
                  <optgroup label="⚠ Bereits eingereicht – wird als Widerspruch hinzugefügt">
                    {widerspruchRechnungen.map(r => {
                      const person = personMap[r.person_id]
                      const corr = corrMap[r.leistungserbringer_id]
                      const submittedAt = isPkv ? r.pkv_eingereicht_am : r.beihilfe_eingereicht_am
                      const dateStr = submittedAt ? new Date(submittedAt).toLocaleDateString('de-DE') : ''
                      return (
                        <option key={r.id} value={`w:${r.id}`}>
                          {r.referenz_nr != null ? `R-${String(r.referenz_nr).padStart(4, '0')}` : '?'} · {formatEuro(r.betrag)} · {person?.name} · {corr?.name} · eingereicht {dateStr}
                        </option>
                      )
                    })}
                  </optgroup>
                )}
              </select>
            )}
            {antragRechnungen.length === 0 && available.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-subtle)', margin: 0 }}>
                {isPkv ? 'Keine Rechnungen ohne PKV-Einreichung vorhanden.' : 'Keine Rechnungen ohne Beihilfe-Einreichung vorhanden.'}
              </p>
            )}
          </div>

          <div style={{ height: 8 }} />
        </div>
      )}

      {/* ── Bescheid/Abrechnung Tab ── */}
      {tab === 'bescheid' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          <BeihilfeBescheidForm
            antragId={antragId}
            antragTyp={antrag.typ}
            bescheide={bescheide}
            antragRechnungen={antragRechnungen}
            rechnungen={rechnungen}
            personMap={personMap}
            onOpenRechnung={setSliderRechnungId}
          />
        </div>
      )}

      {/* ── Belege Tab ── */}
      {tab === 'belege' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          <BelegReferenzListe
            mode="antrag"
            id={antragId}
            antragTyp={antrag.typ as 'beihilfe' | 'pkv'}
            beihilfestelleId={antrag.beihilfestelle_id}
            pkvId={antrag.pkv_id}
            linkedRechnungen={matchedRechnungen.map(r => ({
              id: r.id,
              label: `${r.referenz_nr != null ? `R-${String(r.referenz_nr).padStart(4, '0')}` : '—'} · ${personMap[r.person_id]?.name ?? ''} · ${corrMap[r.leistungserbringer_id]?.name ?? ''}`,
            }))}
          />
        </div>
      )}

      <RechnungDetailSlider
        rechnungId={sliderRechnungId}
        onClose={() => setSliderRechnungId(null)}
        onUpdate={() => {
          qc.invalidateQueries({ queryKey: ['rechnungen'] })
          qc.invalidateQueries({ queryKey: ['antragRechnungen', antragId] })
          qc.invalidateQueries({ queryKey: ['positionen'] })
        }}
      />
    </div>
  )
}
