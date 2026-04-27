import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CreditCard, FileText, Clock, Scale, CheckCircle2,
  CheckCircle, Send, RotateCcw, Archive, ChevronDown, ChevronRight,
} from 'lucide-react'
import { getRechnungen, updateRechnung, bulkAction } from '../api/rechnungen'
import { getAnhaenge } from '../api/anhaenge'
import { getPersonen } from '../api/personen'
import { getCorrespondents } from '../api/correspondents'
import { groupIntoAufgabenBuckets, type BucketKey, type AufgabenBucket } from '../utils/aufgabenBuckets'
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
  zu_bezahlen: 'text-amber-600 dark:text-amber-400',
  beihilfe_einreichen: 'text-blue-600 dark:text-blue-400',
  beihilfe_bescheid_ausstehend: 'text-gray-500 dark:text-gray-400',
  pkv_entscheidung: 'text-violet-600 dark:text-violet-400',
  pkv_abrechnung_ausstehend: 'text-gray-500 dark:text-gray-400',
  bereit_archivieren: 'text-green-600 dark:text-green-400',
}

const BUCKET_BG: Record<BucketKey, string> = {
  zu_bezahlen: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700',
  beihilfe_einreichen: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700',
  beihilfe_bescheid_ausstehend: 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-600',
  pkv_entscheidung: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700',
  pkv_abrechnung_ausstehend: 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-600',
  bereit_archivieren: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700',
}

const BUCKET_CHIP: Record<BucketKey, string> = {
  zu_bezahlen: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  beihilfe_einreichen: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  beihilfe_bescheid_ausstehend: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  pkv_entscheidung: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
  pkv_abrechnung_ausstehend: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  bereit_archivieren: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
}

const WARTE_BUCKETS: Set<BucketKey> = new Set([
  'beihilfe_bescheid_ausstehend',
  'pkv_abrechnung_ausstehend',
])

function BucketIcon({ k, cls }: { k: BucketKey; cls: string }) {
  const props = { className: `w-4 h-4 ${cls}`, strokeWidth: 1.75 }
  switch (k) {
    case 'zu_bezahlen': return <CreditCard {...props} />
    case 'beihilfe_einreichen': return <FileText {...props} />
    case 'beihilfe_bescheid_ausstehend': return <Clock {...props} />
    case 'pkv_entscheidung': return <Scale {...props} />
    case 'pkv_abrechnung_ausstehend': return <Clock {...props} />
    case 'bereit_archivieren': return <CheckCircle2 {...props} />
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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
  }

  const isLoading = loading || saving

  return (
    <div className="flex items-center gap-1 shrink-0">
      {erwartet !== null && (
        <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums whitespace-nowrap hidden sm:inline">
          erw. {erwartet.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
        </span>
      )}
      <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded overflow-hidden min-h-[36px]">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          value={wert}
          onChange={e => setWert(e.target.value)}
          onKeyDown={handleKeyDown}
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

interface RechnungZeileProps {
  r: Rechnung
  correspondentsById: Map<string, Correspondent>
  personenById: Map<string, Person>
  action?: React.ReactNode
  dimmed?: boolean
}

const TYP_LABEL: Record<string, string> = { arzt: 'Arzt', apotheke: 'Apotheke', krankenhaus: 'Krankenhaus' }

function formatRef(nr: number | null) {
  return nr != null ? `R-${String(nr).padStart(4, '0')}` : null
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

// ─── PKV-Entscheidung Sektion (Sonderbehandlung) ──────────────────────────────

interface PkvEntscheidungSektionProps {
  bucket: AufgabenBucket
  personenById: Map<string, Person>
  correspondentsById: Map<string, Correspondent>
  onUpdate: (id: string, patch: object) => Promise<void>
  loading: Set<string>
}

function PkvEntscheidungSektion({ bucket, personenById, correspondentsById, onUpdate, loading }: PkvEntscheidungSektionProps) {
  const [showZurueckgestellt, setShowZurueckgestellt] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState<Set<string>>(new Set())

  const aktivNachPerson = new Map<string, Rechnung[]>()
  for (const r of bucket.aktive) {
    const pid = r.person_id
    if (!aktivNachPerson.has(pid)) aktivNachPerson.set(pid, [])
    aktivNachPerson.get(pid)!.push(r)
  }

  const zurueckNachPerson = new Map<string, Rechnung[]>()
  for (const r of bucket.zurueckgestellt) {
    const pid = r.person_id
    if (!zurueckNachPerson.has(pid)) zurueckNachPerson.set(pid, [])
    zurueckNachPerson.get(pid)!.push(r)
  }

  const allePersonIds = new Set([...aktivNachPerson.keys(), ...zurueckNachPerson.keys()])

  async function bulkEinreichen(personId: string) {
    const rechnungen = aktivNachPerson.get(personId) ?? []
    setBulkLoading(prev => new Set(prev).add(personId))
    for (const r of rechnungen) {
      await onUpdate(r.id, { pkv_eingereicht_am: today() })
    }
    setBulkLoading(prev => { const next = new Set(prev); next.delete(personId); return next })
  }

  function toggleZurueck(personId: string) {
    setShowZurueckgestellt(prev => {
      const next = new Set(prev)
      next.has(personId) ? next.delete(personId) : next.add(personId)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {[...allePersonIds].map(personId => {
        const person = personenById.get(personId)
        const personName = person?.name ?? personId
        const aktiv = aktivNachPerson.get(personId) ?? []
        const zurueck = zurueckNachPerson.get(personId) ?? []
        const showZ = showZurueckgestellt.has(personId)

        return (
          <div key={personId} className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
            {/* Person Header */}
            <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700/50">
              <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{personName}</div>
              {aktiv.length > 0 && (
                <button
                  className="mt-1 text-xs text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1 disabled:opacity-50"
                  onClick={() => bulkEinreichen(personId)}
                  disabled={bulkLoading.has(personId)}
                >
                  {bulkLoading.has(personId) && <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />}
                  Alle bei PKV einreichen
                </button>
              )}
            </div>

            {/* Aktive Rechnungen */}
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
                        icon={<span className="text-xs">⏸</span>}
                        loading={loading.has(r.id)}
                        variant="secondary"
                        onClick={() => onUpdate(r.id, { pkv_verzicht: true })}
                      />
                    </div>
                  }
                />
              ))}
            </div>

            {/* Zurückgestellte Toggle */}
            {zurueck.length > 0 && (
              <div className="px-3 pb-2">
                <button
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 py-1 mt-1"
                  onClick={() => toggleZurueck(personId)}
                >
                  {showZ ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  {zurueck.length} zurückgestellte Rechnung{zurueck.length !== 1 ? 'en' : ''} {showZ ? 'ausblenden' : 'anzeigen'}
                </button>
                {showZ && (
                  <div className="mt-1">
                    {zurueck.map(r => (
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
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Bucket Sektion ────────────────────────────────────────────────────────────

interface BucketSektionProps {
  bucket: AufgabenBucket
  personenById: Map<string, Person>
  correspondentsById: Map<string, Correspondent>
  onUpdate: (id: string, patch: object) => Promise<void>
  onArchivieren: (id: string) => Promise<void>
  loading: Set<string>
  collapsed: boolean
  onToggle: () => void
}

function BucketSektion({ bucket, personenById, correspondentsById, onUpdate, onArchivieren, loading, collapsed, onToggle }: BucketSektionProps) {
  const total = bucket.aktive.length + bucket.zurueckgestellt.length
  if (total === 0) return null

  const colorCls = BUCKET_COLORS[bucket.key]
  const bgCls = BUCKET_BG[bucket.key]

  function getAction(r: Rechnung): React.ReactNode {
    if (bucket.key === 'beihilfe_bescheid_ausstehend') {
      return (
        <ErstattungInput
          rechnungId={r.id}
          feld="beihilfe_erstattet_betrag"
          erwartet={r.beihilfe_anteil_erwartet}
          loading={loading.has(r.id)}
          onSave={onUpdate}
        />
      )
    }
    if (bucket.key === 'pkv_abrechnung_ausstehend') {
      return (
        <ErstattungInput
          rechnungId={r.id}
          feld="pkv_erstattet_betrag"
          erwartet={r.pkv_anteil_erwartet}
          loading={loading.has(r.id)}
          onSave={onUpdate}
        />
      )
    }
    switch (bucket.key) {
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
    <div id={`bucket-${bucket.key}`} className={`rounded-lg border ${bgCls} overflow-hidden`}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-3 py-3 text-left min-h-[48px]"
        onClick={onToggle}
      >
        <BucketIcon k={bucket.key} cls={colorCls} />
        <span className={`font-semibold text-sm flex-1 ${colorCls}`}>{bucket.titel}</span>
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

      {/* Body */}
      {!collapsed && (
        <div className="px-3 pb-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{bucket.beschreibung}</p>
          <div className="border-t border-gray-200 dark:border-gray-600 pt-1">
            {bucket.key === 'pkv_entscheidung' ? (
              <PkvEntscheidungSektion
                bucket={bucket}
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
    [personen]
  )

  const correspondentsById = useMemo(
    () => new Map<string, Correspondent>(correspondents.map(c => [c.id, c])),
    [correspondents]
  )

  const gefilterteRechnungen = useMemo(
    () => applyAufgabenFilter(rechnungen, filter),
    [rechnungen, filter]
  )

  const buckets = useMemo(
    () => groupIntoAufgabenBuckets(gefilterteRechnungen, personenById),
    [gefilterteRechnungen, personenById]
  )

  const kennzahlen = useMemo(
    () => berechneFinanzKennzahlen(gefilterteRechnungen, personenById),
    [gefilterteRechnungen, personenById]
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

  // Chips
  const actionBuckets = buckets.filter(b => b.key !== 'bereit_archivieren' && (b.aktive.length + b.zurueckgestellt.length) > 0)
  const archivBucket = buckets.find(b => b.key === 'bereit_archivieren')
  const archivCount = (archivBucket?.aktive.length ?? 0) + (archivBucket?.zurueckgestellt.length ?? 0)
  const offeneAufgaben = actionBuckets.reduce((s, b) => s + b.aktive.length + b.zurueckgestellt.length, 0)

  return (
    <div className="space-y-3">
      {/* Filterleiste */}
      <AufgabenFilterleiste filter={filter} onChange={setFilter} personen={personen} />

      {/* Finanzstatus */}
      <AufgabenFinanzStatus kennzahlen={kennzahlen} filter={filter} />

      {/* Zusammenfassung */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2.5">
        {offeneAufgaben === 0 && archivCount === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">Alles erledigt 🎉</p>
        ) : (
          <>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {offeneAufgaben > 0 ? `${offeneAufgaben} offene Aufgabe${offeneAufgaben !== 1 ? 'n' : ''}` : 'Keine offenen Aufgaben'}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {actionBuckets.map(b => {
                const count = b.aktive.length + b.zurueckgestellt.length
                const isWarte = WARTE_BUCKETS.has(b.key)
                return (
                  <a
                    key={b.key}
                    href={`#bucket-${b.key}`}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${BUCKET_CHIP[b.key]} ${isWarte ? 'italic' : ''}`}
                  >
                    {isWarte && <Clock className="w-3 h-3 inline mr-0.5" />}
                    {count} {b.titel}
                  </a>
                )
              })}
              {archivCount > 0 && (
                <a
                  href="#bucket-bereit_archivieren"
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${BUCKET_CHIP['bereit_archivieren']}`}
                >
                  {archivCount} bereit zum Archivieren
                </a>
              )}
            </div>
          </>
        )}
      </div>

      {/* Bucket Sektionen */}
      {buckets.map(b => (
        <BucketSektion
          key={b.key}
          bucket={b}
          personenById={personenById}
          correspondentsById={correspondentsById}
          onUpdate={handleUpdate}
          onArchivieren={handleArchivieren}
          loading={loading}
          collapsed={collapsed.has(b.key)}
          onToggle={() => toggleCollapse(b.key)}
        />
      ))}
    </div>
  )
}
