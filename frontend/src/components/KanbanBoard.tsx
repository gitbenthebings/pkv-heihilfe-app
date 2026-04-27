import { useState, useCallback } from 'react'
import type { KanbanBoard as KanbanBoardType, Rechnung, Person, Correspondent } from '../types'

// ─── LocalStorage-Hooks ───────────────────────────────────────────────────────

function useLSSet(key: string): [Set<string>, (id: string, v: boolean) => void] {
  const [val, setVal] = useState<Set<string>>(() => {
    try { const s = localStorage.getItem(key); return s ? new Set(JSON.parse(s)) : new Set() }
    catch { return new Set() }
  })
  const set = useCallback((id: string, collapsed: boolean) => {
    setVal(prev => {
      const next = new Set(prev)
      collapsed ? next.add(id) : next.delete(id)
      try { localStorage.setItem(key, JSON.stringify([...next])) } catch {}
      return next
    })
  }, [key])
  return [val, set]
}

// ─── Formatierung ─────────────────────────────────────────────────────────────

function formatEuro(betrag: number) {
  return betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function formatBetragZeile(r: Rechnung) {
  const gesamt = formatEuro(r.betrag)
  const beihilfe = r.beihilfe_anteil_erwartet !== null ? formatEuro(r.beihilfe_anteil_erwartet) : null
  const pkv = formatEuro(r.pkv_anteil_erwartet ?? r.betrag)
  if (beihilfe !== null) return `${gesamt} / ${beihilfe} / ${pkv}`
  return `${gesamt} / ${pkv}`
}

interface Summen { gesamt: number; beihilfe: number | null; pkv: number }

function summenVon(items: Rechnung[]): Summen {
  const hatBeihilfe = items.some(r => r.beihilfe_anteil_erwartet !== null)
  return {
    gesamt: items.reduce((s, r) => s + r.betrag, 0),
    beihilfe: hatBeihilfe ? items.reduce((s, r) => s + (r.beihilfe_anteil_erwartet ?? 0), 0) : null,
    pkv: items.reduce((s, r) => s + (r.pkv_anteil_erwartet ?? r.betrag), 0),
  }
}

function formatSumme({ gesamt, beihilfe, pkv }: Summen) {
  if (beihilfe !== null) return `${formatEuro(gesamt)} / ${formatEuro(beihilfe)} / ${formatEuro(pkv)}`
  return `${formatEuro(gesamt)} / ${formatEuro(pkv)}`
}

function formatReferenz(nr: number | null) {
  if (nr === null) return null
  return `R-${String(nr).padStart(4, '0')}`
}

// ─── Spalten-Konfiguration ────────────────────────────────────────────────────

const columns: { key: keyof KanbanBoardType; label: string; color: string }[] = [
  { key: 'neu',                  label: 'Neu',                  color: 'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700' },
  { key: 'bezahlt',              label: 'Bezahlt',              color: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' },
  { key: 'beihilfe_eingereicht', label: 'Beihilfe eingereicht', color: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' },
  { key: 'pkv_eingereicht',      label: 'PKV eingereicht',      color: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' },
  { key: 'abgeschlossen',        label: 'Abgeschlossen',        color: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' },
]

// ─── Detail-Karte ─────────────────────────────────────────────────────────────

function RechnungsCard({
  r, personen, correspondents, hidePerson,
}: {
  r: Rechnung
  personen: Person[]
  correspondents: Correspondent[]
  hidePerson?: boolean
}) {
  const person = personen.find(p => p.id === r.person_id)
  const corr = correspondents.find(c => c.id === r.leistungserbringer_id)

  return (
    <div className="bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 shadow-sm p-3 space-y-1">
      <div className="flex justify-between items-start">
        <span className="font-medium text-gray-800 dark:text-gray-100 text-sm">{formatBetragZeile(r)}</span>
        <div className="text-right">
          {formatReferenz(r.referenz_nr) && (
            <span className="block text-xs font-mono text-gray-400 dark:text-gray-500">{formatReferenz(r.referenz_nr)}</span>
          )}
          <span className="text-xs text-gray-400 dark:text-gray-500">{new Date(r.datum).toLocaleDateString('de-DE')}</span>
        </div>
      </div>
      {!hidePerson && <p className="text-xs text-gray-600 dark:text-gray-300">{person?.name ?? '?'}</p>}
      <p className="text-xs text-gray-500 dark:text-gray-400">{corr?.name ?? '?'}</p>
    </div>
  )
}

// ─── Kompakt-Zeile ────────────────────────────────────────────────────────────

function RechnungsRowCompact({
  r, personen, correspondents, hidePerson,
}: {
  r: Rechnung
  personen: Person[]
  correspondents: Correspondent[]
  hidePerson?: boolean
}) {
  const person = personen.find(p => p.id === r.person_id)
  const corr = correspondents.find(c => c.id === r.leistungserbringer_id)
  const datum = new Date(r.datum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })

  return (
    <div className="flex items-center gap-2 text-xs px-1.5 py-[3px] hover:bg-black/5 dark:hover:bg-white/5 rounded">
      <span className="text-gray-400 dark:text-gray-500 shrink-0 w-[34px] tabular-nums">{datum}</span>
      {!hidePerson && (
        <span className="text-gray-500 dark:text-gray-400 shrink-0 max-w-[64px] truncate">{person?.name ?? '?'}</span>
      )}
      <span className="text-gray-600 dark:text-gray-300 truncate flex-1 min-w-0">{corr?.name ?? '?'}</span>
      <span className="text-gray-700 dark:text-gray-200 shrink-0 font-mono text-[11px] whitespace-nowrap tabular-nums">{formatBetragZeile(r)}</span>
    </div>
  )
}

// ─── Personen-Gruppe (innerhalb einer Spalte) ─────────────────────────────────

function PersonGroup({
  person, items, personen, correspondents, compact, collapsed, onToggle,
}: {
  person: Person
  items: Rechnung[]
  personen: Person[]
  correspondents: Correspondent[]
  compact: boolean
  collapsed: boolean
  onToggle: () => void
}) {
  const summen = summenVon(items)

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-1 py-1 px-1 text-left rounded hover:bg-black/5 dark:hover:bg-white/5"
      >
        <svg
          className={`w-3 h-3 text-gray-400 dark:text-gray-500 shrink-0 transition-transform duration-150 ${collapsed ? '-rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 flex-1 truncate">{person.name}</span>
        <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0 ml-1 tabular-nums">
          {items.length} · {formatSumme(summen)}
        </span>
      </button>
      {!collapsed && (
        <div className={compact ? 'mt-0.5 space-y-0' : 'mt-1.5 space-y-2'}>
          {items.map(r => compact
            ? <RechnungsRowCompact key={r.id} r={r} personen={personen} correspondents={correspondents} hidePerson />
            : <RechnungsCard key={r.id} r={r} personen={personen} correspondents={correspondents} hidePerson />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Spalten mit Personen-Gruppierung (Nach-Status-Modus) ─────────────────────

function KanbanColumnsGrouped({
  kanban, personen, correspondents, compact, collapsedPersonIds, onToggleCollapse,
}: {
  kanban: KanbanBoardType
  personen: Person[]
  correspondents: Correspondent[]
  compact: boolean
  collapsedPersonIds: Set<string>
  onToggleCollapse: (id: string, v: boolean) => void
}) {
  const allItems = [
    ...kanban.neu, ...kanban.bezahlt, ...kanban.beihilfe_eingereicht,
    ...kanban.pkv_eingereicht, ...kanban.abgeschlossen,
  ]
  const presentIds = new Set(allItems.map(r => r.person_id))
  const orderedPersonen = personen.filter(p => presentIds.has(p.id))

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {columns.map(col => {
        const items = kanban[col.key]
        const summen = summenVon(items)
        const groups = orderedPersonen
          .map(p => ({ person: p, items: items.filter(r => r.person_id === p.id) }))
          .filter(g => g.items.length > 0)

        return (
          <div key={col.key} className={`rounded-lg border p-3 ${col.color}`}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-sm">{col.label}</h3>
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 rounded-full px-2 py-0.5 border border-gray-200 dark:border-gray-600">
                {items.length}
              </span>
            </div>
            {items.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{formatSumme(summen)}</p>
            )}
            <div className="space-y-1">
              {groups.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">–</p>
              )}
              {groups.map(({ person, items: pItems }) => (
                <PersonGroup
                  key={person.id}
                  person={person}
                  items={pItems}
                  personen={personen}
                  correspondents={correspondents}
                  compact={compact}
                  collapsed={collapsedPersonIds.has(person.id)}
                  onToggle={() => onToggleCollapse(person.id, !collapsedPersonIds.has(person.id))}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Einfaches Spalten-Layout (Nach-Person-Modus) ─────────────────────────────

function KanbanColumnsSimple({
  kanban, personen, correspondents, compact, hidePerson,
}: {
  kanban: KanbanBoardType
  personen: Person[]
  correspondents: Correspondent[]
  compact: boolean
  hidePerson?: boolean
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {columns.map(col => {
        const items = kanban[col.key]
        const summen = summenVon(items)
        return (
          <div key={col.key} className={`rounded-lg border p-3 ${col.color}`}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-sm">{col.label}</h3>
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 rounded-full px-2 py-0.5 border border-gray-200 dark:border-gray-600">
                {items.length}
              </span>
            </div>
            {items.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{formatSumme(summen)}</p>
            )}
            <div className={compact ? 'space-y-0' : 'space-y-2'}>
              {items.map(r => compact
                ? <RechnungsRowCompact key={r.id} r={r} personen={personen} correspondents={correspondents} hidePerson={hidePerson} />
                : <RechnungsCard key={r.id} r={r} personen={personen} correspondents={correspondents} hidePerson={hidePerson} />
              )}
              {items.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-3">–</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function filterKanbanByPerson(kanban: KanbanBoardType, personId: string): KanbanBoardType {
  const f = (items: Rechnung[]) => items.filter(r => r.person_id === personId)
  return {
    neu:                  f(kanban.neu),
    bezahlt:              f(kanban.bezahlt),
    beihilfe_eingereicht: f(kanban.beihilfe_eingereicht),
    pkv_eingereicht:      f(kanban.pkv_eingereicht),
    abgeschlossen:        f(kanban.abgeschlossen),
  }
}

function totalInKanban(kanban: KanbanBoardType): number {
  return kanban.neu.length + kanban.bezahlt.length +
    kanban.beihilfe_eingereicht.length + kanban.pkv_eingereicht.length + kanban.abgeschlossen.length
}

// ─── Haupt-Export ─────────────────────────────────────────────────────────────

interface Props {
  kanban: KanbanBoardType
  personen: Person[]
  correspondents: Correspondent[]
  groupByPerson?: boolean
  compact: boolean
}

export default function KanbanBoard({ kanban, personen, correspondents, groupByPerson, compact }: Props) {
  const [collapsedPersonIds, setCollapsedPerson] = useLSSet('kanban_collapsed_persons')

  if (!groupByPerson) {
    return (
      <KanbanColumnsGrouped
        kanban={kanban}
        personen={personen}
        correspondents={correspondents}
        compact={compact}
        collapsedPersonIds={collapsedPersonIds}
        onToggleCollapse={setCollapsedPerson}
      />
    )
  }

  // "Nach Person"-Modus
  const allItems = [
    ...kanban.neu, ...kanban.bezahlt, ...kanban.beihilfe_eingereicht,
    ...kanban.pkv_eingereicht, ...kanban.abgeschlossen,
  ]
  const presentIds = new Set(allItems.map(r => r.person_id))
  const orderedPersonen = personen.filter(p => presentIds.has(p.id))

  if (orderedPersonen.length === 0) {
    return <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">Keine Rechnungen</p>
  }

  return (
    <div className="space-y-6">
      {orderedPersonen.map(person => {
        const personKanban = filterKanbanByPerson(kanban, person.id)
        const count = totalInKanban(personKanban)
        const alleItems = [
          ...personKanban.neu, ...personKanban.bezahlt,
          ...personKanban.beihilfe_eingereicht, ...personKanban.pkv_eingereicht,
          ...personKanban.abgeschlossen,
        ]
        const personSummen = summenVon(alleItems)

        return (
          <div key={person.id}>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100">{person.name}</h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {count} Rechnung{count !== 1 ? 'en' : ''} · {formatSumme(personSummen)}
              </span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700 hidden sm:block" />
            </div>
            <KanbanColumnsSimple
              kanban={personKanban}
              personen={personen}
              correspondents={correspondents}
              compact={compact}
              hidePerson
            />
          </div>
        )
      })}
    </div>
  )
}
