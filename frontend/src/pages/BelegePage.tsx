import React, { useState, useRef, useMemo } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { getBelege, uploadBeleg, deleteBeleg } from '../api/belege'
import { getBeihilfestellen } from '../api/beihilfestellen'
import { getPkv } from '../api/pkv'
import BelegCard from '../components/BelegCard'
import BelegeUpload from '../components/BelegeUpload'
import BelegDetailSlider from '../components/BelegDetailSlider'
import { fileToGrayscalePdf } from '../utils/imageToGrayscalePdf'
import { TYP_LABELS } from '../components/BelegeUpload'
import type { Beleg, BelegTyp } from '../types'

type BelegViewMode = 'cards' | 'table'

function TableIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ display: 'block' }}>
      <rect x="1" y="2" width="12" height="2" rx="1" fill={active ? 'var(--primary)' : 'var(--text-subtle)'} />
      <rect x="1" y="6" width="12" height="2" rx="1" fill={active ? 'var(--primary)' : 'var(--text-subtle)'} />
      <rect x="1" y="10" width="12" height="2" rx="1" fill={active ? 'var(--primary)' : 'var(--text-subtle)'} />
    </svg>
  )
}

function GridIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--primary)' : 'var(--text-subtle)'
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ display: 'block' }}>
      <rect x="1" y="1" width="5.5" height="5.5" rx="1.5" fill={c} />
      <rect x="7.5" y="1" width="5.5" height="5.5" rx="1.5" fill={c} />
      <rect x="1" y="7.5" width="5.5" height="5.5" rx="1.5" fill={c} />
      <rect x="7.5" y="7.5" width="5.5" height="5.5" rx="1.5" fill={c} />
    </svg>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// Typ-Tone für Sidebar-Punkte (matching design)
const TYPE_TONE: Partial<Record<BelegTyp, string>> = {
  rechnung: 'amber',
  erstbescheid: 'teal',
  widerspruchsbescheid: 'rose',
  rezept: 'green',
  ueberweisung: 'blue',
  sonstiges: 'purple',
}

const TYP_ITEMS: Array<{ value: BelegTyp | ''; label: string }> = [
  { value: '', label: 'Alle' },
  { value: 'rechnung', label: 'Rechnung' },
  { value: 'erstbescheid', label: 'Erstbescheid' },
  { value: 'widerspruchsbescheid', label: 'Widerspruchsbescheid' },
  { value: 'rezept', label: 'Rezept' },
  { value: 'ueberweisung', label: 'Überweisung' },
  { value: 'sonstiges', label: 'Sonstiges' },
]

type VerknuepftFilter = '' | 'ja' | 'nein'
type OcrFilter = '' | 'done' | 'pending'
type SortMode = 'neu' | 'datum_neu' | 'datum_alt' | 'az'
// '' | 'bh:{id}' | 'pkv:{id}'
type StelleFilter = string

const CARD_GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
  gap: 16,
}

// ── Zeitbasierte Gruppierung ────────────────────────────────────────────────
// Gruppiert wird passend zur aktiven Sortierung: bei Datums-Sortierungen
// (Hochgeladen/Belegdatum) nach relativen Zeiträumen, bei Name (A–Z) entfällt
// die Gruppierung vorerst.

function toLocalDate(value: string): Date {
  const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  if (isoDateOnly) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(value)
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function startOfWeek(d: Date): Date {
  const montagOffset = (d.getDay() + 6) % 7 // 0 = Montag dieser Woche
  const montag = new Date(d)
  montag.setDate(d.getDate() - montagOffset)
  return startOfDay(montag)
}

function zeitGruppenLabel(value: string, heute: Date): string {
  const datum = toLocalDate(value)
  if (isNaN(datum.getTime())) return 'Unbekannt'

  const tag = startOfDay(datum)
  const heuteTag = startOfDay(heute)
  const diffTage = Math.round((heuteTag.getTime() - tag.getTime()) / 86400000)

  if (diffTage <= 0) return 'Heute'
  if (diffTage === 1) return 'Gestern'

  const wocheHeute = startOfWeek(heute)
  if (tag >= wocheHeute) return 'Diese Woche'

  const wocheLetzte = new Date(wocheHeute)
  wocheLetzte.setDate(wocheHeute.getDate() - 7)
  if (tag >= wocheLetzte) return 'Letzte Woche'

  const monatHeute = new Date(heute.getFullYear(), heute.getMonth(), 1)
  if (tag >= monatHeute) return 'Dieser Monat'

  const monatLetzter = new Date(heute.getFullYear(), heute.getMonth() - 1, 1)
  if (tag >= monatLetzter) return 'Letzter Monat'

  return datum.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
}

// Belege sind bereits sortiert; gleiche Labels sind daher immer benachbart
// und können einfach zu Gruppen zusammengefasst werden (Reihenfolge bleibt erhalten).
function gruppiereBelege(belege: Beleg[], sort: SortMode): Array<{ label: string; items: Beleg[] }> | null {
  if (sort === 'az') return null

  const heute = new Date()
  const feld = sort === 'neu' ? (b: Beleg) => b.hochgeladen_am as string | null : (b: Beleg) => b.datum

  const gruppen: Array<{ label: string; items: Beleg[] }> = []
  for (const b of belege) {
    const wert = feld(b)
    const label = wert ? zeitGruppenLabel(wert, heute) : 'Ohne Datum'
    const letzte = gruppen[gruppen.length - 1]
    if (letzte && letzte.label === label) letzte.items.push(b)
    else gruppen.push({ label, items: [b] })
  }
  return gruppen
}

// ── Sidebar-Komponenten ────────────────────────────────────────────────────
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

function FilterRow({
  label, count, active, dot, onClick,
}: { label: string; count: number; active: boolean; dot?: string; onClick: () => void }) {
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
        <span style={{
          width: 8, height: 8, borderRadius: 3,
          background: dot, flexShrink: 0,
        }} />
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

export default function BelegePage() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [datumVon, setDatumVon] = useState('')
  const [datumBis, setDatumBis] = useState('')
  const [typFilter, setTypFilter] = useState<BelegTyp | ''>('')
  const [stelleFilter, setStelleFilter] = useState<StelleFilter>('')
  const [verknuepftFilter, setVerknuepftFilter] = useState<VerknuepftFilter>('')
  const [ocrFilter, setOcrFilter] = useState<OcrFilter>('')
  const [sort, setSort] = useState<SortMode>('neu')
  const [showUpload, setShowUpload] = useState(false)
  const [selectedBelegId, setSelectedBelegId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<BelegViewMode>(() =>
    (localStorage.getItem('belege_view_mode') as BelegViewMode) ?? 'cards'
  )

  const switchView = (mode: BelegViewMode) => {
    setViewMode(mode)
    localStorage.setItem('belege_view_mode', mode)
  }

  const dragCounterRef = useRef(0)
  const [pageDragOver, setPageDragOver] = useState(false)
  const [batchUploading, setBatchUploading] = useState(false)
  const [batchError, setBatchError] = useState<string | null>(null)

  const handlePageDragEnter = () => { dragCounterRef.current++; setPageDragOver(true) }
  const handlePageDragLeave = () => { dragCounterRef.current--; if (dragCounterRef.current === 0) setPageDragOver(false) }
  const handlePageDragOver = (e: React.DragEvent) => { e.preventDefault() }
  const handlePageDrop = async (e: React.DragEvent) => {
    e.preventDefault(); dragCounterRef.current = 0; setPageDragOver(false); setBatchError(null)
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf') || f.type.startsWith('image/')
    )
    if (files.length === 0) return
    setBatchUploading(true)
    let errors = 0
    for (const file of files) {
      try {
        let pdf: File
        if (file.type.startsWith('image/')) {
          const pdfBlob = await fileToGrayscalePdf(file)
          pdf = new File([pdfBlob], file.name.replace(/\.[^.]+$/, '.pdf'), { type: 'application/pdf' })
        } else { pdf = file }
        await uploadBeleg(pdf, undefined, { bezeichnung: file.name.replace(/\.[^.]+$/, '') })
      } catch { errors++ }
    }
    qc.invalidateQueries({ queryKey: ['belege'] })
    setBatchUploading(false)
    if (errors > 0) setBatchError(`${errors} Datei(en) konnten nicht hochgeladen werden`)
  }

  const { data: beihilfestellen = [] } = useQuery({ queryKey: ['beihilfestellen'], queryFn: getBeihilfestellen })
  const { data: pkvListe = [] } = useQuery({ queryKey: ['pkv'], queryFn: getPkv })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteBeleg(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['belege'] }),
  })

  const queryKey = ['belege', q, datumVon, datumBis]
  const { data: allBelege = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: () => getBelege({
      q: q || undefined,
      datum_von: datumVon || undefined,
      datum_bis: datumBis || undefined,
    }),
    refetchInterval: (query) => {
      const items = query.state.data as Beleg[] | undefined
      return items?.some(b => !b.has_thumbnail || b.ocr_status === null) ? 4000 : false
    },
  })

  // Facetten-Zählungen
  const baseForTypFacets = useMemo(() => allBelege.filter(b => {
    if (verknuepftFilter === 'ja' && b.linked_rechnungen.length === 0 && b.linked_antraege.length === 0) return false
    if (verknuepftFilter === 'nein' && (b.linked_rechnungen.length > 0 || b.linked_antraege.length > 0)) return false
    if (ocrFilter === 'done' && b.ocr_status !== 'done') return false
    if (ocrFilter === 'pending' && b.ocr_status !== null) return false
    return true
  }), [allBelege, verknuepftFilter, ocrFilter])

  const typCounts = useMemo(() => {
    const map: Record<string, number> = { '': baseForTypFacets.length }
    for (const b of baseForTypFacets) {
      const t = b.typ ?? 'sonstiges'
      map[t] = (map[t] ?? 0) + 1
    }
    return map
  }, [baseForTypFacets])

  const baseForVerknuepftFacets = useMemo(() => allBelege.filter(b => {
    if (typFilter && b.typ !== typFilter) return false
    if (ocrFilter === 'done' && b.ocr_status !== 'done') return false
    if (ocrFilter === 'pending' && b.ocr_status !== null) return false
    return true
  }), [allBelege, typFilter, ocrFilter])

  const verknuepftCounts = useMemo(() => ({
    alle: baseForVerknuepftFacets.length,
    ja: baseForVerknuepftFacets.filter(b => b.linked_rechnungen.length > 0 || b.linked_antraege.length > 0).length,
    nein: baseForVerknuepftFacets.filter(b => b.linked_rechnungen.length === 0 && b.linked_antraege.length === 0).length,
  }), [baseForVerknuepftFacets])

  const baseForOcrFacets = useMemo(() => allBelege.filter(b => {
    if (typFilter && b.typ !== typFilter) return false
    if (verknuepftFilter === 'ja' && b.linked_rechnungen.length === 0 && b.linked_antraege.length === 0) return false
    if (verknuepftFilter === 'nein' && (b.linked_rechnungen.length > 0 || b.linked_antraege.length > 0)) return false
    return true
  }), [allBelege, typFilter, verknuepftFilter])

  const ocrCounts = useMemo(() => ({
    alle: baseForOcrFacets.length,
    done: baseForOcrFacets.filter(b => b.ocr_status === 'done').length,
    pending: baseForOcrFacets.filter(b => b.ocr_status === null).length,
  }), [baseForOcrFacets])

  // Stelle-Facetten (welche Stellen kommen in den Belegen vor)
  const stelleCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const b of allBelege) {
      if (b.beihilfestelle_id) {
        const key = `bh:${b.beihilfestelle_id}`
        map[key] = (map[key] ?? 0) + 1
      }
      if (b.pkv_id) {
        const key = `pkv:${b.pkv_id}`
        map[key] = (map[key] ?? 0) + 1
      }
    }
    return map
  }, [allBelege])

  function matchesStelleFilter(b: Beleg): boolean {
    if (!stelleFilter) return true
    if (stelleFilter.startsWith('bh:')) return b.beihilfestelle_id === stelleFilter.slice(3)
    if (stelleFilter.startsWith('pkv:')) return b.pkv_id === stelleFilter.slice(4)
    return true
  }

  const belege = useMemo(() => {
    let list = allBelege.filter(b => {
      if (typFilter && b.typ !== typFilter) return false
      if (!matchesStelleFilter(b)) return false
      if (verknuepftFilter === 'ja' && b.linked_rechnungen.length === 0 && b.linked_antraege.length === 0) return false
      if (verknuepftFilter === 'nein' && (b.linked_rechnungen.length > 0 || b.linked_antraege.length > 0)) return false
      if (ocrFilter === 'done' && b.ocr_status !== 'done') return false
      if (ocrFilter === 'pending' && b.ocr_status !== null) return false
      return true
    })
    const copy = [...list]
    if (sort === 'datum_neu') return copy.sort((a, b) => {
      if (!a.datum && !b.datum) return 0
      if (!a.datum) return 1
      if (!b.datum) return -1
      return b.datum.localeCompare(a.datum)
    })
    if (sort === 'datum_alt') return copy.sort((a, b) => {
      if (!a.datum && !b.datum) return 0
      if (!a.datum) return 1
      if (!b.datum) return -1
      return a.datum.localeCompare(b.datum)
    })
    if (sort === 'az') return copy.sort((a, b) => (a.bezeichnung || a.dateiname).localeCompare(b.bezeichnung || b.dateiname, 'de'))
    return copy
  }, [allBelege, typFilter, verknuepftFilter, ocrFilter, sort])

  const grouped = useMemo(() => gruppiereBelege(belege, sort), [belege, sort])

  const hasActiveFilters = !!(typFilter || stelleFilter || verknuepftFilter || ocrFilter || datumVon || datumBis)

  const fieldStyle: React.CSSProperties = {
    background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 8,
    padding: '8px 12px', fontSize: 13, color: 'var(--text)',
    outline: 'none', boxSizing: 'border-box' as const,
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}
      onDragEnter={handlePageDragEnter}
      onDragLeave={handlePageDragLeave}
      onDragOver={handlePageDragOver}
      onDrop={handlePageDrop}
    >
      {/* Drag-Overlay */}
      {pageDragOver && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'var(--dropzone, color-mix(in srgb, var(--primary) 6%, transparent))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            border: '2px dashed var(--primary)', borderRadius: 20,
            padding: '48px 80px', background: 'var(--surface)',
            textAlign: 'center', boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
          }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>↓</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Dateien hier ablegen</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>PDF, JPG, PNG · automatische OCR-Erkennung</div>
          </div>
        </div>
      )}

      {batchUploading && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 200,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}>
          <span style={{ fontSize: 13, color: 'var(--text)' }}>Belege werden hochgeladen…</span>
        </div>
      )}
      {batchError && !batchUploading && (
        <div style={{ margin: '8px 24px 0', padding: '8px 12px', background: 'var(--rose-dim)', borderRadius: 7, fontSize: 12, color: 'var(--rose)' }}>
          {batchError}
          <button onClick={() => setBatchError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', fontWeight: 600, marginLeft: 6 }}>✕</button>
        </div>
      )}

      {/* Mobile Typ-Filter (Tab-Leiste) */}
      <div className="flex sm:hidden" style={{
        overflowX: 'auto', flexShrink: 0,
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
      }}>
        {TYP_ITEMS.map(f => (
          <button
            key={f.value}
            onClick={() => setTypFilter(f.value)}
            style={{
              minWidth: 'max-content', padding: '10px 14px',
              fontSize: 13, border: 'none', background: 'none', cursor: 'pointer',
              color: typFilter === f.value ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: `2px solid ${typFilter === f.value ? 'var(--primary)' : 'transparent'}`,
              fontWeight: typFilter === f.value ? 600 : 400,
              whiteSpace: 'nowrap',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Body: Sidebar + Main */}
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
              {TYP_ITEMS.map(f => (
                <FilterRow
                  key={f.value}
                  label={f.label}
                  count={typCounts[f.value] ?? 0}
                  active={typFilter === f.value}
                  dot={f.value ? `var(--${TYPE_TONE[f.value] ?? 'purple'})` : 'var(--primary)'}
                  onClick={() => setTypFilter(f.value)}
                />
              ))}
            </FilterGroup>

            {Object.keys(stelleCounts).length > 0 && (
              <FilterGroup title="Stelle">
                <FilterRow label="Alle" count={allBelege.length} active={stelleFilter === ''} dot="var(--primary)" onClick={() => setStelleFilter('')} />
                {beihilfestellen.filter(b => stelleCounts[`bh:${b.id}`] > 0).map(b => (
                  <FilterRow key={`bh:${b.id}`} label={b.name} count={stelleCounts[`bh:${b.id}`] ?? 0} active={stelleFilter === `bh:${b.id}`} dot="var(--blue)" onClick={() => setStelleFilter(`bh:${b.id}`)} />
                ))}
                {pkvListe.filter(p => stelleCounts[`pkv:${p.id}`] > 0).map(p => (
                  <FilterRow key={`pkv:${p.id}`} label={p.name} count={stelleCounts[`pkv:${p.id}`] ?? 0} active={stelleFilter === `pkv:${p.id}`} dot="var(--teal)" onClick={() => setStelleFilter(`pkv:${p.id}`)} />
                ))}
              </FilterGroup>
            )}

            <FilterGroup title="Verknüpfungen">
              <FilterRow label="Alle" count={verknuepftCounts.alle} active={verknuepftFilter === ''} dot="var(--primary)" onClick={() => setVerknuepftFilter('')} />
              <FilterRow label="Verknüpft" count={verknuepftCounts.ja} active={verknuepftFilter === 'ja'} dot="var(--green)" onClick={() => setVerknuepftFilter('ja')} />
              <FilterRow label="Ohne Verknüpfung" count={verknuepftCounts.nein} active={verknuepftFilter === 'nein'} dot="var(--amber)" onClick={() => setVerknuepftFilter('nein')} />
            </FilterGroup>

            <FilterGroup title="Texterkennung">
              <FilterRow label="Alle" count={ocrCounts.alle} active={ocrFilter === ''} dot="var(--primary)" onClick={() => setOcrFilter('')} />
              <FilterRow label="OCR abgeschlossen" count={ocrCounts.done} active={ocrFilter === 'done'} dot="var(--green)" onClick={() => setOcrFilter('done')} />
              <FilterRow label="Ausstehend" count={ocrCounts.pending} active={ocrFilter === 'pending'} dot="var(--amber)" onClick={() => setOcrFilter('pending')} />
            </FilterGroup>

            {/* Zeitraum */}
            <FilterGroup title="Belegdatum">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 4px' }}>
                <input type="date" value={datumVon} onChange={e => setDatumVon(e.target.value)}
                  placeholder="Von" style={{ ...fieldStyle, fontSize: 12, padding: '6px 10px' }} />
                <input type="date" value={datumBis} onChange={e => setDatumBis(e.target.value)}
                  placeholder="Bis" style={{ ...fieldStyle, fontSize: 12, padding: '6px 10px' }} />
                {(datumVon || datumBis) && (
                  <button onClick={() => { setDatumVon(''); setDatumBis('') }}
                    style={{ fontSize: 11, padding: '3px 0', background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', textAlign: 'left' }}>
                    ✕ Zeitraum zurücksetzen
                  </button>
                )}
              </div>
            </FilterGroup>

            {hasActiveFilters && (
              <button
                onClick={() => { setTypFilter(''); setVerknuepftFilter(''); setOcrFilter(''); setDatumVon(''); setDatumBis('') }}
                style={{
                  width: '100%', fontSize: 12, padding: '8px 10px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text-muted)', cursor: 'pointer', marginTop: 4,
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--row-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                ✕ Alle Filter zurücksetzen
              </button>
            )}
          </div>
        </div>

        {/* ── Hauptbereich ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

          {/* Toolbar */}
          <div style={{ padding: '16px 24px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14, gap: 16 }}>
              <div>
                <h1 style={{ fontSize: 21, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }}>Belege</h1>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                  Dokumentenarchiv · {belege.length} {belege.length === 1 ? 'Beleg' : 'Belege'}
                  {typFilter ? ` · ${TYP_ITEMS.find(t => t.value === typFilter)?.label}` : ''}
                </div>
              </div>
              <button
                onClick={() => setShowUpload(v => !v)}
                style={{
                  background: 'var(--primary)', color: '#fff', border: 'none',
                  borderRadius: 20, padding: '8px 18px', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                {showUpload ? '✕ Schließen' : '+ Beleg hochladen'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: 420 }}>
                <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)', fontSize: 13 }}>⌕</span>
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Suche nach Bezeichnung, Notiz…"
                  style={{ ...fieldStyle, paddingLeft: 30, width: '100%' }}
                />
              </div>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: 'var(--text-subtle)', whiteSpace: 'nowrap' }}>Sortieren:</span>
              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortMode)}
                style={{ ...fieldStyle, width: 'auto', fontSize: 12, padding: '7px 10px' }}
              >
                <option value="neu">Hochgeladen (neueste)</option>
                <option value="datum_neu">Belegdatum (neueste)</option>
                <option value="datum_alt">Belegdatum (älteste)</option>
                <option value="az">Name (A–Z)</option>
              </select>
              {/* Ansicht-Toggle */}
              <div className="hidden sm:flex" style={{ borderRadius: 7, overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
                <button
                  onClick={() => switchView('cards')}
                  title="Kartenansicht"
                  style={{ display: 'flex', alignItems: 'center', padding: '6px 9px', border: 'none', cursor: 'pointer', background: viewMode === 'cards' ? 'var(--surface-hi)' : 'transparent' }}
                >
                  <GridIcon active={viewMode === 'cards'} />
                </button>
                <button
                  onClick={() => switchView('table')}
                  title="Tabellenansicht"
                  style={{ display: 'flex', alignItems: 'center', padding: '6px 9px', border: 'none', borderLeft: '1px solid var(--border)', cursor: 'pointer', background: viewMode === 'table' ? 'var(--surface-hi)' : 'transparent' }}
                >
                  <TableIcon active={viewMode === 'table'} />
                </button>
              </div>
            </div>
          </div>

          {/* Upload-Panel */}
          {showUpload && (
            <div style={{ margin: '12px 24px 0', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', flexShrink: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px', color: 'var(--text)' }}>Neuer Beleg</p>
              <BelegeUpload
                queryKeys={[queryKey]}
                onUploaded={() => { setShowUpload(false); qc.invalidateQueries({ queryKey: ['belege'] }) }}
                onCancel={() => setShowUpload(false)}
              />
            </div>
          )}

          {/* Inhalt */}
          <div style={{ flex: 1, overflowY: 'auto', padding: viewMode === 'table' ? 0 : '18px 24px 32px' }}>
            {isLoading && (
              <p style={{ fontSize: 13, color: 'var(--text-subtle)', textAlign: 'center', padding: 40 }}>Lade…</p>
            )}
            {error && (
              <p style={{ fontSize: 13, color: 'var(--rose)', textAlign: 'center', padding: 20 }}>Fehler beim Laden der Belege</p>
            )}
            {!isLoading && !error && belege.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70%', gap: 10, color: 'var(--text-subtle)' }}>
                <div style={{ fontSize: 30, opacity: 0.4 }}>📄</div>
                <span style={{ fontSize: 13 }}>
                  {q || hasActiveFilters ? 'Keine Belege gefunden' : 'Noch keine Belege – Drag & Drop oder „Beleg hochladen"'}
                </span>
              </div>
            )}

            {/* ── Karten-Ansicht ── */}
            {!isLoading && belege.length > 0 && viewMode === 'cards' && (
              grouped ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
                  {grouped.map(g => (
                    <div key={g.label}>
                      <div style={{
                        fontSize: 11, fontWeight: 700, color: 'var(--text-subtle)',
                        letterSpacing: '0.05em', textTransform: 'uppercase',
                        marginBottom: 10, paddingBottom: 6,
                        borderBottom: '1px solid var(--border)',
                      }}>
                        {g.label}
                      </div>
                      <div style={CARD_GRID_STYLE}>
                        {g.items.map(b => (
                          <BelegCard
                            key={b.id}
                            beleg={b}
                            selected={selectedBelegId === b.id}
                            onOpenDetail={setSelectedBelegId}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={CARD_GRID_STYLE}>
                  {belege.map(b => (
                    <BelegCard
                      key={b.id}
                      beleg={b}
                      selected={selectedBelegId === b.id}
                      onOpenDetail={setSelectedBelegId}
                    />
                  ))}
                </div>
              )
            )}

            {/* ── Tabellen-Ansicht ── */}
            {!isLoading && belege.length > 0 && viewMode === 'table' && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-alt)' }}>
                    {(['BEZEICHNUNG', 'TYP', 'BELEGDATUM', 'HOCHGELADEN', 'GRÖSSE', 'OCR', 'VERKNÜPFT', ''] as const).map(h => (
                      <th key={h} style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', textAlign: h === '' ? 'right' : 'left', userSelect: 'none' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {belege.map(b => {
                    const linkedCount = b.linked_rechnungen.length + b.linked_antraege.length
                    const displayName = b.bezeichnung || b.dateiname
                    return (
                      <tr
                        key={b.id}
                        onClick={() => setSelectedBelegId(b.id)}
                        style={{ cursor: 'pointer', borderBottom: '1px solid var(--row-border)', background: selectedBelegId === b.id ? 'var(--row-active)' : 'transparent', borderLeft: selectedBelegId === b.id ? '2px solid var(--primary)' : '2px solid transparent', transition: 'background 0.1s' }}
                        className="table-row-hover"
                      >
                        <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text)', fontWeight: 500, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={displayName}>
                          {displayName}
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          {b.typ ? (
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: `var(--${({rechnung:'amber',erstbescheid:'teal',widerspruchsbescheid:'rose',rezept:'green',ueberweisung:'blue',sonstiges:'purple'} as Record<string,string>)[b.typ] ?? 'purple'}-dim)`, color: `var(--${({rechnung:'amber',erstbescheid:'teal',widerspruchsbescheid:'rose',rezept:'green',ueberweisung:'blue',sonstiges:'purple'} as Record<string,string>)[b.typ] ?? 'purple'})` }}>
                              {TYP_LABELS[b.typ]}
                            </span>
                          ) : <span style={{ color: 'var(--text-subtle)', fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                          {b.datum ? b.datum.split('-').reverse().join('.') : '—'}
                        </td>
                        <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                          {b.hochgeladen_am ? new Date(b.hochgeladen_am).toLocaleDateString('de-DE') : '—'}
                        </td>
                        <td style={{ padding: '9px 12px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                          {formatBytes(b.groesse)}
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: b.ocr_status === 'done' ? 'var(--green)' : 'var(--text-subtle)' }}>
                            {b.ocr_status === 'done' ? 'OCR ✓' : b.ocr_status === null ? '○' : '—'}
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          {linkedCount > 0 ? (
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', background: 'var(--green-dim)', padding: '2px 7px', borderRadius: 10 }}>⛓ {linkedCount}</span>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)', background: 'var(--amber-dim)', padding: '2px 7px', borderRadius: 10 }}>frei</span>
                          )}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                          <button
                            onClick={e => { e.stopPropagation(); if (confirm(`„${displayName}" löschen?`)) deleteMut.mutate(b.id) }}
                            title="Löschen"
                            style={{ padding: '3px 7px', fontSize: 11, borderRadius: 5, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--rose)' }}
                          >×</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <BelegDetailSlider
        belegId={selectedBelegId}
        onClose={() => setSelectedBelegId(null)}
      />
    </div>
  )
}
