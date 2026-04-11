import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDashboard } from '../api/dashboard'
import { getPersonen } from '../api/personen'
import { getCorrespondents } from '../api/correspondents'
import KanbanBoard from '../components/KanbanBoard'
import KanbanFilter, { useKanbanFilter, filterKanban } from '../components/KanbanFilter'
import FinanzOverview from '../components/FinanzOverview'
import BREInfoLeiste from '../components/BREIndikator'
import type { KanbanBoard as KanbanBoardType, FinanzOverview as FinanzOverviewType, Rechnung } from '../types'

function useLSBoolean(key: string, def: boolean): [boolean, (v: boolean) => void] {
  const [val, setVal] = useState<boolean>(() => {
    try { const s = localStorage.getItem(key); return s !== null ? s === 'true' : def }
    catch { return def }
  })
  const set = useCallback((v: boolean) => {
    setVal(v)
    try { localStorage.setItem(key, String(v)) } catch {}
  }, [key])
  return [val, set]
}

function berechneFinanzen(kanban: KanbanBoardType): FinanzOverviewType {
  const alle: Rechnung[] = [
    ...kanban.neu, ...kanban.bezahlt,
    ...kanban.beihilfe_eingereicht, ...kanban.pkv_eingereicht, ...kanban.abgeschlossen,
  ]
  const f: FinanzOverviewType = {
    offen_unbezahlt: 0, offen_unbezahlt_beihilfe: 0, offen_unbezahlt_pkv: 0,
    bezahlt_pkv_offen: 0, bezahlt_pkv_offen_pkv: 0,
    bezahlt_beihilfe_offen: 0, bezahlt_beihilfe_offen_beihilfe: 0,
    abgeschlossen: 0, abgeschlossen_beihilfe: 0, abgeschlossen_pkv: 0,
  }
  for (const r of alle) {
    const betrag = r.betrag
    const bh = r.beihilfe_anteil_erwartet ?? 0
    const pkv = r.pkv_anteil_erwartet ?? 0
    if (r.zahlung_status !== 'bezahlt') {
      f.offen_unbezahlt += betrag
      f.offen_unbezahlt_beihilfe += bh
      f.offen_unbezahlt_pkv += pkv
    } else {
      const pkvOffen = r.pkv_status === 'offen'
      const bhOffen = r.beihilfe_status === 'offen'
      if (pkvOffen) { f.bezahlt_pkv_offen += betrag; f.bezahlt_pkv_offen_pkv += pkv }
      if (bhOffen) { f.bezahlt_beihilfe_offen += betrag; f.bezahlt_beihilfe_offen_beihilfe += bh }
      if (!pkvOffen && !bhOffen) { f.abgeschlossen += betrag; f.abgeschlossen_beihilfe += bh; f.abgeschlossen_pkv += pkv }
    }
  }
  return f
}

export default function DashboardPage() {
  const filter = useKanbanFilter()
  const [groupByPerson, setGroupByPerson] = useState(false)
  const [compact, setCompact] = useLSBoolean('kanban_compact', false)

  const { data: dashboard, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 60_000,
  })

  const { data: personen = [] } = useQuery({ queryKey: ['personen'], queryFn: getPersonen })
  const { data: correspondents = [] } = useQuery({ queryKey: ['correspondents'], queryFn: getCorrespondents })

  if (isLoading) return <p className="text-gray-500 dark:text-gray-400">Lade Dashboard...</p>
  if (error) return <p className="text-red-600 dark:text-red-400">Fehler: {(error as Error).message}</p>
  if (!dashboard) return null

  const filteredKanban = filterKanban(dashboard.kanban, filter)
  const finanzen = filter.hasFilter ? berechneFinanzen(filteredKanban) : dashboard.finanzen

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Finanzübersicht</h2>
      <FinanzOverview finanzen={finanzen} filtered={filter.hasFilter} />
      <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide pt-2">Workflow</h2>
      <KanbanFilter
        personen={personen}
        correspondents={correspondents}
        filter={filter}
        groupByPerson={groupByPerson}
        onGroupByPerson={setGroupByPerson}
        compact={compact}
        onCompact={setCompact}
      />
      <BREInfoLeiste
        indikatoren={dashboard.bre}
        hasFilter={filter.hasFilter}
        onClearFilter={filter.clearAll}
      />
      <KanbanBoard
        kanban={filteredKanban}
        personen={personen}
        correspondents={correspondents}
        groupByPerson={groupByPerson}
        compact={compact}
      />
    </div>
  )
}
