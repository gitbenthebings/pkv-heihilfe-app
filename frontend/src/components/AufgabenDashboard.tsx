import { useState, useMemo, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CreditCard, FileText, Clock, Scale, CheckCircle2,
  CheckCircle, Send, Archive, ChevronDown, ChevronRight, RotateCcw, PauseCircle,
} from 'lucide-react'
import { getRechnungen, updateRechnung, bulkAction } from '../api/rechnungen'
import { getAnhaenge } from '../api/anhaenge'
import { getPersonen } from '../api/personen'
import { getCorrespondents } from '../api/correspondents'
import {
  groupIntoBuckets,
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

const BUCKET_COLORS: Record<BucketKey, string> = {
  zu_bezahlen:        'text-amber-600 dark:text-amber-400',
  beihilfe_einreichen:'text-blue-600 dark:text-blue-400',
  warten_beihilfe:    'text-gray-500 dark:text-gray-400',
  pkv_einreichen:     'text-violet-600 dark:text-violet-400',
  warten_pkv:         'text-gray-500 dark:text-gray-400',
  bereit_archivieren: 'text-green-600 dark:text-green-400',
}

const BUCKET_BG: Record<BucketKey, string> = {
  zu_bezahlen:        'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700',
  beihilfe_einreichen:'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700',
  warten_beihilfe:    'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-600',
  pkv_einreichen:     'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700',
  warten_pkv:         'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-600',
  bereit_archivieren: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700',
}

const BUCKET_CHIP: Record<BucketKey, string> = {
  zu_bezahlen:        'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  beihilfe_einreichen:'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  warten_beihilfe:    'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  pkv_einreichen:     'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  warten_pkv:         'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  bereit_archivieren: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
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
  const base = 'inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded min-h-[36px] disabled:opacity-50 transition-colors'
  const cls = variant === 'primary'
    ? `${base} bg-blue-600 text-white hover:bg-blue-700`
    : `${base} bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600`
  return (
    <button className={cls} onClick={onClick} disabled={loading}>
      {loading ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : icon}
      <span className="whitespace-nowrap">{label}</span>
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
        <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums whitespace-nowrap hidden sm:inline">
          erw. {formatEuro(erwartet)}
        </span>
      )}
      <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded overflow-hidden min-h-[36px]">
        <input
          type="text" inputMode="decimal" placeholder="0,00"
          value={wert} onChange={e => setWert(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          disabled={isLoading}
          className="w-20 px-2 py-1 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none disabled:opacity-50"
        />
        <span className="px-1 text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700 border-l border-gray-300 dark:border-gray-600">€</span>
      </div>
      <button
        onClick={handleSave}
        disabled={isLoading || wert.trim() === ''}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors min-h-[36px] whitespace-nowrap"
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
}

function RechnungZeile({ r, correspondentsById, personenById, action, dimmed }: RechnungZeileProps) {
  const arzt = correspondentsById.get(r.leistungserbringer_id)?.name ?? r.leistungserbringer_id
  const person = personenById.get(r.person_id)?.name ?? ''
  const ref = formatRef(r.referenz_nr)
  const [anhaengeOffen, setAnhaengeOffen] = useState(false)
  const { data: anhaenge = [] } = useQuery({
    queryKey: ['anhaenge', r.id],
    queryFn: () => getAnhaenge(r.id),
  })

  return (
    <div className={`py-2 border-b border-gray-100 dark:border-gray-700 last:border-0 ${dimmed ? 'opacity-50' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            {ref && <span className="font-mono text-xs text-gray-400 dark:text-gray-500 shrink-0">{ref}</span>}
            <span className="text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap shrink-0">{formatDatum(r.datum)}</span>
            <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{arzt}</span>
            {person && <span className="text-xs text-gray-500 dark:text-gray-400 truncate hidden sm:inline">{person}</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-400 dark:text-gray-500">{TYP_LABEL[r.typ] ?? r.typ}</span>
            {person && <span className="text-xs text-gray-500 dark:text-gray-400 sm:hidden truncate">{person}</span>}
            {r.notiz && <span className="text-xs text-gray-400 dark:text-gray-500 truncate italic">{r.notiz}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 justify-between sm:justify-end">
          <button
            onClick={() => setAnhaengeOffen(o => !o)}
            className={`inline-flex items-center gap-1 px-1.5 py-1 text-xs border rounded transition-colors ${anhaengeOffen ? 'border-gray-400 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200' : anhaenge.length > 0 ? 'border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30' : 'border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            title="Anhänge"
          >
            📎{anhaenge.length > 0 && <span className="tabular-nums">{anhaenge.length}</span>}
          </button>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 tabular-nums">
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
}

function PkvEinreichenSektion({
  aktive, zurueckgestellt, personenById, correspondentsById, onUpdate, loading,
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
          <div key={personId} className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700/50 flex items-center justify-between">
              <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{personName}</span>
              {aktiv.length > 1 && (
                <button
                  className="text-xs text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1 disabled:opacity-50"
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
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 py-1 mt-1"
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
}

function BucketSektion({
  bucket, personenById, correspondentsById, onUpdate, onArchivieren, loading, collapsed, onToggle,
}: BucketSektionProps) {
  const total = bucket.aktive.length + bucket.zurueckgestellt.length
  if (total === 0) return null

  const { definition: def } = bucket
  const colorCls = BUCKET_COLORS[def.key]
  const bgCls = BUCKET_BG[def.key]

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
          <QuickAction
            label="Eingereicht"
            icon={<Send className="w-3 h-3" />}
            loading={loading.has(r.id)}
            onClick={() => onUpdate(r.id, { beihilfe_eingereicht_am: today() })}
          />
        )
      case 'warten_beihilfe':
        return (
          <ErstattungInput
            rechnungId={r.id}
            feld="beihilfe_erstattet_betrag"
            erwartet={r.beihilfe_anteil_erwartet}
            loading={loading.has(r.id)}
            onSave={onUpdate}
          />
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
    <div id={`bucket-${def.key}`} className={`rounded-lg border ${bgCls} overflow-hidden`}>
      <button
        className="w-full flex items-center gap-2 px-3 py-3 text-left min-h-[48px]"
        onClick={onToggle}
      >
        <BucketIcon k={def.key} cls={colorCls} />
        <span className={`font-semibold text-sm flex-1 ${colorCls}`}>{def.titel}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
          {total} Rechnung{total !== 1 ? 'en' : ''}
        </span>
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 ml-1 whitespace-nowrap">
          {formatEuro(bucket.gesamtbetrag)}
        </span>
        {collapsed
          ? <ChevronRight className="w-4 h-4 text-gray-400 ml-1 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-400 ml-1 flex-shrink-0" />
        }
      </button>

      {!collapsed && (
        <div className="px-3 pb-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{def.beschreibung}</p>
          <div className="border-t border-gray-200 dark:border-gray-600 pt-1">
            {def.key === 'pkv_einreichen' ? (
              <PkvEinreichenSektion
                aktive={bucket.aktive}
                zurueckgestellt={bucket.zurueckgestellt}
                personenById={personenById}
                correspondentsById={correspondentsById}
                onUpdate={onUpdate}
                loading={loading}
              />
            ) : (
              bucket.aktive.map(r => (
                <RechnungZeile
                  key={r.id}
                  r={r}
                  correspondentsById={correspondentsById}
                  personenById={personenById}
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

export default function AufgabenDashboard() {
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<BucketKey>>(new Set())
  const [filter, setFilter] = useState<AufgabenFilter>(defaultAufgabenFilter)

  const { data: rechnungen = [], isLoading: rLoading } = useQuery({
    queryKey: ['rechnungen'],
    queryFn: () => getRechnungen(),
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
    () => applyAufgabenFilter(rechnungen, filter),
    [rechnungen, filter],
  )

  const buckets = useMemo(
    () => groupIntoBuckets(gefilterteRechnungen, personenById),
    [gefilterteRechnungen, personenById],
  )

  const kennzahlen = useMemo(
    () => berechneFinanzKennzahlen(gefilterteRechnungen, personenById),
    [gefilterteRechnungen, personenById],
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
    return <p className="text-gray-500 dark:text-gray-400 text-sm">Lade Aufgaben...</p>
  }

  const sichtbareBuckets = buckets.filter(b => (b.aktive.length + b.zurueckgestellt.length) > 0)
  const offeneAufgaben = sichtbareBuckets
    .filter(b => !b.definition.istWartebucket && b.definition.key !== 'bereit_archivieren')
    .reduce((s, b) => s + b.aktive.length + b.zurueckgestellt.length, 0)

  return (
    <div className="space-y-3">
      <AufgabenFilterleiste filter={filter} onChange={setFilter} personen={personen} />

      <AufgabenFinanzStatus kennzahlen={kennzahlen} filter={filter} />

      {/* Zusammenfassungs-Chips */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5">
        {sichtbareBuckets.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">Alles erledigt 🎉</p>
        ) : (
          <>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {offeneAufgaben > 0
                ? `${offeneAufgaben} offene Aufgabe${offeneAufgaben !== 1 ? 'n' : ''}`
                : 'Keine offenen Aufgaben'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sichtbareBuckets.map(b => {
                const count = b.aktive.length + b.zurueckgestellt.length
                const isWarte = b.definition.istWartebucket
                return (
                  <button
                    key={b.definition.key}
                    onClick={() => {
                      setCollapsed(prev => { const next = new Set(prev); next.delete(b.definition.key); return next })
                      setTimeout(() => document.getElementById(`bucket-${b.definition.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
                    }}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${BUCKET_CHIP[b.definition.key]} ${isWarte ? 'italic' : ''}`}
                  >
                    {isWarte && <Clock className="w-3 h-3 inline mr-0.5" />}
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
        />
      ))}
    </div>
  )
}
