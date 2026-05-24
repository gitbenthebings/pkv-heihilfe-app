import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query'
import {
  getAntrag, setAntragStatus, getAntragRechnungen, addRechnung, removeRechnung, updateAntrag,
} from '../api/beihilfe_antraege'
import { getBescheide, getPositionen } from '../api/beihilfe_bescheide'
import { getRechnungen } from '../api/rechnungen'
import { getPersonen } from '../api/personen'
import { getCorrespondents } from '../api/correspondents'
import { getBeihilfestellen } from '../api/beihilfestellen'
import { getPkv } from '../api/pkv'
import BeihilfeBescheidForm from './BeihilfeBescheidForm'
import RechnungDetailSlider from './RechnungDetailSlider'
import type { AntragStatus, UpdateBeihilfeAntrag } from '../types'

function formatEuro(eur: number) {
  return eur.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}
function formatCent(cent: number) {
  return (cent / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

const STATUSES: AntragStatus[] = ['entwurf', 'versendet', 'in_bearbeitung', 'beschieden', 'archiviert']
const STATUS_LABELS: Record<AntragStatus, string> = {
  entwurf: 'Entwurf', versendet: 'Versendet', in_bearbeitung: 'In Bearbeitung',
  beschieden: 'Beschieden', archiviert: 'Archiviert',
}
const STATUS_STYLE: Record<AntragStatus, React.CSSProperties> = {
  entwurf:        { background: 'var(--surface-hi)', color: 'var(--text-muted)', border: '1px solid var(--border)' },
  versendet:      { background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(74,136,245,.3)' },
  in_bearbeitung: { background: 'var(--amber-dim)', color: 'var(--amber)', border: '1px solid rgba(232,160,48,.3)' },
  beschieden:     { background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(78,200,122,.3)' },
  archiviert:     { background: 'var(--surface-hi)', color: 'var(--text-subtle)', border: '1px solid var(--border)' },
}
const DATE_STEPS: AntragStatus[] = ['versendet', 'in_bearbeitung']

// ── Toast ─────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }: { msg: string; type: 'success' | 'error' | 'info'; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800)
    return () => clearTimeout(t)
  }, [onDone])

  const color = type === 'success' ? 'var(--green)' : type === 'error' ? 'var(--rose)' : 'var(--primary)'
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 200,
      background: 'var(--surface)', border: `1px solid ${color}`, borderRadius: 12,
      padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: `0 8px 32px rgba(0,0,0,.35), 0 0 0 1px ${color}`,
      animation: 'toast-in .25s ease both',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{type === 'success' ? '✓' : '!'}</span>
      </div>
      <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{msg}</span>
    </div>
  )
}

interface Props {
  antragId: string
  onBack?: () => void
}

export default function BeihilfeAntragDetail({ antragId, onBack }: Props) {
  const qc = useQueryClient()

  const [sliderRechnungId, setSliderRechnungId] = useState<string | null>(null)
  const [editingMeta, setEditingMeta] = useState(false)
  const [metaValues, setMetaValues] = useState<UpdateBeihilfeAntrag>({})
  const [editingPaperlessUrl, setEditingPaperlessUrl] = useState(false)
  const [paperlessUrlInput, setPaperlessUrlInput] = useState('')
  const [pendingStep, setPendingStep] = useState<AntragStatus | null>(null)
  const [stepDate, setStepDate] = useState(new Date().toISOString().slice(0, 10))
  const [addRechnungError, setAddRechnungError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => setToast({ msg, type })

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
  const positionenResults = useQueries({
    queries: bescheide.map(b => ({
      queryKey: ['positionen', b.id],
      queryFn: () => getPositionen(antragId, b.id),
    })),
  })
  const positionenLoaded = bescheide.length === 0 || positionenResults.every(r => !r.isLoading)
  const rechnungenMitPosition = new Set(
    positionenResults.flatMap(r => r.data ?? []).map(p => p.rechnung_id)
  )
  const allPositionen = positionenResults.flatMap(r => r.data ?? [])

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
      showToast(`Status: ${STATUS_LABELS[vars.status]}`, 'success')
    },
  })

  const [updateError, setUpdateError] = useState<string | null>(null)
  const updateMut = useMutation({
    mutationFn: (data: UpdateBeihilfeAntrag) => updateAntrag(antragId, data),
    onSuccess: () => {
      invalidate()
      setEditingMeta(false)
      setUpdateError(null)
      showToast('Gespeichert', 'success')
    },
    onError: (e: Error) => setUpdateError(e.message),
  })

  const addRechnungMut = useMutation({
    mutationFn: (rechnungId: string) => addRechnung(antragId, rechnungId),
    onSuccess: () => { invalidate(); setAddRechnungError(null) },
    onError: (e: Error) => setAddRechnungError(e.message),
  })

  const removeRechnungMut = useMutation({
    mutationFn: (rechnungId: string) => removeRechnung(antragId, rechnungId),
    onSuccess: invalidate,
  })

  if (isLoading) return <p style={{ padding: 24, fontSize: 13, color: 'var(--text-muted)' }}>Lade…</p>
  if (!antrag) return <p style={{ padding: 24, fontSize: 13, color: 'var(--rose)' }}>Antrag nicht gefunden.</p>

  const isPkv = antrag.typ === 'pkv'
  const stelle = beihilfestellen.find(b => b.id === antrag.beihilfestelle_id)
  const pkv = pkvListe.find(p => p.id === antrag.pkv_id)
  const personMap = Object.fromEntries(personen.map(p => [p.id, p]))
  const corrMap = Object.fromEntries(correspondents.map(c => [c.id, c]))
  const hasWiderspruch = bescheide.some(b => b.typ === 'widerspruchsbescheid')

  const assignedIds = new Set(antragRechnungen.map(ar => ar.rechnung_id))
  const erlaubtePersonenIds = isPkv ? (pkv?.personen_ids ?? []) : (stelle?.personen_ids ?? [])
  const unassigned = rechnungen.filter(r => {
    if (assignedIds.has(r.id) || r.archiviert_am) return false
    if (isPkv) {
      if (r.pkv_eingereicht_am != null) return false
      if (erlaubtePersonenIds.length > 0 && !erlaubtePersonenIds.includes(r.person_id)) return false
    } else {
      if (r.beihilfe_eingereicht_am != null) return false
      if (erlaubtePersonenIds.length > 0 && !erlaubtePersonenIds.includes(r.person_id)) return false
    }
    return true
  })

  const currentStepIdx = STATUSES.indexOf(antrag.status as AntragStatus)
  const pct = STATUSES.length > 1 ? currentStepIdx / (STATUSES.length - 1) * 100 : 0

  const totalBetrag = antragRechnungen.reduce((sum, ar) => {
    const r = rechnungen.find(x => x.id === ar.rechnung_id)
    return sum + (r?.betrag ?? 0)
  }, 0)

  // Financial flow: positionen are in Cent
  const totalApproved = allPositionen.reduce((s, p) => s + (p.anerkannt_betrag ?? 0), 0)
  const totalRejected = allPositionen.reduce((s, p) => s + (p.abgelehnt_betrag ?? 0), 0)
  const hasBescheid = bescheide.length > 0 && positionenLoaded
  const approvedEuro = totalApproved / 100
  const rejectedEuro = totalRejected / 100
  const appPct = hasBescheid && totalBetrag > 0 ? Math.min(1, approvedEuro / totalBetrag) : null

  const startEditMeta = () => {
    setUpdateError(null)
    setMetaValues({
      titel: antrag.titel ?? '',
      beihilfestelle_id: antrag.beihilfestelle_id || undefined,
      pkv_id: antrag.pkv_id,
      pkv_versicherer: antrag.pkv_versicherer || undefined,
      notiz: antrag.notiz ?? '',
      paperless_share_url: antrag.paperless_share_url,
    })
    setEditingMeta(true)
  }

  const savePaperlessUrl = () => {
    updateMut.mutate({ paperless_share_url: paperlessUrlInput || null })
    setEditingPaperlessUrl(false)
  }

  const handleStepClick = (step: AntragStatus, idx: number) => {
    if (idx <= currentStepIdx) return
    setPendingStep(step)
    setStepDate(new Date().toISOString().slice(0, 10))
  }

  const confirmStep = () => {
    if (!pendingStep) return
    const needsDate = DATE_STEPS.includes(pendingStep)
    statusMut.mutate({ status: pendingStep, versendet_am: needsDate ? stepDate : undefined })
    setPendingStep(null)
  }

  const institutionName = isPkv ? (pkv?.name ?? antrag.pkv_versicherer) : stelle?.name

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: 'slide-in .22s ease' }}>

      {/* ── Fixed header ── */}
      <div style={{
        padding: '20px 28px 18px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0,
      }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none', padding: 0, marginBottom: 10, display: 'block' }}
          >
            ← Alle Anträge
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Badges row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: isPkv ? 'var(--teal-dim)' : 'var(--blue-dim)',
                color: isPkv ? 'var(--teal)' : 'var(--blue)',
                border: isPkv ? '1px solid rgba(0,196,176,.2)' : '1px solid rgba(74,136,245,.2)',
              }}>
                {isPkv ? 'PKV' : 'BH'}
              </span>
              <span style={{ ...STATUS_STYLE[antrag.status as AntragStatus], fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                {STATUS_LABELS[antrag.status as AntragStatus]}
              </span>
              {hasWiderspruch && (
                <span style={{ background: 'var(--rose-dim)', color: 'var(--rose)', border: '1px solid rgba(240,96,112,.2)', fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                  Widerspruch
                </span>
              )}
              <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontWeight: 600 }}>
                #{String(antrag.referenz_nr).padStart(4, '0')}
              </span>
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.02em', marginBottom: 3 }}>
              {antrag.titel ?? (
                <span style={{ color: 'var(--text-subtle)', fontStyle: 'italic', fontWeight: 400, fontSize: 19 }}>Kein Titel</span>
              )}
            </h2>
            {institutionName && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{institutionName}</div>}
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: 'var(--text-subtle)', fontWeight: 700, letterSpacing: '.07em', marginBottom: 4 }}>GESAMT</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-.025em', fontVariantNumeric: 'tabular-nums' }}>
              {formatEuro(totalBetrag)}
            </div>
          </div>
        </div>

        {/* Financial flow visualization */}
        {hasBescheid && appPct !== null && (
          <div style={{ background: 'var(--surface-alt)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 9, color: 'var(--text-subtle)', fontWeight: 700, letterSpacing: '.06em' }}>EINGEREICHT</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(totalBetrag)}</div>
              </div>
              <span style={{ color: 'var(--border-hi)', fontSize: 16 }}>→</span>
              <div>
                <div style={{ fontSize: 9, color: 'var(--green)', fontWeight: 700, letterSpacing: '.06em' }}>ERSTATTET</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>{formatCent(totalApproved)}</div>
              </div>
              {rejectedEuro > 0.01 && (
                <>
                  <span style={{ color: 'var(--border-hi)', fontSize: 12 }}>·</span>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--rose)', fontWeight: 700, letterSpacing: '.06em' }}>ABGELEHNT</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--rose)', fontVariantNumeric: 'tabular-nums' }}>{formatCent(totalRejected)}</div>
                  </div>
                </>
              )}
              <div style={{ flex: 1, minWidth: 80 }}>
                <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--rose-dim)', marginBottom: 4 }}>
                  <div style={{ width: `${appPct * 100}%`, height: '100%', background: 'var(--green)', borderRadius: 4, transition: 'width .5s ease' }} />
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-subtle)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(appPct * 100)} % Erstattungsquote
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Paperless link */}
        {editingPaperlessUrl ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="url" value={paperlessUrlInput}
              onChange={e => setPaperlessUrlInput(e.target.value)}
              placeholder="https://paperless.example.com/share/…"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') savePaperlessUrl(); if (e.key === 'Escape') setEditingPaperlessUrl(false) }}
              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 5, flex: 1, minWidth: 0 }}
            />
            <button onClick={savePaperlessUrl} className="app-btn-primary" style={{ fontSize: 11, padding: '4px 10px' }}>Speichern</button>
            <button onClick={() => setEditingPaperlessUrl(false)} style={{ fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}>×</button>
          </div>
        ) : antrag.paperless_share_url ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a
              href={antrag.paperless_share_url} target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}
            >
              ↗ Paperless-Dokument
            </a>
            <button
              onClick={() => { setPaperlessUrlInput(antrag.paperless_share_url ?? ''); setEditingPaperlessUrl(true) }}
              style={{ fontSize: 11, color: 'var(--text-subtle)', cursor: 'pointer', background: 'none', border: 'none', padding: '2px 4px' }}
            >
              Ändern
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setPaperlessUrlInput(''); setEditingPaperlessUrl(true) }}
            style={{ fontSize: 11, color: 'var(--text-subtle)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
          >
            + Paperless-Link
          </button>
        )}
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Workflow Stepper ── */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '.09em', marginBottom: 20 }}>WORKFLOW</div>

          <div style={{ position: 'relative' }}>
            {/* Track background */}
            <div style={{ position: 'absolute', top: 15, left: 16, right: 16, height: 2, background: 'var(--border)', borderRadius: 2, zIndex: 0 }} />
            {/* Progress fill */}
            <div style={{
              position: 'absolute', top: 15, left: 16, height: 2, borderRadius: 2, zIndex: 0,
              width: `calc((100% - 32px) * ${pct / 100})`,
              background: 'linear-gradient(90deg, var(--green), var(--primary))',
              transition: 'width .5s cubic-bezier(.4,0,.2,1)',
            }} />

            <div style={{ display: 'flex', position: 'relative', zIndex: 1 }}>
              {STATUSES.map((step, i) => {
                const isPast = i < currentStepIdx
                const isCurrent = i === currentStepIdx
                const isFuture = i > currentStepIdx
                return (
                  <div
                    key={step}
                    onClick={() => isFuture && handleStepClick(step, i)}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: isFuture ? 'pointer' : 'default' }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700,
                      background: isCurrent ? 'var(--primary)' : isPast ? 'var(--green)' : 'var(--surface-alt)',
                      color: (isCurrent || isPast) ? '#fff' : 'var(--text-subtle)',
                      border: isFuture ? '2px dashed var(--border-hi)' : 'none',
                      animation: isCurrent ? 'pulse-glow 2.5s ease-in-out infinite' : 'none',
                      boxShadow: isPast ? '0 2px 8px rgba(0,0,0,.15)' : 'none',
                      transition: 'background .25s, box-shadow .25s',
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

          {/* Confirm panel */}
          {pendingStep && (
            <div style={{
              marginTop: 16, background: 'var(--bg)', border: '1px solid var(--primary)', borderRadius: 10,
              padding: '14px 16px', animation: 'fade-in .18s ease', boxShadow: '0 0 0 3px var(--primary-dim)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)' }} />
                  <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                    Status → <strong style={{ color: 'var(--primary)' }}>{STATUS_LABELS[pendingStep]}</strong>
                  </span>
                </div>
                {DATE_STEPS.includes(pendingStep) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {pendingStep === 'versendet' ? 'Sendedatum' : 'Datum'}
                    </span>
                    <input
                      type="date" value={stepDate}
                      onChange={e => setStepDate(e.target.value)}
                      style={{ fontSize: 12, padding: '5px 9px', borderRadius: 6 }}
                    />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 7 }}>
                  <button onClick={() => setPendingStep(null)} className="app-btn-secondary" style={{ padding: '5px 12px', fontSize: 11 }}>Abbrechen</button>
                  <button onClick={confirmStep} disabled={statusMut.isPending} className="app-btn-primary" style={{ padding: '5px 16px', fontSize: 11 }}>Bestätigen</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Meta section ── */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '.09em' }}>METADATEN</div>
            {!editingMeta
              ? <button className="app-btn-secondary" style={{ padding: '3px 11px', fontSize: 11 }} onClick={startEditMeta}>Bearbeiten</button>
              : <div style={{ display: 'flex', gap: 7 }}>
                  <button className="app-btn-secondary" style={{ padding: '3px 11px', fontSize: 11 }} onClick={() => { setEditingMeta(false); setUpdateError(null) }}>Abbrechen</button>
                  <button className="app-btn-primary" style={{ padding: '3px 13px', fontSize: 11 }} onClick={() => updateMut.mutate(metaValues)} disabled={updateMut.isPending}>
                    {updateMut.isPending ? '…' : 'Speichern'}
                  </button>
                </div>
            }
          </div>

          {editingMeta ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, animation: 'fade-in .15s ease' }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '.06em', marginBottom: 5 }}>TITEL</div>
                <input
                  style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6 }}
                  placeholder="z. B. Q1 2026 Kinder"
                  value={metaValues.titel ?? ''}
                  onChange={e => setMetaValues(v => ({ ...v, titel: e.target.value }))}
                />
              </div>
              {isPkv ? (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '.06em', marginBottom: 5 }}>PKV</div>
                  <select
                    style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6 }}
                    value={metaValues.pkv_id ?? ''}
                    onChange={e => setMetaValues(v => ({ ...v, pkv_id: e.target.value || null }))}
                  >
                    <option value="">(keine)</option>
                    {pkvListe.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '.06em', marginBottom: 5 }}>BEIHILFESTELLE</div>
                  <select
                    style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6 }}
                    value={metaValues.beihilfestelle_id ?? ''}
                    onChange={e => setMetaValues(v => ({ ...v, beihilfestelle_id: e.target.value || undefined }))}
                  >
                    <option value="">(keine)</option>
                    {beihilfestellen.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              <div style={{ gridColumn: 'span 2' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '.06em', marginBottom: 5 }}>NOTIZ</div>
                <input
                  style={{ width: '100%', padding: '6px 10px', fontSize: 12, borderRadius: 6 }}
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
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: 'TITEL', value: antrag.titel },
                { label: isPkv ? 'PKV' : 'BEIHILFESTELLE', value: institutionName },
                { label: 'NOTIZ', value: antrag.notiz },
                { label: 'ERSTELLT', value: new Date(antrag.erstellt_am).toLocaleDateString('de-DE') },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '.06em', marginBottom: 5 }}>{label}</div>
                  <div style={{ fontSize: 13, color: value ? 'var(--text)' : 'var(--text-subtle)', fontStyle: value ? 'normal' : 'italic', lineHeight: 1.4 }}>
                    {value ?? '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Rechnungen section ── */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '.09em', marginBottom: 3 }}>RECHNUNGEN</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {antragRechnungen.length} Pos. ·{' '}
                <strong style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(totalBetrag)}</strong>
              </div>
            </div>
          </div>

          {antragRechnungen.map(ar => {
            const r = rechnungen.find(x => x.id === ar.rechnung_id)
            if (!r) return null
            const person = personMap[r.person_id]
            const corr = corrMap[r.leistungserbringer_id]
            const hasBescheidPos = rechnungenMitPosition.has(ar.rechnung_id)
            return (
              <div key={ar.rechnung_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: '1px solid var(--row-border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                    <button
                      onClick={() => setSliderRechnungId(ar.rechnung_id)}
                      style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      {r.referenz_nr != null ? `R-${String(r.referenz_nr).padStart(4, '0')}` : '—'}
                    </button>
                    {positionenLoaded && bescheide.length > 0 && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
                        background: hasBescheidPos ? 'var(--green-dim)' : 'var(--surface-alt)',
                        color: hasBescheidPos ? 'var(--green)' : 'var(--text-subtle)',
                        border: `1px solid ${hasBescheidPos ? 'rgba(78,200,122,.2)' : 'var(--border)'}`,
                      }}>
                        {hasBescheidPos ? 'Bescheid' : '—'}
                      </span>
                    )}
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
                  <div style={{ fontSize: 9, color: 'var(--text-subtle)' }}>{r.typ}</div>
                </div>
                <button
                  onClick={() => removeRechnungMut.mutate(ar.rechnung_id)}
                  disabled={removeRechnungMut.isPending}
                  style={{ fontSize: 16, color: 'var(--rose)', cursor: 'pointer', background: 'none', border: 'none', opacity: .7, lineHeight: 1, flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>
            )
          })}

          {erlaubtePersonenIds.length > 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 8, fontStyle: 'italic' }}>
              Nur Rechnungen {isPkv ? 'versicherter' : 'berechtigter'} Personen ({erlaubtePersonenIds.map(pid => personMap[pid]?.name).filter(Boolean).join(', ')}) können hinzugefügt werden.
            </p>
          )}
          {addRechnungError && (
            <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 5, background: 'var(--rose-dim)', border: '1px solid var(--rose)', fontSize: 12, color: 'var(--rose)' }}>
              {addRechnungError}
            </div>
          )}
          {unassigned.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <select
                style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 12px', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}
                defaultValue=""
                onChange={e => { if (e.target.value) { addRechnungMut.mutate(e.target.value); e.target.value = '' } }}
              >
                <option value="">+ Rechnung hinzufügen…</option>
                {unassigned.map(r => {
                  const person = personMap[r.person_id]
                  const corr = corrMap[r.leistungserbringer_id]
                  return (
                    <option key={r.id} value={r.id}>
                      {r.referenz_nr != null ? `R-${String(r.referenz_nr).padStart(4, '0')}` : '?'} · {formatEuro(r.betrag)} · {person?.name} · {corr?.name}
                    </option>
                  )
                })}
              </select>
            </div>
          )}

          {antragRechnungen.length === 0 && unassigned.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-subtle)', marginTop: 8 }}>
              {isPkv ? 'Keine Rechnungen ohne PKV-Einreichung vorhanden.' : 'Keine Rechnungen ohne Beihilfe-Einreichung vorhanden.'}
            </p>
          )}
        </div>

        {/* ── Bescheide section ── */}
        <BeihilfeBescheidForm
          antragId={antragId}
          antragTyp={antrag.typ}
          bescheide={bescheide}
          antragRechnungen={antragRechnungen}
          rechnungen={rechnungen}
          personMap={personMap}
          onOpenRechnung={setSliderRechnungId}
        />

        <div style={{ height: 20 }} />
      </div>

      <RechnungDetailSlider
        rechnungId={sliderRechnungId}
        onClose={() => setSliderRechnungId(null)}
        onUpdate={() => {
          qc.invalidateQueries({ queryKey: ['rechnungen'] })
          qc.invalidateQueries({ queryKey: ['antragRechnungen', antragId] })
          qc.invalidateQueries({ queryKey: ['positionen'] })
        }}
      />

      {toast && (
        <Toast
          key={toast.msg + Date.now()}
          msg={toast.msg}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  )
}
