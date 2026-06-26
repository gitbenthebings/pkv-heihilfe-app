import { useState } from 'react'
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
import PersonFilter from '../components/PersonFilter'
import BulkActionBar from '../components/BulkActionBar'
import RechnungForm from '../components/RechnungForm'
import RechnungDetailSlider from '../components/RechnungDetailSlider'
import { useToast } from '../context/ToastContext'
import type { BulkAction, CreateRechnung, Rechnung } from '../types'
import type { ExportProvider, ExportResult } from '../api/export'

export default function RechnungenPage() {
  const qc = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { jahr } = useJahr()
  const { showToast } = useToast()
  const [selectedPersonId, setSelectedPersonId] = useState<string | undefined>()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const kopieVonState = (location.state as { kopieVon?: Rechnung } | null)?.kopieVon ?? null
  const [kopieVon, setKopieVon] = useState<Rechnung | null>(kopieVonState)
  const [showForm, setShowForm] = useState(kopieVonState !== null)
  const [archivModus, setArchivModus] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportResult, setExportResult] = useState<ExportResult | null>(null)

  const sliderRechnungId = searchParams.get('rechnung')

  const openSlider = (id: string) => {
    setSearchParams(p => { p.set('rechnung', id); return p })
  }

  const closeSlider = () => {
    setSearchParams(p => { p.delete('rechnung'); return p })
  }

  const { data: rechnungen = [], isLoading, error } = useQuery({
    queryKey: ['rechnungen', selectedPersonId, archivModus, archivModus ? undefined : jahr],
    queryFn: () => getRechnungen(selectedPersonId, archivModus, archivModus ? undefined : jahr),
    refetchInterval: (query) => {
      if (!archivModus || !config?.paperless_ngx_url) return false
      const data = query.state.data ?? []
      const hatAusstehend = data.some(r => r.archiviert_am && !r.paperless_uebertragen_am)
      return hatAusstehend ? 5000 : false
    },
  })

  const { data: personen = [] } = useQuery({ queryKey: ['personen'], queryFn: getPersonen })
  const { data: correspondents = [] } = useQuery({ queryKey: ['correspondents'], queryFn: getCorrespondents })
  const { data: config } = useQuery({ queryKey: ['config'], queryFn: getConfig, staleTime: Infinity })
  const { data: alleAntraege = [] } = useQuery({ queryKey: ['antraege'], queryFn: () => getAntraege() })
  const aktiveAntraege = alleAntraege.filter(a => a.status !== 'archiviert')

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

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      return s
    })
  }

  const toggleAll = () => {
    if (rechnungen.every(r => selectedIds.has(r.id))) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(rechnungen.map(r => r.id)))
    }
  }

  const handleBulkAction = (action: BulkAction) => {
    bulkMutation.mutate({ ids: Array.from(selectedIds), action })
  }

  const handleAntragHinzufuegen = (antragId: string) => {
    antragAddMutation.mutate({ antragId, ids: Array.from(selectedIds) })
  }

  const handleExport = async (provider: ExportProvider) => {
    setExporting(true)
    setExportResult(null)
    try {
      const result = await exportRechnungen(Array.from(selectedIds), provider)
      setExportResult(result)
    } catch (e) {
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
    await bulkMutation.mutateAsync({
      ids: [id],
      action: archivieren ? 'archivieren' : 'dearchivieren',
    })
  }

  const switchModus = (archiv: boolean) => {
    setArchivModus(archiv)
    setSelectedIds(new Set())
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>Rechnungen</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <PersonFilter
            personen={personen}
            selectedId={selectedPersonId}
            onChange={setSelectedPersonId}
          />
          {/* Archiv-Toggle */}
          <div style={{ display: 'flex', borderRadius: 7, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <button
              onClick={() => switchModus(false)}
              style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, background: !archivModus ? 'var(--primary)' : 'var(--surface)', color: !archivModus ? '#fff' : 'var(--text-muted)', border: 'none', cursor: 'pointer' }}
            >
              Aktiv
            </button>
            <button
              onClick={() => switchModus(true)}
              style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, background: archivModus ? 'var(--amber)' : 'var(--surface)', color: archivModus ? '#fff' : 'var(--text-muted)', border: 'none', borderLeft: '1px solid var(--border)', cursor: 'pointer' }}
            >
              Archiv
            </button>
          </div>
          {!archivModus && (
            <button
              onClick={() => setShowForm(s => !s)}
              style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, background: showForm ? 'var(--surface-hi)' : 'var(--primary)', color: showForm ? 'var(--text-muted)' : '#fff', border: showForm ? '1px solid var(--border)' : 'none', borderRadius: 7, cursor: 'pointer' }}
            >
              {showForm ? 'Abbrechen' : '+ Neue Rechnung'}
            </button>
          )}
        </div>
      </div>

      {showForm && !archivModus && personen.length > 0 && correspondents.length > 0 && (
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
      )}

      {exportResult && (
        <div className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
          exportResult.exported_files > 0
            ? 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-700 text-teal-800 dark:text-teal-200'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-700 dark:text-red-300'
        }`}>
          <span>
            {exportResult.exported_files > 0 ? (
              <>
                {exportResult.exported_files} Datei{exportResult.exported_files !== 1 ? 'en' : ''} exportiert
                {exportResult.directory && <> → <code className="font-mono text-xs">/exports/{exportResult.directory}</code></>}
                {exportResult.folder_url && (
                  <> → <a href={exportResult.folder_url} target="_blank" rel="noreferrer"
                    className="underline">Google Drive öffnen</a></>
                )}
                {exportResult.skipped_invoices > 0 && <> ({exportResult.skipped_invoices} ohne Anhang übersprungen)</>}
              </>
            ) : (
              'Export fehlgeschlagen oder keine Anhänge vorhanden.'
            )}
          </span>
          <button onClick={() => setExportResult(null)} className="shrink-0 opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      {isLoading && <p className="text-gray-500 dark:text-gray-400 text-sm">Lade Rechnungen...</p>}
      {error && <p className="text-red-600 dark:text-red-400 text-sm">Fehler: {(error as Error).message}</p>}

      {!isLoading && (
        <div style={{ background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {archivModus && (
            <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Archivierte Rechnungen – erscheinen nicht im Kanban-Board
              </p>
            </div>
          )}
          <RechnungenTable
            rechnungen={rechnungen}
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
      )}

      <RechnungDetailSlider
        rechnungId={sliderRechnungId}
        onClose={closeSlider}
        onUpdate={() => qc.invalidateQueries({ queryKey: ['rechnungen'] })}
        onKopieren={(r) => {
          setKopieVon(r)
          setShowForm(true)
          closeSlider()
        }}
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
