import { useState, useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useJahr } from '../context/JahrContext'
import {
  CreditCard, FileText, Clock, Scale, CheckCircle2,
  CheckCircle, Send, Archive, ChevronDown, ChevronRight, RotateCcw, PauseCircle,
} from 'lucide-react'
import { getRechnungen, updateRechnung, bulkAction } from '../api/rechnungen'
import { getAnhaenge } from '../api/anhaenge'
import { getPersonen } from '../api/personen'
import { getCorrespondents } from '../api/correspondents'
import {
  groupIntoBuckets, getZahlungszielStatus,
  type BucketKey, type BefuellterBucket,
} from '../utils/aufgabenBuckets'
import { applyAufgabenFilter, defaultAufgabenFilter, type AufgabenFilter } from '../utils/aufgabenFilter'
import { berechneFinanzKennzahlen } from '../utils/finanzStatus'
import AufgabenFilterleiste from './AufgabenFilterleiste'
import AufgabenFinanzStatus from './AufgabenFinanzStatus'
import AnhangUpload from './AnhangUpload'
import type { Rechnung, Person, Correspondent } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10)
}

function formatEuro(v: number) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function formatDatum(s: string) {
  const [y, m, d] = s.split('-')
  return `${d}.${m}.${y}`
}

// ─── Styling ──────────────────────────────────────────────────────────────────

interface BucketTheme {
  bg: string; border: string; header: string
}

const BUCKET_THEME: Record<BucketKey, BucketTheme> = {
  zu_bezahlen:        { bg: 'var(--sec-pay-bg)',      border: 'var(--sec-pay-border)',      header: 'var(--sec-pay-header)' },
  beihilfe_einreichen:{ bg: 'var(--sec-bh-bg)',       border: 'var(--sec-bh-border)',       header: 'var(--sec-bh-header)' },
  warten_beihilfe:    { bg: 'var(--sec-wait-bg)',     border: 'var(--sec-wait-border)',     header: 'var(--sec-wait-header)' },
  pkv_einreichen:     { bg: 'var(--sec-pkv-bg)',      border: 'var(--sec-pkv-border)',      header: 'var(--sec-pkv-header)' },
  warten_pkv:         { bg: 'var(--sec-pkv-wait-bg)', border: 'var(--sec-pkv-wait-border)', header: 'var(--sec-pkv-wait-header)' },
  bereit_archivieren: { bg: 'var(--sec-done-bg)',     border: 'var(--sec-done-border)',     header: 'var(--sec-done-header)' },
}

// kept for legacy usage in BucketIcon
const BUCKET_COLORS: Record<BucketKey, string> = {
  zu_bezahlen:        'text-amber-600 dark:text-amber-400',
  beihilfe_einreichen:'text-blue-600 dark:text-blue-400',
  warten_beihilfe:    'text-purple-600 dark:text-purple-400',
  pkv_einreichen:     'text-teal-600 dark:text-teal-400',
  warten_pkv:         'text-gray-500 dark:text-gray-400',
  bereit_archivieren: 'text-green-600 dark:text-green-400',
}

function BucketIcon({ k, cls }: { k: BucketKey; cls: string }) {
  const props = { className: `w-4 h-4 ${cls}`, strokeWidth: 1.75 }
  switch (k) {
    case 'zu_bezahlen':         return <CreditCard {...props} />
    case 'beihilfe_einreichen': return <FileText {...props} />
    case 'warten_beihilfe':     return <Clock {...props} />
    case 'pkv_einreichen':      return <Scale {...props} />
    case 'warten_pkv':          return <Clock {...props} />
    case 'bereit_archivieren':  return <CheckCircle2 {...props} />
  }
}

// ─── Quick Action Button ───────────────────────────────────────────────────────

interface QuickActionProps {
  label: string
  icon: React.ReactNode
  onClick: () => void
  loading?: boolean
  variant?: 'primary' | 'secondary'
}

function QuickAction({ label, icon, onClick, loading, variant = 'primary' }: QuickActionProps) {
  const style = variant === 'primary'
    ? { background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const, display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 32, opacity: loading ? 0.6 : 1 }
    : { background: 'transparent', color: 'var(--primary)', border: '1.5px solid var(--primary)', borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const, display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 32, opacity: loading ? 0.6 : 1 }
  return (
    <button style={style} onClick={onClick} disabled={loading}>
      {loading ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : icon}
      <span>{label}</span>
    </button>
  )
}

// ─── Erstattungsbetrag-Eingabe ────────────────────────────────────────────────

interface ErstattungInputProps {
  rechnungId: string
  feld: 'beihilfe_erstattet_betrag' | 'pkv_erstattet_betrag'
  erwartet: number | null
  loading: boolean
  onSave: (id: string, patch: object) => Promise<void>
}

function ErstattungInput({ rechnungId, feld, erwartet, loading, onSave }: ErstattungInputProps) {
  const [wert, setWert] = useState('')
  const [saving, setSaving] = useState(false)
  const label = feld === 'beihilfe_erstattet_betrag' ? 'Beihilfe' : 'PKV'

  async function handleSave() {
    const betrag = parseFloat(wert.replace(',', '.'))
    if (isNaN(betrag) || betrag < 0) return
    setSaving(true)
    try {
      await onSave(rechnungId, { [feld]: betrag })
      setWert('')
    } finally {
      setSaving(false)
    }
  }

  const isLoading = loading || saving
  return (
    <div className="flex items-center gap-1 shrink-0">
      {erwartet !== null && (
        <span style={{ fontSize: 10, color: 'var(--text-subtle)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }} className="hidden sm:inline">
          erw. {formatEuro(erwartet)}
        </span>
      )}
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
        <input
          type="text" inputMode="decimal" placeholder="0,00"
          value={wert} onChange={e => setWert(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          disabled={isLoading}
          style={{ width: 72, padding: '5px 8px', fontSize: 12, background: 'var(--bg)', color: 'var(--text)', border: 'none', outline: 'none', opacity: isLoading ? 0.5 : 1 }}
        />
        <span style={{ padding: '0 6px', fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface-alt)', borderLeft: '1px solid var(--border)' }}>€</span>
      </div>
      <button
        onClick={handleSave}
        disabled={isLoading || wert.trim() === ''}
        style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4, opacity: isLoading || wert.trim() === '' ? 0.5 : 1 }}
      >
        {isLoading
          ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
          : <span>{label} speichern</span>
        }
      </button>
    </div>
  )
}

// ─── Rechnungszeile ────────────────────────────────────────────────────────────

const TYP_LABEL: Record<string, string> = { arzt: 'Arzt', apotheke: 'Apotheke', krankenhaus: 'Krankenhaus' }

function formatRef(nr: number | null) {
  return nr != null ? `R-${String(nr).padStart(4, '0')}` : null
}

interface RechnungZeileProps {
  r: Rechnung
  correspondentsById: Map<string, Correspondent>
  personenById: Map<string, Person>
  action?: ReactNode
  dimmed?: boolean
  onOpenSlider?: (id: string) => void
}

function RechnungZeile({ r, correspondentsById, personenById, action, dimmed, onOpenSlider }: RechnungZeileProps) {
  const arzt = correspondentsById.get(r.leistungserbringer_id)?.name ?? r.leistungserbringer_id
  const person = personenById.get(r.person_id)?.name ?? ''
  const ref = formatRef(r.referenz_nr)
  const [anhaengeOffen, setAnhaengeOffen] = useState(false)
  const { data: anhaenge = [] } = useQuery({
    queryKey: ['anhaenge', r.id],
    queryFn: () => getAnhaenge(r.id),
  })

  const todayStr = today()
  const zahlungszielStatus = getZahlungszielStatus(r, todayStr)

  return (
    <div style={{ padding: '6px 0', borderBottom: '1px solid var(--row-border)', opacity: dimmed ? 0.5 : 1 }} className="last:border-0">
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {ref && <span style={{ fontSize: 10, color: 'var(--text-subtle)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{ref}</span>}
            <span style={{ fontSize: 10, color: 'var(--text-subtle)', whiteSpace: 'nowrap', flexShrink: 0 }}>{formatDatum(r.datum)}</span>
            {zahlungszielStatus && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, whiteSpace: 'nowrap', flexShrink: 0,
                background: zahlungszielStatus === 'ueberfaellig' ? 'var(--rose-dim)' : 'var(--amber-dim)',
                color: zahlungszielStatus === 'ueberfaellig' ? 'var(--rose)' : 'var(--amber)',
              }}>
                {zahlungszielStatus === 'ueberfaellig' ? 'Überfällig' : `Fällig ${formatDatum(r.zahlungsziel!)}`}
              </span>
            )}
            <button
              onClick={() => onOpenSlider?.(r.id)}
              style={{ fontWeight: 600, fontSize: 12, color: onOpenSlider ? 'var(--primary)' : 'var(--text)', background: 'none', border: 'none', cursor: onOpenSlider ? 'pointer' : 'default', padding: 0, textAlign: 'left' }}
              className="truncate"
            >
              {arzt}
            </button>
            {person && <span style={{ fontSize: 11, color: 'var(--text-muted)' }} className="truncate hidden sm:inline">{person}</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span style={{ fontSize: 10, color: 'var(--text-subtle)', background: 'var(--surface-hi)', padding: '1px 6px', borderRadius: 4 }}>{TYP_LABEL[r.typ] ?? r.typ}</span>
            {person && <span style={{ fontSize: 11, color: 'var(--text-muted)' }} className="sm:hidden truncate">{person}</span>}
            {r.notiz && <span style={{ fontSize: 10, color: 'var(--text-subtle)', fontStyle: 'italic' }} className="truncate">{r.notiz}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 justify-between sm:justify-end">
          <button
            onClick={() => setAnhaengeOffen(o => !o)}
            title="Anhänge"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '3px 7px', fontSize: 11, borderRadius: 5, cursor: 'pointer',
              border: `1px solid ${anhaengeOffen ? 'var(--border-hi)' : 'var(--border)'}`,
              background: anhaengeOffen ? 'var(--surface-hi)' : 'transparent',
              color: anhaenge.length > 0 ? 'var(--primary)' : 'var(--text-subtle)',
            }}
          >
            📎{anhaenge.length > 0 && <span style={{ fontVariantNumeric: 'tabular-nums' }}>{anhaenge.length}</span>}
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {formatEuro(r.betrag)}
          </span>
          {action}
        </div>
      </div>
      {anhaengeOffen && (
        <div className="mt-2 pl-1">
          <AnhangUpload rechnungId={r.id} referenzNr={r.referenz_nr} compact />
        </div>
      )}
    </div>
  )
}

// ─── PKV-Einreichen Sektion (Sonderbehandlung: gruppiert nach Person + Bulk) ──

interface PkvEinreichenSektionProps {
  aktive: Rechnung[]
  zurueckgestellt: Rechnung[]
  personenById: Map<string, Person>
  correspondentsById: Map<string, Correspondent>
  onUpdate: (id: string, patch: object) => Promise<void>
  loading: Set<string>
  onOpenSlider?: (id: string) => void
}

function PkvEinreichenSektion({
  aktive, zurueckgestellt, personenById, correspondentsById, onUpdate, loading, onOpenSlider,
}: PkvEinreichenSektionProps) {
  const [showZurueck, setShowZurueck] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState<Set<string>>(new Set())

  const aktivNachPerson = new Map<string, Rechnung[]>()
  for (const r of aktive) {
    if (!aktivNachPerson.has(r.person_id)) aktivNachPerson.set(r.person_id, [])
    aktivNachPerson.get(r.person_id)!.push(r)
  }

  const zurueckNachPerson = new Map<string, Rechnung[]>()
  for (const r of zurueckgestellt) {
    if (!zurueckNachPerson.has(r.person_id)) zurueckNachPerson.set(r.person_id, [])
    zurueckNachPerson.get(r.person_id)!.push(r)
  }

  const allePersonIds = [...new Set([...aktivNachPerson.keys(), ...zurueckNachPerson.keys()])]

  async function bulkEinreichen(personId: string) {
    setBulkLoading(prev => new Set(prev).add(personId))
    for (const r of aktivNachPerson.get(personId) ?? []) {
      await onUpdate(r.id, { pkv_eingereicht_am: today() })
    }
    setBulkLoading(prev => { const next = new Set(prev); next.delete(personId); return next })
  }

  return (
    <div className="space-y-3">
      {allePersonIds.map(personId => {
        const personName = personenById.get(personId)?.name ?? personId
        const aktiv = aktivNachPerson.get(personId) ?? []
        const zurueck = zurueckNachPerson.get(personId) ?? []
        const showZ = showZurueck.has(personId)

        return (
          <div key={personId} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ padding: '6px 12px', background: 'var(--surface-alt)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)' }}>{personName}</span>
              {aktiv.length > 1 && (
                <button
                  style={{ fontSize: 11, color: 'var(--primary)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3, opacity: bulkLoading.has(personId) ? 0.6 : 1 }}
                  onClick={() => bulkEinreichen(personId)}
                  disabled={bulkLoading.has(personId)}
                >
                  {bulkLoading.has(personId) && <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />}
                  Alle bei PKV einreichen ({aktiv.length})
                </button>
              )}
            </div>
            <div className="px-3">
              {aktiv.map(r => (
                <RechnungZeile
                  key={r.id}
                  r={r}
                  correspondentsById={correspondentsById}
                  personenById={personenById}
                  onOpenSlider={onOpenSlider}
                  action={
                    <div className="flex items-center gap-1">
                      <QuickAction
                        label="PKV einreichen"
                        icon={<Send className="w-3 h-3" />}
                        loading={loading.has(r.id)}
                        onClick={() => onUpdate(r.id, { pkv_eingereicht_am: today() })}
                      />
                      <QuickAction
                        label="Zurückstellen"
                        icon={<PauseCircle className="w-3 h-3" />}
                        loading={loading.has(r.id)}
                        variant="secondary"
                        onClick={() => onUpdate(r.id, { pkv_verzicht: true })}
                      />
                    </div>
                  }
                />
              ))}
            </div>
            {zurueck.length > 0 && (
              <div className="px-3 pb-2">
                <button
                  style={{ fontSize: 11, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3, padding: '4px 0', marginTop: 4 }}
                  onClick={() => setShowZurueck(prev => {
                    const next = new Set(prev)
                    next.has(personId) ? next.delete(personId) : next.add(personId)
                    return next
                  })}
                >
                  {showZ ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  {zurueck.length} zurückgestellte Rechnung{zurueck.length !== 1 ? 'en' : ''}{' '}
                  {showZ ? 'ausblenden' : 'anzeigen'}
                </button>
                {showZ && zurueck.map(r => (
                  <RechnungZeile
                    key={r.id}
                    r={r}
                    correspondentsById={correspondentsById}
                    personenById={personenById}
                    onOpenSlider={onOpenSlider}
                    dimmed
                    action={
                      <QuickAction
                        label="Doch einreichen"
                        icon={<RotateCcw className="w-3 h-3" />}
                        loading={loading.has(r.id)}
                        variant="secondary"
                        onClick={() => onUpdate(r.id, { pkv_verzicht: false })}
                      />
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Bucket Sektion ────────────────────────────────────────────────────────────

interface BucketSektionProps {
  bucket: BefuellterBucket
  personenById: Map<string, Person>
  correspondentsById: Map<string, Correspondent>
  onUpdate: (id: string, patch: object) => Promise<void>
  onArchivieren: (id: string) => Promise<void>
  loading: Set<string>
  collapsed: boolean
  onToggle: () => void
  onOpenSlider?: (id: string) => void
}

function BucketSektion({
  bucket, personenById, correspondentsById, onUpdate, onArchivieren, loading, collapsed, onToggle, onOpenSlider,
}: BucketSektionProps) {
  const navigate = useNavigate()
  const total = bucket.aktive.length + bucket.zurueckgestellt.length
  if (total === 0) return null

  const { definition: def } = bucket
  const colorCls = BUCKET_COLORS[def.key]
  const theme = BUCKET_THEME[def.key]

  function getAction(r: Rechnung): ReactNode {
    switch (def.key) {
      case 'zu_bezahlen':
        return (
          <QuickAction
            label="Bezahlt"
            icon={<CheckCircle className="w-3 h-3" />}
            loading={loading.has(r.id)}
            onClick={() => onUpdate(r.id, { bezahlt_am: today() })}
          />
        )
      case 'beihilfe_einreichen':
        return (
          <button
            onClick={() => navigate('/beihilfe-antraege')}
            style={{ background: 'transparent', color: 'var(--primary)', border: '1.5px solid var(--primary)', borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const, display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 32 }}
          >
            → Zu Anträgen
          </button>
        )
      case 'warten_beihilfe':
        return (
          <button
            onClick={() => navigate('/beihilfe-antraege')}
            style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' as const, display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 32 }}
          >
            Bescheid erfassen
          </button>
        )
      case 'warten_pkv':
        return (
          <ErstattungInput
            rechnungId={r.id}
            feld="pkv_erstattet_betrag"
            erwartet={r.pkv_anteil_erwartet}
            loading={loading.has(r.id)}
            onSave={onUpdate}
          />
        )
      case 'bereit_archivieren':
        return (
          <QuickAction
            label="Archivieren"
            icon={<Archive className="w-3 h-3" />}
            loading={loading.has(r.id)}
            onClick={() => onArchivieren(r.id)}
          />
        )
      default:
        return null
    }
  }

  return (
    <div id={`bucket-${def.key}`} style={{ background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, overflow: 'hidden' }}>
      <button
        className="w-full flex items-center gap-2 px-3 py-3 text-left min-h-[48px]"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
        onClick={onToggle}
      >
        <BucketIcon k={def.key} cls={colorCls} />
        <span style={{ fontWeight: 700, fontSize: 12, flex: 1, color: theme.header }}>{def.titel}</span>
        <span style={{ fontSize: 11, color: theme.header, opacity: 0.6, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {total} · {formatEuro(bucket.gesamtbetrag)}
        </span>
        {collapsed
          ? <ChevronRight className="w-4 h-4 ml-1 flex-shrink-0" style={{ color: theme.header, opacity: 0.5 }} />
          : <ChevronDown className="w-4 h-4 ml-1 flex-shrink-0" style={{ color: theme.header, opacity: 0.5 }} />
        }
      </button>

      {!collapsed && (
        <div className="px-3 pb-3">
          <p style={{ fontSize: 11, color: theme.header, opacity: 0.6, marginBottom: 8 }}>{def.beschreibung}</p>
          <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 4 }}>
            {def.key === 'pkv_einreichen' ? (
              <PkvEinreichenSektion
                aktive={bucket.aktive}
                zurueckgestellt={bucket.zurueckgestellt}
                personenById={personenById}
                correspondentsById={correspondentsById}
                onUpdate={onUpdate}
                loading={loading}
                onOpenSlider={onOpenSlider}
              />
            ) : (
              bucket.aktive.map(r => (
                <RechnungZeile
                  key={r.id}
                  r={r}
                  correspondentsById={correspondentsById}
                  personenById={personenById}
                  onOpenSlider={onOpenSlider}
                  action={getAction(r)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Hauptkomponente ───────────────────────────────────────────────────────────

interface AufgabenDashboardProps {
  onOpenSlider?: (id: string) => void
}

export default function AufgabenDashboard({ onOpenSlider }: AufgabenDashboardProps) {
  const queryClient = useQueryClient()
  const { jahr } = useJahr()
  const [loading, setLoading] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<BucketKey>>(new Set())
  const [filter, setFilter] = useState<AufgabenFilter>(defaultAufgabenFilter)

  const { data: rechnungen = [], isLoading: rLoading } = useQuery({
    queryKey: ['rechnungen', undefined, false, jahr],
    queryFn: () => getRechnungen(undefined, false, jahr),
    refetchInterval: 60_000,
  })

  const { data: personen = [], isLoading: pLoading } = useQuery({
    queryKey: ['personen'],
    queryFn: getPersonen,
  })

  const { data: correspondents = [] } = useQuery({
    queryKey: ['correspondents'],
    queryFn: getCorrespondents,
  })

  const personenById = useMemo(
    () => new Map<string, Person>(personen.map(p => [p.id, p])),
    [personen],
  )

  const correspondentsById = useMemo(
    () => new Map<string, Correspondent>(correspondents.map(c => [c.id, c])),
    [correspondents],
  )

  const gefilterteRechnungen = useMemo(
    () => applyAufgabenFilter(rechnungen, filter, jahr),
    [rechnungen, filter, jahr],
  )

  const buckets = useMemo(
    () => groupIntoBuckets(gefilterteRechnungen, personenById),
    [gefilterteRechnungen, personenById],
  )

  const kennzahlen = useMemo(
    () => berechneFinanzKennzahlen(gefilterteRechnungen, personenById, jahr),
    [gefilterteRechnungen, personenById, jahr],
  )

  async function handleUpdate(id: string, patch: object) {
    setLoading(prev => new Set(prev).add(id))
    try {
      await updateRechnung(id, patch as Parameters<typeof updateRechnung>[1])
      await queryClient.invalidateQueries({ queryKey: ['rechnungen'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } finally {
      setLoading(prev => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  async function handleArchivieren(id: string) {
    setLoading(prev => new Set(prev).add(id))
    try {
      await bulkAction([id], 'archivieren')
      await queryClient.invalidateQueries({ queryKey: ['rechnungen'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } finally {
      setLoading(prev => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  function toggleCollapse(key: BucketKey) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  if (rLoading || pLoading) {
    return <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Lade Aufgaben...</p>
  }

  const sichtbareBuckets = buckets.filter(b => (b.aktive.length + b.zurueckgestellt.length) > 0)
  const offeneAufgaben = sichtbareBuckets
    .filter(b => !b.definition.istWartebucket && b.definition.key !== 'bereit_archivieren')
    .reduce((s, b) => s + b.aktive.length + b.zurueckgestellt.length, 0)

  return (
    <div className="space-y-3">
      <AufgabenFilterleiste filter={filter} onChange={setFilter} personen={personen} />

      <AufgabenFinanzStatus kennzahlen={kennzahlen} />

      {/* Zusammenfassungs-Chips */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
        {sichtbareBuckets.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Alles erledigt 🎉</p>
        ) : (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              {offeneAufgaben > 0
                ? `${offeneAufgaben} offene Aufgabe${offeneAufgaben !== 1 ? 'n' : ''}`
                : 'Keine offenen Aufgaben'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sichtbareBuckets.map(b => {
                const count = b.aktive.length + b.zurueckgestellt.length
                const isWarte = b.definition.istWartebucket
                const t = BUCKET_THEME[b.definition.key]
                return (
                  <button
                    key={b.definition.key}
                    onClick={() => {
                      setCollapsed(prev => { const next = new Set(prev); next.delete(b.definition.key); return next })
                      setTimeout(() => document.getElementById(`bucket-${b.definition.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
                    }}
                    style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, border: `1px solid ${t.border}`, background: t.bg, color: t.header, cursor: 'pointer', fontStyle: isWarte ? 'italic' : 'normal', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                  >
                    {isWarte && <Clock className="w-3 h-3" />}
                    {count} {b.definition.titel}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Bucket-Sektionen */}
      {buckets.map(b => (
        <BucketSektion
          key={b.definition.key}
          bucket={b}
          personenById={personenById}
          correspondentsById={correspondentsById}
          onUpdate={handleUpdate}
          onArchivieren={handleArchivieren}
          loading={loading}
          collapsed={collapsed.has(b.definition.key)}
          onToggle={() => toggleCollapse(b.definition.key)}
          onOpenSlider={onOpenSlider}
        />
      ))}
    </div>
  )
}
