import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getRechnungen, createRechnung, updateRechnung, deleteRechnung, bulkAction } from '../api/rechnungen'
import { getPersonen } from '../api/personen'
import { getCorrespondents } from '../api/correspondents'
import RechnungenTable from '../components/RechnungenTable'
import PersonFilter from '../components/PersonFilter'
import BulkActionBar from '../components/BulkActionBar'
import RechnungForm from '../components/RechnungForm'
import type { BulkAction, CreateRechnung, UpdateRechnung } from '../types'

export default function RechnungenPage() {
  const qc = useQueryClient()
  const [selectedPersonId, setSelectedPersonId] = useState<string | undefined>()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [archivModus, setArchivModus] = useState(false)

  const { data: rechnungen = [], isLoading, error } = useQuery({
    queryKey: ['rechnungen', selectedPersonId, archivModus],
    queryFn: () => getRechnungen(selectedPersonId, archivModus),
  })

  const { data: personen = [] } = useQuery({ queryKey: ['personen'], queryFn: getPersonen })
  const { data: correspondents = [] } = useQuery({ queryKey: ['correspondents'], queryFn: getCorrespondents })

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
          />
        </div>
      )}

      <BulkActionBar
        count={selectedIds.size}
        onAction={handleBulkAction}
        onClear={() => setSelectedIds(new Set())}
        loading={bulkMutation.isPending}
        archivModus={archivModus}
      />
    </div>
  )
}
