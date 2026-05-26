import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Copy } from 'lucide-react'
import { getRechnungen, updateRechnung } from '../api/rechnungen'
import { getAktivitaet } from '../api/aktivitaet'
import { getAntraege } from '../api/beihilfe_antraege'
import { getPersonen } from '../api/personen'
import { getCorrespondents } from '../api/correspondents'
import AnhangUpload from './AnhangUpload'
import AktivitaetsLog from './AktivitaetsLog'
import type { Rechnung, UpdateRechnung, Person, Correspondent } from '../types'

interface Props {
  rechnungId: string | null
  onClose: () => void
  onUpdate?: () => void
  onKopieren?: (r: Rechnung) => void
}

function formatEuro(betrag: number) {
  return betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function formatDate(d: string | null | undefined) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('de-DE')
}

function formatReferenz(nr: number | null) {
  if (nr === null) return '—'
  return `R-${String(nr).padStart(4, '0')}`
}

// ─── Antrag-Status-Badge ──────────────────────────────────────────────────────

const ANTRAG_STATUS_LABELS: Record<string, string> = {
  entwurf:       'Entwurf',
  versendet:     'Versendet',
  in_bearbeitung:'In Bearbeitung',
  beschieden:    'Beschieden',
  archiviert:    'Archiviert',
}

function AntragStatusBadge({ status }: { status: string }) {
  const styleMap: Record<string, React.CSSProperties> = {
    entwurf:       { background: 'var(--surface-hi)', color: 'var(--text-muted)', border: '1px solid var(--border)' },
    versendet:     { background: 'var(--blue-dim)',   color: 'var(--blue)',       border: '1px solid rgba(43,92,232,0.25)' },
    in_bearbeitung:{ background: 'var(--amber-dim)',  color: 'var(--amber)',      border: '1px solid rgba(200,120,32,0.25)' },
    beschieden:    { background: 'var(--green-dim)',  color: 'var(--green)',      border: '1px solid rgba(26,158,88,0.25)' },
    archiviert:    { background: 'var(--surface-hi)', color: 'var(--text-subtle)',border: '1px solid var(--border)' },
  }
  const s = styleMap[status] ?? styleMap.entwurf
  return (
    <span style={{ ...s, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
      {ANTRAG_STATUS_LABELS[status] ?? status}
    </span>
  )
}

// ─── Field / Label helper ─────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const INP: React.CSSProperties = {
  fontSize: 13,
  padding: '7px 10px',
  borderRadius: 6,
  width: '100%',
  boxSizing: 'border-box',
}

// ─── Edit Form ────────────────────────────────────────────────────────────────

function EditForm({
  rechnung, personen, correspondents, onSave, onCancel,
}: {
  rechnung: Rechnung
  personen: Person[]
  correspondents: Correspondent[]
  onSave: (data: UpdateRechnung) => Promise<void>
  onCancel: () => void
}) {
  const [values, setValues] = useState<UpdateRechnung>({
    person_id:               rechnung.person_id,
    leistungserbringer_id:   rechnung.leistungserbringer_id,
    typ:                     rechnung.typ,
    betrag:                  rechnung.betrag,
    datum:                   rechnung.datum,
    zahlungsziel:            rechnung.zahlungsziel ?? '',
    bezahlt_am:              rechnung.bezahlt_am ?? '',
    pkv_eingereicht_am:      rechnung.pkv_eingereicht_am ?? '',
    notiz:                   rechnung.notiz ?? '',
    pkv_erstattet_betrag:    rechnung.pkv_erstattet_betrag,
    pkv_verzicht:            rechnung.pkv_verzicht,
  })
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof UpdateRechnung>(k: K, v: UpdateRechnung[K]) =>
    setValues(prev => ({ ...prev, [k]: v }))

  return (
    <>
      {/* Scrollable form body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Person + Typ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Person">
            <select style={INP} value={values.person_id ?? ''}
              onChange={e => set('person_id', e.target.value)}>
              {personen.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Typ">
            <select style={INP} value={values.typ ?? ''}
              onChange={e => set('typ', e.target.value)}>
              <option value="arzt">Arzt</option>
              <option value="apotheke">Apotheke</option>
              <option value="krankenhaus">Krankenhaus</option>
            </select>
          </Field>
        </div>

        {/* Leistungserbringer */}
        <Field label="Leistungserbringer">
          <select style={INP} value={values.leistungserbringer_id ?? ''}
            onChange={e => set('leistungserbringer_id', e.target.value)}>
            {correspondents.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>

        {/* Datum + Betrag */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Datum">
            <input type="date" style={INP} value={values.datum ?? ''}
              onChange={e => set('datum', e.target.value)} />
          </Field>
          <Field label="Betrag (€)">
            <input type="number" step="0.01" style={INP} value={values.betrag ?? ''}
              onChange={e => set('betrag', parseFloat(e.target.value) || 0)} />
          </Field>
        </div>

        {/* Zahlungsziel + Bezahlt am */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Zahlungsziel">
            <input type="date" style={INP} value={values.zahlungsziel ?? ''}
              onChange={e => set('zahlungsziel', e.target.value)} />
          </Field>
          <Field label="Bezahlt am">
            <input type="date" style={INP} value={values.bezahlt_am ?? ''}
              onChange={e => set('bezahlt_am', e.target.value)} />
          </Field>
        </div>

        <div style={{ borderTop: '1px solid var(--border)' }} />

        {/* Beihilfe + PKV eingereicht */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Beihilfe eingereicht">
            <div style={{ ...INP, background: 'var(--surface-alt)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {rechnung.beihilfe_eingereicht_am ? formatDate(rechnung.beihilfe_eingereicht_am) : '—'}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-subtle)', flexShrink: 0 }}>aus Antrag</span>
            </div>
          </Field>
          <Field label="PKV eingereicht">
            <input type="date" style={INP} value={values.pkv_eingereicht_am ?? ''}
              onChange={e => set('pkv_eingereicht_am', e.target.value)} />
          </Field>
        </div>

        {/* BH erstattet (read-only, aus Bescheid-Positionen) + PKV erstattet */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="BH erstattet (€)">
            <div style={{ ...INP, background: 'var(--surface-alt)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {rechnung.beihilfe_erstattet_betrag != null
                  ? rechnung.beihilfe_erstattet_betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
                  : '—'}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-subtle)', flexShrink: 0 }}>aus Bescheid</span>
            </div>
          </Field>
          <Field label="PKV erstattet (€)">
            <input type="number" step="0.01" placeholder="—" style={INP}
              value={values.pkv_erstattet_betrag ?? ''}
              onChange={e => {
                const s = e.target.value
                set('pkv_erstattet_betrag', s === '' ? null : parseFloat(s) || 0)
              }} />
          </Field>
        </div>

        <div style={{ borderTop: '1px solid var(--border)' }} />

        {/* Notiz */}
        <Field label="Notiz">
          <input type="text" style={INP} value={values.notiz ?? ''}
            onChange={e => set('notiz', e.target.value)} />
        </Field>

        {/* PKV-Verzicht */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={values.pkv_verzicht ?? false}
            onChange={e => set('pkv_verzicht', e.target.checked)} />
          PKV-Einreichung zurückgestellt
        </label>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--surface-alt)', display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={async () => { setSaving(true); try { await onSave(values) } finally { setSaving(false) } }}
          disabled={saving}
          style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Speichern…' : 'Speichern'}
        </button>
        <button onClick={onCancel}
          style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
        >
          Abbrechen
        </button>
      </div>
    </>
  )
}

// ─── Read View ────────────────────────────────────────────────────────────────

function ReadView({ rechnung, personen, correspondents, onEdit }: {
  rechnung: Rechnung
  personen: Person[]
  correspondents: Correspondent[]
  onEdit: () => void
}) {
  const person = personen.find(p => p.id === rechnung.person_id)
  const corr   = correspondents.find(c => c.id === rechnung.leistungserbringer_id)

  const Row = ({ label, value }: { label: string; value?: string | null }) =>
    value ? (
      <div style={{ display: 'flex', gap: 8, fontSize: 13, padding: '3px 0' }}>
        <span style={{ color: 'var(--text-muted)', width: 148, flexShrink: 0 }}>{label}</span>
        <span style={{ color: 'var(--text)' }}>{value}</span>
      </div>
    ) : null

  const erwartetBH = rechnung.beihilfe_anteil_erwartet
  const tatsaechlichBH = rechnung.beihilfe_erstattet_betrag
  const tatsaechlichPKV = rechnung.pkv_erstattet_betrag
  const differenzBH = tatsaechlichBH !== null && erwartetBH !== null ? tatsaechlichBH - erwartetBH : null
  const eigenanteil =
    tatsaechlichPKV !== null && (tatsaechlichBH !== null || !person?.beihilfestelle_id)
      ? rechnung.betrag - (tatsaechlichBH ?? 0) - tatsaechlichPKV
      : null

  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 2 }}>

        {/* Finanzzeile */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12, background: 'var(--surface-alt)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
          {[
            { label: 'Betrag', val: formatEuro(rechnung.betrag), color: 'var(--text)' },
            { label: 'Erwartet (BH)', val: erwartetBH != null ? formatEuro(erwartetBH) : '—', color: 'var(--text-muted)' },
            { label: 'Tatsächlich (BH)', val: tatsaechlichBH != null ? formatEuro(tatsaechlichBH) : '—', color: 'var(--text-muted)' },
            { label: 'Eigenanteil', val: eigenanteil != null ? formatEuro(eigenanteil) : '—', color: eigenanteil != null ? 'var(--text)' : 'var(--text-subtle)' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 9, color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{val}</span>
            </div>
          ))}
          {differenzBH !== null && (
            <div style={{ gridColumn: '3', marginTop: 2 }}>
              <span style={{ fontSize: 10, color: differenzBH >= 0 ? 'var(--green)' : 'var(--rose)', fontVariantNumeric: 'tabular-nums' }}>
                {differenzBH >= 0 ? '+' : ''}{formatEuro(differenzBH)}
              </span>
            </div>
          )}
        </div>

        <Row label="Person"           value={person?.name} />
        <Row label="Typ"              value={rechnung.typ.charAt(0).toUpperCase() + rechnung.typ.slice(1)} />
        <Row label="Leistungserbringer" value={corr?.name} />
        <Row label="Datum"            value={formatDate(rechnung.datum)} />
        <Row label="Betrag"           value={formatEuro(rechnung.betrag)} />
        <Row label="Zahlungsziel"     value={formatDate(rechnung.zahlungsziel)} />
        <Row label="Bezahlt am"       value={formatDate(rechnung.bezahlt_am)} />
        <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />
        <Row label="Beihilfe eingereicht" value={formatDate(rechnung.beihilfe_eingereicht_am)} />
        <Row label="BH erstattet"     value={tatsaechlichBH != null ? formatEuro(tatsaechlichBH) : undefined} />
        <Row label="PKV eingereicht"  value={formatDate(rechnung.pkv_eingereicht_am)} />
        <Row label="PKV erstattet"    value={tatsaechlichPKV != null ? formatEuro(tatsaechlichPKV) : undefined} />
        {rechnung.pkv_verzicht && (
          <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 4 }}>PKV-Einreichung zurückgestellt</div>
        )}
        {rechnung.notiz && (
          <>
            <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />
            <Row label="Notiz" value={rechnung.notiz} />
          </>
        )}
      </div>
      <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--surface-alt)', flexShrink: 0 }}>
        <button onClick={onEdit}
          style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Bearbeiten
        </button>
      </div>
    </>
  )
}

// ─── Main Slider ──────────────────────────────────────────────────────────────

type Tab = 'details' | 'anhaenge' | 'antraege' | 'aktivitaet'

export default function RechnungDetailSlider({ rechnungId, onClose, onUpdate, onKopieren }: Props) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const overlayRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<Tab>('details')
  const [editing, setEditing] = useState(true)

  const { data: rechnungen = [] } = useQuery({ queryKey: ['rechnungen'], queryFn: () => getRechnungen() })
  const { data: personen    = [] } = useQuery({ queryKey: ['personen'],    queryFn: getPersonen })
  const { data: correspondents = [] } = useQuery({ queryKey: ['correspondents'], queryFn: getCorrespondents })

  const { data: aktivitaeten = [], isLoading: loadingAkt } = useQuery({
    queryKey: ['aktivitaet', rechnungId],
    queryFn:  () => getAktivitaet(rechnungId!),
    enabled:  !!rechnungId && tab === 'aktivitaet',
  })

  const { data: zugehoerige_antraege = [] } = useQuery({
    queryKey: ['antraege', 'fuer-rechnung', rechnungId],
    queryFn:  () => getAntraege(undefined, rechnungId!),
    enabled:  !!rechnungId && tab === 'antraege',
  })

  const rechnung = rechnungen.find(r => r.id === rechnungId) ?? null

  const updateMut = useMutation({
    mutationFn: (data: UpdateRechnung) => updateRechnung(rechnungId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rechnungen'] })
      qc.invalidateQueries({ queryKey: ['aktivitaet', rechnungId] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setEditing(false)
      onUpdate?.()
    },
  })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    setTab('details')
    setEditing(true)
  }, [rechnungId])

  if (!rechnungId) return null

  const TABS: { key: Tab; label: string }[] = [
    { key: 'details',   label: 'Details' },
    { key: 'anhaenge',  label: 'Anhänge' },
    { key: 'antraege',  label: 'Anträge' },
    { key: 'aktivitaet',label: 'Protokoll' },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.35)' }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed',
        inset: '0 0 0 auto',
        zIndex: 50,
        width: '100%',
        maxWidth: 440,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.25)',
      }}>

        {/* Panel Header */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-alt)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}>
          {rechnung ? (
            <>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                {formatReferenz(rechnung.referenz_nr)}
              </span>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.03em', flex: 1 }}>
                {formatEuro(rechnung.betrag)}
              </span>
            </>
          ) : (
            <span style={{ flex: 1, color: 'var(--text-subtle)', fontSize: 13 }}>Lade…</span>
          )}
          {rechnung && onKopieren && (
            <button
              onClick={() => onKopieren(rechnung)}
              title="Ähnliche Rechnung anlegen"
              aria-label="Kopieren"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: '4px 6px', borderRadius: 6,
                display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-hi)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}
            >
              <Copy className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Schließen"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 18, lineHeight: 1,
              padding: '4px 6px', borderRadius: 6,
              display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-hi)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}
          >✕</button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-alt)',
          padding: '0 18px',
          flexShrink: 0,
        }}>
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 14px',
                fontSize: 12,
                fontWeight: tab === key ? 600 : 400,
                color: tab === key ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent',
                letterSpacing: '0.02em',
                transition: 'color 0.15s',
                whiteSpace: 'nowrap',
              }}
            >{label}</button>
          ))}
        </div>

        {/* Content */}
        {!rechnung ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-subtle)', fontSize: 13 }}>
            Rechnung nicht gefunden.
          </div>
        ) : tab === 'details' ? (
          editing ? (
            <EditForm
              rechnung={rechnung}
              personen={personen}
              correspondents={correspondents}
              onSave={(data) => updateMut.mutateAsync(data).then(() => {})}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <ReadView
              rechnung={rechnung}
              personen={personen}
              correspondents={correspondents}
              onEdit={() => setEditing(true)}
            />
          )
        ) : tab === 'anhaenge' ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
            <AnhangUpload rechnungId={rechnung.id} referenzNr={rechnung.referenz_nr} />
          </div>
        ) : tab === 'antraege' ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
            {zugehoerige_antraege.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-subtle)' }}>
                Diese Rechnung ist keinem Antrag zugeordnet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {zugehoerige_antraege.map(a => (
                  <div key={a.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', background: 'var(--surface)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                        Antrag #{a.referenz_nr}{a.titel ? ` – ${a.titel}` : ''}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AntragStatusBadge status={a.status} />
                        <button
                          onClick={() => { onClose(); navigate(`/beihilfe-antraege/${a.id}`) }}
                          style={{ fontSize: 11, color: 'var(--primary)', background: 'none', border: '1px solid var(--primary)', borderRadius: 5, padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          → Öffnen
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : tab === 'aktivitaet' ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
            <AktivitaetsLog aktivitaeten={aktivitaeten} loading={loadingAkt} />
          </div>
        ) : null}
      </div>
    </>
  )
}
