import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getRechnungen, createRechnung, updateRechnung, deleteRechnung, bulkAction } from '../api/rechnungen'
import { getPersonen } from '../api/personen'
import { getCorrespondents } from '../api/correspondents'
import { getConfig } from '../api/config'
import { exportRechnungen } from '../api/export'
import RechnungenTable from '../components/RechnungenTable'
import PersonFilter from '../components/PersonFilter'
import BulkActionBar from '../components/BulkActionBar'
import RechnungForm from '../components/RechnungForm'
import type { BulkAction, CreateRechnung, UpdateRechnung } from '../types'
import type { ExportProvider, ExportResult } from '../api/export'

export default function RechnungenPage() {
  const qc = useQueryClient()
  const [selectedPersonId, setSelectedPersonId] = useState<string | undefined>()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [archivModus, setArchivModus] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportResult, setExportResult] = useState<ExportResult | null>(null)

  const { data: rechnungen = [], isLoading, error } = useQuery({
    queryKey: ['rechnungen', selectedPersonId, archivModus],
    queryFn: () => getRechnungen(selectedPersonId, archivModus),
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

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['rechnungen'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const createMutation = useMutation({
    mutationFn: (data: CreateRechnung) => createRechnung(data),
    onSuccess: () => { invalidate(); setShowForm(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRechnung }) => updateRechnung(id, data),
    onSuccess: invalidate,
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

  const handleUpdate = async (id: string, data: UpdateRechnung) => {
    await updateMutation.mutateAsync({ id, data })
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
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Rechnungen</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <PersonFilter
            personen={personen}
            selectedId={selectedPersonId}
            onChange={setSelectedPersonId}
          />
          {/* Archiv-Toggle */}
          <div className="flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-600 text-sm">
            <button
              onClick={() => switchModus(false)}
              className={`px-3 py-2 sm:py-1.5 ${!archivModus
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              Aktiv
            </button>
            <button
              onClick={() => switchModus(true)}
              className={`px-3 py-2 sm:py-1.5 border-l border-gray-300 dark:border-gray-600 ${archivModus
                ? 'bg-amber-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
            >
              Archiv
            </button>
          </div>
          {!archivModus && (
            <button
              onClick={() => setShowForm(s => !s)}
              className="px-4 py-2 sm:py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
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
          onSubmit={(data) => createMutation.mutateAsync(data).then(() => {})}
          onCancel={() => setShowForm(false)}
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
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
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
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onArchivToggle={handleArchivToggle}
            archivModus={archivModus}
            paperlessNgxUrl={config?.paperless_ngx_url}
          />
        </div>
      )}

      <BulkActionBar
        count={selectedIds.size}
        onAction={handleBulkAction}
        onExport={handleExport}
        onClear={() => setSelectedIds(new Set())}
        loading={bulkMutation.isPending}
        exporting={exporting}
        archivModus={archivModus}
        gdriveConfigured={config?.gdrive_configured}
      />
    </div>
  )
}
