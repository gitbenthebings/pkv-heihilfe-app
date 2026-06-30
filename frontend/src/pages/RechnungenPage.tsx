import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import { useJahr } from '../context/JahrContext'
import { getRechnungen, createRechnung, deleteRechnung, bulkAction } from '../api/rechnungen'
import { getPersonen } from '../api/personen'
import { getCorrespondents } from '../api/correspondents'
import { getConfig } from '../api/config'
import { exportRechnungen } from '../api/export'
import { getAntraege, addRechnung } from '../api/beihilfe_antraege'
import RechnungenTable from '../components/RechnungenTable'
import BulkActionBar from '../components/BulkActionBar'
import RechnungForm from '../components/RechnungForm'
import RechnungDetailSlider from '../components/RechnungDetailSlider'
import { useToast } from '../context/ToastContext'
import type { BulkAction, CreateRechnung, Rechnung } from '../types'
import type { ExportProvider, ExportResult } from '../api/export'

// ── Sidebar-Komponenten ──────────────────────────────────────────────────────

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: 'var(--text-subtle)',
        letterSpacing: '0.07em', textTransform: 'uppercase',
        marginBottom: 8, padding: '0 4px',
      }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{children}</div>
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
      {dot && <span style={{ width: 8, height: 8, borderRadius: 3, background: dot, flexShrink: 0, opacity: active ? 1 : 0.7 }} />}
      <span style={{ flex: 1, fontSize: 13, color: active ? 'var(--text)' : 'var(--text-muted)', fontWeight: active ? 600 : 400 }}>
        {label}
      </span>
      <span style={{
        fontSize: 11, color: 'var(--text-subtle)',
        background: active ? 'var(--surface-hi)' : 'transparent',
        borderRadius: 10, padding: '1px 7px', minWidth: 22, textAlign: 'center',
        fontVariantNumeric: 'tabular-nums',
      }}>{count}</span>
    </div>
  )
}

function MobileTab({ label, dot, active, onClick }: {
  label: string; dot?: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 14px', fontSize: 13, background: 'none', border: 'none',
        fontWeight: active ? 600 : 400,
        color: active ? 'var(--text)' : 'var(--text-muted)',
        borderBottom: `2px solid ${active ? 'var(--primary)' : 'transparent'}`,
        cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
      }}
    >
      {dot && <span style={{ width: 7, height: 7, borderRadius: 2, background: dot, flexShrink: 0, opacity: active ? 1 : 0.5 }} />}
      {label}
    </button>
  )
}

// ── Filter-Helpers ────────────────────────────────────────────────────────────

type TypFilter       = '' | 'arzt' | 'apotheke' | 'krankenhaus'
type ZahlungFilter   = '' | 'offen' | 'bezahlt'
type BeihilfeFilter  = '' | 'offen' | 'eingereicht' | 'beschieden' | 'keine'
type PkvFilter       = '' | 'offen' | 'eingereicht' | 'beschieden'

function applyFilters(
  list: Rechnung[],
  opts: { person?: string; typ?: TypFilter; zahlung?: ZahlungFilter; beihilfe?: BeihilfeFilter; pkv?: PkvFilter; corr?: string }
): Rechnung[] {
  return list.filter(r => {
    if (opts.person && r.person_id !== opts.person) return false
    if (opts.typ   && r.typ !== opts.typ) return false
    if (opts.zahlung && r.zahlung_status !== opts.zahlung) return false
    if (opts.beihilfe === 'keine') { if (r.beihilfe_status !== null) return false }
    else if (opts.beihilfe && r.beihilfe_status !== opts.beihilfe) return false
    if (opts.pkv   && r.pkv_status !== opts.pkv) return false
    if (opts.corr  && r.leistungserbringer_id !== opts.corr) return false
    return true
  })
}

// ── Seite ─────────────────────────────────────────────────────────────────────

export default function RechnungenPage() {
  const qc = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { jahr } = useJahr()
  const { showToast } = useToast()

  // Slider
  const sliderRechnungId = searchParams.get('rechnung')
  const openSlider  = (id: string) => setSearchParams(p => { p.set('rechnung', id); return p })
  const closeSlider = () => setSearchParams(p => { p.delete('rechnung'); return p })

  // Ansicht
  const [archivModus, setArchivModus] = useState(false)
  const [showForm,    setShowForm]    = useState(false)
  const [exporting,   setExporting]   = useState(false)
  const [exportResult, setExportResult] = useState<ExportResult | null>(null)

  const kopieVonState = (location.state as { kopieVon?: Rechnung } | null)?.kopieVon ?? null
  const [kopieVon, setKopieVon] = useState<Rechnung | null>(kopieVonState)

  // Sidebar-Filter
  const [personFilter, setPersonFilter] = useState<string>('')
  const [typFilter,    setTypFilter]    = useState<TypFilter>('')
  const [zahlungFilter, setZahlungFilter] = useState<ZahlungFilter>('')
  const [beihilfeFilter, setBeihilfeFilter] = useState<BeihilfeFilter>('')
  const [pkvFilter,    setPkvFilter]    = useState<PkvFilter>('')
  const [corrFilter,   setCorrFilter]   = useState<string>('')

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: rechnungen = [], isLoading, error } = useQuery({
    queryKey: ['rechnungen', archivModus, archivModus ? undefined : jahr],
    queryFn: () => getRechnungen(undefined, archivModus, archivModus ? undefined : jahr),
    refetchInterval: (query) => {
      if (!archivModus || !config?.paperless_ngx_url) return false
      const data = query.state.data ?? []
      return data.some((r: Rechnung) => r.archiviert_am && !r.paperless_uebertragen_am) ? 5000 : false
    },
  })

  const { data: personen = [] }      = useQuery({ queryKey: ['personen'],      queryFn: getPersonen })
  const { data: correspondents = [] } = useQuery({ queryKey: ['correspondents'], queryFn: getCorrespondents })
  const { data: config }             = useQuery({ queryKey: ['config'],         queryFn: getConfig, staleTime: Infinity })
  const { data: alleAntraege = [] }  = useQuery({ queryKey: ['antraege'],       queryFn: () => getAntraege() })
  const aktiveAntraege = alleAntraege.filter(a => a.status !== 'archiviert')

  // ── Client-seitige Filter ────────────────────────────────────────────────────

  const allFilters = { person: personFilter || undefined, typ: typFilter || undefined, zahlung: zahlungFilter || undefined, beihilfe: beihilfeFilter || undefined, pkv: pkvFilter || undefined, corr: corrFilter || undefined } as const

  const filteredRechnungen = useMemo(() =>
    applyFilters(rechnungen, allFilters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rechnungen, personFilter, typFilter, zahlungFilter, beihilfeFilter, pkvFilter, corrFilter]
  )

  // Cross-faceted counts: jede Dimension zählt aus den ohne-eigenen-Filter-gefilterten Daten
  const facets = useMemo(() => {
    const without = (omit: keyof typeof allFilters) => {
      const f = { ...allFilters, [omit]: undefined }
      return applyFilters(rechnungen, f)
    }

    const countBy = <T extends string>(list: Rechnung[], fn: (r: Rechnung) => T | null) => {
      const m: Record<string, number> = { '': list.length }
      for (const r of list) { const v = fn(r); if (v != null) m[v] = (m[v] ?? 0) + 1 }
      return m
    }

    const forPerson    = without('person')
    const forTyp       = without('typ')
    const forZahlung   = without('zahlung')
    const forBeihilfe  = without('beihilfe')
    const forPkv       = without('pkv')
    const forCorr      = without('corr')

    const personCounts  = countBy(forPerson, r => r.person_id)
    const typCounts     = countBy(forTyp, r => r.typ)
    const zahlungCounts = countBy(forZahlung, r => r.zahlung_status)
    const beihilfeCounts: Record<string, number> = { '': forBeihilfe.length }
    for (const r of forBeihilfe) {
      const k = r.beihilfe_status ?? 'keine'
      beihilfeCounts[k] = (beihilfeCounts[k] ?? 0) + 1
    }
    const pkvCounts  = countBy(forPkv, r => r.pkv_status)
    const corrCounts = countBy(forCorr, r => r.leistungserbringer_id)

    return { personCounts, typCounts, zahlungCounts, beihilfeCounts, pkvCounts, corrCounts }
  }, [rechnungen, personFilter, typFilter, zahlungFilter, beihilfeFilter, pkvFilter, corrFilter])

  const aktiveCorrIds    = useMemo(() => new Set(rechnungen.map(r => r.leistungserbringer_id)), [rechnungen])
  const aktivPersonenIds = useMemo(() => new Set(rechnungen.map(r => r.person_id)), [rechnungen])

  const hasActiveFilters = !!(personFilter || typFilter || zahlungFilter || beihilfeFilter || pkvFilter || corrFilter)

  const resetFilters = () => {
    setPersonFilter(''); setTypFilter(''); setZahlungFilter('')
    setBeihilfeFilter(''); setPkvFilter(''); setCorrFilter('')
  }

  // ── Mutationen ───────────────────────────────────────────────────────────────

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['rechnungen'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const createMutation = useMutation({
    mutationFn: (data: CreateRechnung) => createRechnung(data),
    onSuccess: () => { invalidate(); setShowForm(false); setKopieVon(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRechnung(id),
    onSuccess: (_, id) => {
      setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s })
      invalidate()
    },
  })

  const bulkMutation = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: BulkAction }) => bulkAction(ids, action),
    onSuccess: () => { setSelectedIds(new Set()); invalidate() },
  })

  const antragAddMutation = useMutation({
    mutationFn: async ({ antragId, ids }: { antragId: string; ids: string[] }) => {
      const results = await Promise.allSettled(ids.map(id => addRechnung(antragId, id)))
      const failed = results.filter(r => r.status === 'rejected').length
      if (failed > 0) throw new Error(`${failed} Rechnung${failed !== 1 ? 'en' : ''} konnten nicht hinzugefügt werden`)
      return ids.length - failed
    },
    onSuccess: (added) => {
      showToast(`${added} Rechnung${added !== 1 ? 'en' : ''} zum Antrag hinzugefügt`)
      setSelectedIds(new Set())
      qc.invalidateQueries({ queryKey: ['antragRechnungen'] })
      qc.invalidateQueries({ queryKey: ['antraege'] })
    },
    onError: (e: Error) => showToast(e.message),
  })

  // ── Event-Handler ─────────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  const toggleAll = () => {
    if (filteredRechnungen.every(r => selectedIds.has(r.id))) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredRechnungen.map(r => r.id)))
    }
  }

  const handleBulkAction   = (action: BulkAction) => bulkMutation.mutate({ ids: Array.from(selectedIds), action })
  const handleAntragHinzufuegen = (antragId: string) => antragAddMutation.mutate({ antragId, ids: Array.from(selectedIds) })

  const handleExport = async (provider: ExportProvider) => {
    setExporting(true); setExportResult(null)
    try {
      setExportResult(await exportRechnungen(Array.from(selectedIds), provider))
    } catch {
      setExportResult({ provider, exported_files: 0, skipped_invoices: 0, directory: null, folder_url: null })
    } finally {
      setExporting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Rechnung wirklich löschen?')) return
    deleteMutation.mutate(id)
  }

  const handleArchivToggle = async (id: string, archivieren: boolean) => {
    await bulkMutation.mutateAsync({ ids: [id], action: archivieren ? 'archivieren' : 'dearchivieren' })
  }

  const switchModus = (archiv: boolean) => {
    setArchivModus(archiv)
    setSelectedIds(new Set())
    resetFilters()
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Mobile: Person-Tabs */}
      {personen.filter(p => aktivPersonenIds.has(p.id)).length > 1 && (
        <div className="flex sm:hidden" style={{
          overflowX: 'auto', flexShrink: 0,
          borderBottom: '1px solid var(--border)', background: 'var(--surface)',
        }}>
          <div style={{ display: 'flex', padding: '0 4px', minWidth: 'max-content' }}>
            <MobileTab label="Alle" active={!personFilter} onClick={() => setPersonFilter('')} />
            {personen.filter(p => aktivPersonenIds.has(p.id)).map(p => (
              <MobileTab key={p.id} label={p.name} dot="var(--blue)" active={personFilter === p.id} onClick={() => setPersonFilter(p.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Mobile: Typ-Tabs */}
      <div className="flex sm:hidden" style={{
        overflowX: 'auto', flexShrink: 0,
        borderBottom: '1px solid var(--border)', background: 'var(--surface)',
      }}>
        <div style={{ display: 'flex', padding: '0 4px', minWidth: 'max-content' }}>
          {([
            { value: '', label: 'Alle', dot: undefined },
            { value: 'arzt', label: 'Arzt', dot: 'var(--blue)' },
            { value: 'apotheke', label: 'Apotheke', dot: 'var(--green)' },
            { value: 'krankenhaus', label: 'Krankenhaus', dot: 'var(--rose)' },
          ] as const).map(f => (
            <MobileTab key={f.value} label={f.label} dot={f.dot} active={typFilter === f.value} onClick={() => setTypFilter(f.value)} />
          ))}
        </div>
      </div>

      {/* Body: Sidebar + Hauptbereich */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* ── Desktop-Sidebar ── */}
        <div className="hidden sm:flex" style={{
          width: 220, minWidth: 220, flexShrink: 0,
          borderRight: '1px solid var(--border)',
          background: 'var(--surface)',
          flexDirection: 'column', overflowY: 'auto',
        }}>
          <div style={{ padding: '18px 14px 8px' }}>

            {/* Person */}
            {personen.filter(p => aktivPersonenIds.has(p.id)).length > 0 && (
              <FilterGroup title="Person">
                <FilterRow label="Alle" count={facets.personCounts[''] ?? 0} active={!personFilter} dot="var(--primary)" onClick={() => setPersonFilter('')} />
                {personen.filter(p => aktivPersonenIds.has(p.id)).map(p => (
                  <FilterRow key={p.id} label={p.name} count={facets.personCounts[p.id] ?? 0} active={personFilter === p.id} dot="var(--blue)" onClick={() => setPersonFilter(p.id)} />
                ))}
              </FilterGroup>
            )}

            {/* Typ */}
            <FilterGroup title="Typ">
              <FilterRow label="Alle" count={facets.typCounts[''] ?? 0} active={!typFilter} dot="var(--primary)" onClick={() => setTypFilter('')} />
              <FilterRow label="Arzt" count={facets.typCounts['arzt'] ?? 0} active={typFilter === 'arzt'} dot="var(--blue)" onClick={() => setTypFilter('arzt')} />
              <FilterRow label="Apotheke" count={facets.typCounts['apotheke'] ?? 0} active={typFilter === 'apotheke'} dot="var(--green)" onClick={() => setTypFilter('apotheke')} />
              <FilterRow label="Krankenhaus" count={facets.typCounts['krankenhaus'] ?? 0} active={typFilter === 'krankenhaus'} dot="var(--rose)" onClick={() => setTypFilter('krankenhaus')} />
            </FilterGroup>

            {/* Zahlung */}
            <FilterGroup title="Zahlung">
              <FilterRow label="Alle" count={facets.zahlungCounts[''] ?? 0} active={!zahlungFilter} dot="var(--primary)" onClick={() => setZahlungFilter('')} />
              <FilterRow label="Offen" count={facets.zahlungCounts['offen'] ?? 0} active={zahlungFilter === 'offen'} dot="var(--amber)" onClick={() => setZahlungFilter('offen')} />
              <FilterRow label="Bezahlt" count={facets.zahlungCounts['bezahlt'] ?? 0} active={zahlungFilter === 'bezahlt'} dot="var(--green)" onClick={() => setZahlungFilter('bezahlt')} />
            </FilterGroup>

            {/* Beihilfe */}
            <FilterGroup title="Beihilfe">
              <FilterRow label="Alle" count={facets.beihilfeCounts[''] ?? 0} active={!beihilfeFilter} dot="var(--primary)" onClick={() => setBeihilfeFilter('')} />
              <FilterRow label="Offen" count={facets.beihilfeCounts['offen'] ?? 0} active={beihilfeFilter === 'offen'} dot="var(--amber)" onClick={() => setBeihilfeFilter('offen')} />
              <FilterRow label="Eingereicht" count={facets.beihilfeCounts['eingereicht'] ?? 0} active={beihilfeFilter === 'eingereicht'} dot="var(--blue)" onClick={() => setBeihilfeFilter('eingereicht')} />
              <FilterRow label="Beschieden" count={facets.beihilfeCounts['beschieden'] ?? 0} active={beihilfeFilter === 'beschieden'} dot="var(--green)" onClick={() => setBeihilfeFilter('beschieden')} />
              {(facets.beihilfeCounts['keine'] ?? 0) > 0 && (
                <FilterRow label="Keine BH" count={facets.beihilfeCounts['keine'] ?? 0} active={beihilfeFilter === 'keine'} dot="var(--text-subtle)" onClick={() => setBeihilfeFilter('keine')} />
              )}
            </FilterGroup>

            {/* PKV */}
            <FilterGroup title="PKV">
              <FilterRow label="Alle" count={facets.pkvCounts[''] ?? 0} active={!pkvFilter} dot="var(--primary)" onClick={() => setPkvFilter('')} />
              <FilterRow label="Offen" count={facets.pkvCounts['offen'] ?? 0} active={pkvFilter === 'offen'} dot="var(--amber)" onClick={() => setPkvFilter('offen')} />
              <FilterRow label="Eingereicht" count={facets.pkvCounts['eingereicht'] ?? 0} active={pkvFilter === 'eingereicht'} dot="var(--teal)" onClick={() => setPkvFilter('eingereicht')} />
              <FilterRow label="Beschieden" count={facets.pkvCounts['beschieden'] ?? 0} active={pkvFilter === 'beschieden'} dot="var(--green)" onClick={() => setPkvFilter('beschieden')} />
            </FilterGroup>

            {/* Leistungserbringer */}
            {aktiveCorrIds.size > 1 && (
              <FilterGroup title="Leistungserbringer">
                <FilterRow label="Alle" count={facets.corrCounts[''] ?? 0} active={!corrFilter} dot="var(--primary)" onClick={() => setCorrFilter('')} />
                {correspondents.filter(c => aktiveCorrIds.has(c.id) && (facets.corrCounts[c.id] ?? 0) > 0).map(c => (
                  <FilterRow key={c.id} label={c.name} count={facets.corrCounts[c.id] ?? 0} active={corrFilter === c.id} dot="var(--purple)" onClick={() => setCorrFilter(c.id)} />
                ))}
              </FilterGroup>
            )}

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
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
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', margin: 0 }}>Rechnungen</h1>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {filteredRechnungen.length}{rechnungen.length !== filteredRechnungen.length ? ` von ${rechnungen.length}` : ''} Rechnungen
                  {hasActiveFilters && ' · gefiltert'}
                  {archivModus && ' · Archiv'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {/* Archiv-Toggle */}
                <div style={{ display: 'flex', borderRadius: 7, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <button onClick={() => switchModus(false)}
                    style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, background: !archivModus ? 'var(--primary)' : 'var(--surface)', color: !archivModus ? '#fff' : 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>
                    Aktiv
                  </button>
                  <button onClick={() => switchModus(true)}
                    style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, background: archivModus ? 'var(--amber)' : 'var(--surface)', color: archivModus ? '#fff' : 'var(--text-muted)', border: 'none', borderLeft: '1px solid var(--border)', cursor: 'pointer' }}>
                    Archiv
                  </button>
                </div>
                {!archivModus && (
                  <button
                    onClick={() => setShowForm(s => !s)}
                    style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, background: showForm ? 'var(--surface-hi)' : 'var(--primary)', color: showForm ? 'var(--text-muted)' : '#fff', border: showForm ? '1px solid var(--border)' : 'none', borderRadius: 7, cursor: 'pointer' }}>
                    {showForm ? 'Abbrechen' : '+ Neue Rechnung'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Formular */}
          {showForm && !archivModus && personen.length > 0 && correspondents.length > 0 && (
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
              <RechnungForm
                personen={personen}
                correspondents={correspondents}
                initialValues={kopieVon ? {
                  person_id: kopieVon.person_id,
                  leistungserbringer_id: kopieVon.leistungserbringer_id,
                  typ: kopieVon.typ,
                  betrag: kopieVon.betrag,
                } : undefined}
                onSubmit={(data) => createMutation.mutateAsync(data).then(() => {})}
                onCancel={() => { setShowForm(false); setKopieVon(null); navigate(location.pathname, { replace: true, state: null }) }}
              />
            </div>
          )}

          {/* Export-Ergebnis */}
          {exportResult && (
            <div style={{ margin: '8px 20px 0', flexShrink: 0 }}
              className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
                exportResult.exported_files > 0
                  ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-700 text-teal-800 dark:text-teal-200'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300'
              }`}
            >
              <span>
                {exportResult.exported_files > 0 ? (
                  <>
                    {exportResult.exported_files} Datei{exportResult.exported_files !== 1 ? 'en' : ''} exportiert
                    {exportResult.directory && <> → <code className="font-mono text-xs">/exports/{exportResult.directory}</code></>}
                    {exportResult.folder_url && <> → <a href={exportResult.folder_url} target="_blank" rel="noreferrer" className="underline">Google Drive öffnen</a></>}
                    {exportResult.skipped_invoices > 0 && <> ({exportResult.skipped_invoices} ohne Anhang übersprungen)</>}
                  </>
                ) : 'Export fehlgeschlagen oder keine Anhänge vorhanden.'}
              </span>
              <button onClick={() => setExportResult(null)} className="shrink-0 opacity-60 hover:opacity-100">×</button>
            </div>
          )}

          {/* Archiv-Banner */}
          {archivModus && (
            <div style={{ padding: '6px 20px', background: 'color-mix(in srgb, var(--amber) 8%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--amber) 20%, transparent)', flexShrink: 0 }}>
              <p style={{ fontSize: 11, color: 'var(--amber)', margin: 0 }}>Archivierte Rechnungen – erscheinen nicht im Dashboard</p>
            </div>
          )}

          {/* Lade/Fehler */}
          {isLoading && <p style={{ padding: '16px 20px', fontSize: 13, color: 'var(--text-muted)' }}>Lade Rechnungen…</p>}
          {error && <p style={{ padding: '16px 20px', fontSize: 13, color: 'var(--rose)' }}>Fehler: {(error as Error).message}</p>}

          {/* Tabelle / Karten */}
          {!isLoading && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{ background: 'var(--surface)', minHeight: '100%' }}>
                <RechnungenTable
                  rechnungen={filteredRechnungen}
                  personen={personen}
                  correspondents={correspondents}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onToggleAll={toggleAll}
                  onDelete={handleDelete}
                  onArchivToggle={handleArchivToggle}
                  onOpenSlider={openSlider}
                  archivModus={archivModus}
                  paperlessNgxUrl={config?.paperless_ngx_url}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Overlays */}
      <RechnungDetailSlider
        rechnungId={sliderRechnungId}
        onClose={closeSlider}
        onUpdate={() => qc.invalidateQueries({ queryKey: ['rechnungen'] })}
        onKopieren={(r) => { setKopieVon(r); setShowForm(true); closeSlider() }}
      />

      <BulkActionBar
        count={selectedIds.size}
        onAction={handleBulkAction}
        onExport={handleExport}
        onClear={() => setSelectedIds(new Set())}
        loading={bulkMutation.isPending}
        exporting={exporting}
        archivModus={archivModus}
        gdriveConfigured={config?.gdrive_configured}
        antraege={aktiveAntraege}
        onAntragHinzufuegen={handleAntragHinzufuegen}
        antragAddPending={antragAddMutation.isPending}
      />
    </div>
  )
}
