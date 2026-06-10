import React, { useState, useRef, useEffect } from 'react'
import { Settings } from 'lucide-react'
import type { Rechnung, Person, Correspondent } from '../types'
import StatusBadge from './StatusBadge'
import BelegReferenzListe from './BelegReferenzListe'
import { getZahlungszielStatus } from '../utils/aufgabenBuckets'

interface Props {
  rechnungen: Rechnung[]
  personen: Person[]
  correspondents: Correspondent[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleAll: () => void
  onDelete: (id: string) => Promise<void>
  onArchivToggle: (id: string, archivieren: boolean) => Promise<void>
  onOpenSlider?: (id: string) => void
  archivModus?: boolean
  paperlessNgxUrl?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEuro(v: number) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}
function formatReferenz(nr: number | null) {
  return nr != null ? `R-${String(nr).padStart(4, '0')}` : '—'
}
function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('de-DE')
}

type SortKey = 'referenz_nr' | 'datum' | 'person' | 'korrespondent' | 'typ' | 'betrag' | 'zahlung_status'
type SortDir = 'asc' | 'desc'
type ToggableCol = 'typ' | 'notiz' | 'paperless'

const TOGGLEABLE_COLS: { key: ToggableCol; label: string }[] = [
  { key: 'typ', label: 'Typ' },
  { key: 'notiz', label: 'Notiz' },
  { key: 'paperless', label: 'Paperless' },
]

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span style={{ marginLeft: 3, opacity: active ? 1 : 0.3, color: active ? 'var(--primary)' : 'inherit' }}>
      {active ? (dir === 'desc' ? '↓' : '↑') : '↕'}
    </span>
  )
}

function PaperlessBadge({ r, paperlessNgxUrl }: { r: Rechnung; paperlessNgxUrl?: string }) {
  if (r.paperless_uebertragen_am) {
    const datum = formatDate(r.paperless_uebertragen_am)
    if (r.paperless_doc_id && paperlessNgxUrl) {
      const url = `${paperlessNgxUrl.replace(/\/$/, '')}/documents/${r.paperless_doc_id}/`
      return (
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 hover:bg-teal-200 dark:hover:bg-teal-800/60 transition-colors"
          title={`In Paperless öffnen · Übertragen am ${datum}`}>
          <span>Paperless</span>
          <span className="opacity-70">#{r.paperless_doc_id}</span>
        </a>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300"
        title={`Übertragen am ${datum}`}>
        Paperless ✓
      </span>
    )
  }
  if (r.archiviert_am && paperlessNgxUrl) {
    return (
      <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
        <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-pulse shrink-0" />
        Wird übertragen…
      </span>
    )
  }
  return null
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function RechnungenTable({
  rechnungen, personen, correspondents,
  selectedIds, onToggleSelect, onToggleAll,
  onDelete, onArchivToggle, onOpenSlider, archivModus, paperlessNgxUrl,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('datum')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [searchText, setSearchText] = useState('')
  const [anhangExpandedId, setAnhangExpandedId] = useState<string | null>(null)
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null)
  const [tableFocused, setTableFocused] = useState(false)
  const [showColPicker, setShowColPicker] = useState(false)
  const [hiddenCols, setHiddenCols] = useState<Set<ToggableCol>>(() => {
    try {
      const s = localStorage.getItem('rechnungen_hidden_cols')
      return s ? new Set(JSON.parse(s) as ToggableCol[]) : new Set()
    } catch { return new Set() }
  })

  const wrapperRef = useRef<HTMLDivElement>(null)
  const colPickerRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([])
  const searchRef = useRef<HTMLInputElement>(null)

  const personMap = Object.fromEntries(personen.map(p => [p.id, p]))
  const corrMap   = Object.fromEntries(correspondents.map(c => [c.id, c]))
  const todayStr  = new Date().toISOString().slice(0, 10)

  // ── Spalten-Sichtbarkeit ──────────────────────────────────────────────────

  function isVisible(col: ToggableCol) { return !hiddenCols.has(col) }

  function toggleCol(col: ToggableCol) {
    setHiddenCols(prev => {
      const next = new Set(prev)
      next.has(col) ? next.delete(col) : next.add(col)
      localStorage.setItem('rechnungen_hidden_cols', JSON.stringify([...next]))
      return next
    })
  }

  // Spalten-Picker schließen bei Klick außerhalb
  useEffect(() => {
    if (!showColPicker) return
    function handler(e: MouseEvent) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setShowColPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showColPicker])

  // ── Sortierung ────────────────────────────────────────────────────────────

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
    setFocusedIdx(null)
  }

  const sorted = [...rechnungen].sort((a, b) => {
    let cmp = 0
    switch (sortKey) {
      case 'referenz_nr':   cmp = (a.referenz_nr ?? -1) - (b.referenz_nr ?? -1); break
      case 'datum':         cmp = a.datum.localeCompare(b.datum); break
      case 'person':        cmp = (personMap[a.person_id]?.name ?? '').localeCompare(personMap[b.person_id]?.name ?? ''); break
      case 'korrespondent': cmp = (corrMap[a.leistungserbringer_id]?.name ?? '').localeCompare(corrMap[b.leistungserbringer_id]?.name ?? ''); break
      case 'typ':           cmp = a.typ.localeCompare(b.typ); break
      case 'betrag':        cmp = a.betrag - b.betrag; break
      case 'zahlung_status':cmp = a.zahlung_status.localeCompare(b.zahlung_status); break
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  // ── Suche ─────────────────────────────────────────────────────────────────

  const q = searchText.trim().toLowerCase()
  const filtered = q
    ? sorted.filter(r =>
        corrMap[r.leistungserbringer_id]?.name.toLowerCase().includes(q) ||
        personMap[r.person_id]?.name.toLowerCase().includes(q) ||
        formatReferenz(r.referenz_nr).toLowerCase().includes(q) ||
        (r.notiz?.toLowerCase().includes(q) ?? false)
      )
    : sorted

  const allSelected = filtered.length > 0 && filtered.every(r => selectedIds.has(r.id))

  // ── Keyboard-Navigation ───────────────────────────────────────────────────

  useEffect(() => {
    if (focusedIdx === null) return
    rowRefs.current[focusedIdx]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [focusedIdx])

  function handleWrapperKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // Nicht abfangen wenn im Suchfeld getippt wird
    if ((e.target as HTMLElement) === searchRef.current) {
      if (e.key === 'ArrowDown' && filtered.length > 0) {
        e.preventDefault()
        setFocusedIdx(0)
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIdx(i => i === null ? 0 : Math.min(i + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIdx(i => i === null ? filtered.length - 1 : Math.max(i - 1, 0))
        break
      case 'Enter':
        if (focusedIdx !== null) { e.preventDefault(); onOpenSlider?.(filtered[focusedIdx].id) }
        break
      case ' ':
        if (focusedIdx !== null) { e.preventDefault(); onToggleSelect(filtered[focusedIdx].id) }
        break
      case 'Escape':
        setFocusedIdx(null)
        break
    }
  }

  // ── Summen ────────────────────────────────────────────────────────────────

  const totals = {
    betrag:         filtered.reduce((s, r) => s + r.betrag, 0),
    bhErwartet:     filtered.reduce((s, r) => s + (r.beihilfe_anteil_erwartet ?? 0), 0),
    bhTatsaechlich: filtered.reduce((s, r) => s + (r.beihilfe_erstattet_betrag ?? 0), 0),
    pkvErwartet:    filtered.reduce((s, r) => s + (r.pkv_anteil_erwartet ?? 0), 0),
    pkvTatsaechlich:filtered.reduce((s, r) => s + (r.pkv_erstattet_betrag ?? 0), 0),
    hasBH:          filtered.some(r => r.beihilfe_anteil_erwartet != null),
    hasPKV:         filtered.some(r => r.pkv_anteil_erwartet != null),
  }

  // ── Toolbar & Column-Picker ────────────────────────────────────────────────

  const TH_STYLE = {
    padding: '8px 12px',
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--text-subtle)',
    letterSpacing: '0.08em',
    borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap' as const,
    userSelect: 'none' as const,
  }

  const sortableTH = (key: SortKey, label: string, align: 'left' | 'right' = 'left') => (
    <th key={key} onClick={() => toggleSort(key)}
      style={{ ...TH_STYLE, textAlign: align, cursor: 'pointer' }}>
      {label}<SortIcon active={sortKey === key} dir={sortDir} />
    </th>
  )

  return (
    <div
      ref={wrapperRef}
      tabIndex={0}
      onKeyDown={handleWrapperKeyDown}
      onFocus={() => setTableFocused(true)}
      onBlur={e => { if (!wrapperRef.current?.contains(e.relatedTarget as Node)) { setTableFocused(false); setFocusedIdx(null) } }}
      style={{ outline: 'none' }}
    >

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface-alt)' }}>
        <input
          ref={searchRef}
          type="search"
          placeholder="Suchen nach Name, Referenz, Notiz…"
          value={searchText}
          onChange={e => { setSearchText(e.target.value); setFocusedIdx(null) }}
          style={{ flex: 1, padding: '5px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg, var(--surface))', color: 'var(--text)', outline: 'none' }}
        />
        {q && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {filtered.length} / {rechnungen.length}
          </span>
        )}
        {/* Spalten-Auswahl */}
        <div ref={colPickerRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowColPicker(p => !p)}
            title="Spalten ein-/ausblenden"
            style={{ display: 'flex', alignItems: 'center', padding: '5px 7px', borderRadius: 6, border: '1px solid var(--border)', background: showColPicker ? 'var(--surface-hi)' : 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <Settings style={{ width: 14, height: 14 }} />
          </button>
          {showColPicker && (
            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 4px', minWidth: 130, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
              {TOGGLEABLE_COLS.map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--text)', borderRadius: 5 }}>
                  <input type="checkbox" checked={isVisible(key)} onChange={() => toggleCol(key)} style={{ accentColor: 'var(--primary)' }} />
                  {label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile-Ansicht: Karten ─────────────────────────────────────── */}
      <div className="sm:hidden">
        {filtered.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: '1px solid var(--row-border)', background: 'var(--surface-alt)' }}>
            <input type="checkbox" checked={allSelected} onChange={onToggleAll} style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
            <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>Alle auswählen</span>
          </div>
        )}
        {filtered.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13 }}>
            {q ? 'Keine Ergebnisse für diese Suche.' : 'Keine Rechnungen vorhanden.'}
          </div>
        )}
        <div className="app-divide-y">
          {filtered.map((r) => {
            const person = personMap[r.person_id]
            const corr   = corrMap[r.leistungserbringer_id]
            const zlStatus = getZahlungszielStatus(r, todayStr)

            return (
              <div key={r.id} style={{ padding: '12px 14px', background: selectedIds.has(r.id) ? 'var(--row-active)' : 'transparent' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <input type="checkbox" checked={selectedIds.has(r.id)}
                    onChange={() => onToggleSelect(r.id)}
                    style={{ marginTop: 3, accentColor: 'var(--primary)', width: 16, height: 16, flexShrink: 0 }} />
                  <div
                    style={{ flex: 1, minWidth: 0, cursor: onOpenSlider ? 'pointer' : 'default' }}
                    onClick={() => onOpenSlider?.(r.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(r.betrag)}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontVariantNumeric: 'tabular-nums' }}>{formatReferenz(r.referenz_nr)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{person?.name ?? r.person_id}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{formatDate(r.datum)}</span>
                      {zlStatus && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: zlStatus === 'ueberfaellig' ? 'var(--rose-dim)' : 'var(--amber-dim)', color: zlStatus === 'ueberfaellig' ? 'var(--rose)' : 'var(--amber)' }}>
                          {zlStatus === 'ueberfaellig' ? 'Überfällig' : `Fällig ${formatDate(r.zahlungsziel)}`}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                      {corr?.name ?? r.leistungserbringer_id}
                      {isVisible('typ') && <> · <span style={{ textTransform: 'capitalize' }}>{r.typ}</span></>}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                      <StatusBadge label="Zahlung" status={r.zahlung_status} />
                      <StatusBadge label="Beihilfe" status={r.beihilfe_status} />
                      <StatusBadge label="PKV" status={r.pkv_status} />
                    </div>
                    {(r.beihilfe_anteil_erwartet != null || r.pkv_anteil_erwartet != null) && (
                      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-subtle)', fontVariantNumeric: 'tabular-nums' }}>
                        {r.beihilfe_anteil_erwartet != null && (
                          <span>BH: {formatEuro(r.beihilfe_anteil_erwartet)}{r.beihilfe_erstattet_betrag != null && ` → ${formatEuro(r.beihilfe_erstattet_betrag)}`}</span>
                        )}
                        {r.pkv_anteil_erwartet != null && (
                          <span>PKV: {formatEuro(r.pkv_anteil_erwartet)}{r.pkv_erstattet_betrag != null && ` → ${formatEuro(r.pkv_erstattet_betrag)}`}</span>
                        )}
                      </div>
                    )}
                    {isVisible('notiz') && r.notiz && (
                      <div style={{ fontSize: 11, color: 'var(--text-subtle)', fontStyle: 'italic', marginTop: 3 }}>{r.notiz}</div>
                    )}
                    {isVisible('paperless') && r.paperless_uebertragen_am && (
                      <div style={{ marginTop: 6 }}><PaperlessBadge r={r} paperlessNgxUrl={paperlessNgxUrl} /></div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10, marginLeft: 26 }}>
                  <button onClick={() => onArchivToggle(r.id, !archivModus)}
                    style={{ flex: 1, padding: '6px 0', fontSize: 12, color: 'var(--amber)', border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', cursor: 'pointer' }}>
                    {archivModus ? 'Wiederherstellen' : 'Archivieren'}
                  </button>
                  <button onClick={() => onDelete(r.id)}
                    style={{ flex: 1, padding: '6px 0', fontSize: 12, color: 'var(--rose)', border: '1px solid var(--border)', borderRadius: 6, background: 'transparent', cursor: 'pointer' }}>
                    Löschen
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        {/* Mobile Summe */}
        {filtered.length > 1 && (
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface-alt)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{filtered.length} Rechnungen</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(totals.betrag)}</span>
          </div>
        )}
      </div>

      {/* ── Desktop-Ansicht: Tabelle ───────────────────────────────────── */}
      <div className="hidden sm:block overflow-x-auto" style={{ position: 'relative' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface-alt)', position: 'sticky', top: 0, zIndex: 2 }}>
              <th style={{ ...TH_STYLE, width: 40, padding: '8px 10px 8px 14px', textAlign: 'center' }}>
                <input type="checkbox" checked={allSelected} onChange={onToggleAll} style={{ accentColor: 'var(--primary)' }} />
              </th>
              {sortableTH('referenz_nr', 'REF.')}
              {sortableTH('datum', 'DATUM')}
              {sortableTH('person', 'PERSON')}
              {sortableTH('korrespondent', 'LEISTUNGSERBRINGER')}
              {isVisible('typ') && sortableTH('typ', 'TYP')}
              {sortableTH('betrag', 'BETRAG', 'right')}
              {sortableTH('zahlung_status', 'STATUS')}
              <th style={{ ...TH_STYLE, textAlign: 'right' }}>BEIHILFE</th>
              <th style={{ ...TH_STYLE, textAlign: 'right' }}>PKV</th>
              {isVisible('notiz') && <th style={TH_STYLE}>NOTIZ</th>}
              {isVisible('paperless') && <th style={TH_STYLE}>PAPERLESS</th>}
              <th style={{ ...TH_STYLE, borderBottom: '1px solid var(--border)' }} />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={20} style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13 }}>
                  {q ? 'Keine Ergebnisse für diese Suche.' : 'Keine Rechnungen vorhanden.'}
                </td>
              </tr>
            )}
            {filtered.map((r, idx) => {
              const isSelected = selectedIds.has(r.id)
              const isFocused  = focusedIdx === idx
              const zlStatus   = getZahlungszielStatus(r, todayStr)

              return (
                <React.Fragment key={r.id}>
                  <tr
                    ref={el => { rowRefs.current[idx] = el }}
                    style={{
                      cursor: onOpenSlider ? 'pointer' : 'default',
                      background: isFocused
                        ? 'var(--primary-dim)'
                        : isSelected ? 'var(--row-active)' : 'transparent',
                      borderLeft: isSelected || isFocused
                        ? '2px solid var(--primary)'
                        : '2px solid transparent',
                      outline: isFocused ? '1px solid var(--primary)' : 'none',
                      outlineOffset: '-1px',
                      transition: 'background 0.1s',
                    }}
                    className="table-row-hover"
                    onClick={(e) => {
                      if (onOpenSlider && !(e.target as HTMLElement).closest('input, button, a')) {
                        setFocusedIdx(idx)
                        onOpenSlider(r.id)
                      }
                    }}
                    onMouseEnter={() => setFocusedIdx(idx)}
                  >
                    <td style={{ padding: '0 10px 0 12px', width: 40, textAlign: 'center', borderBottom: '1px solid var(--row-border)' }}
                      onClick={e => { e.stopPropagation(); onToggleSelect(r.id) }}>
                      <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(r.id)} style={{ accentColor: 'var(--primary)' }} />
                    </td>

                    {/* REF */}
                    <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: isSelected ? 'var(--primary)' : 'var(--text-muted)', borderBottom: '1px solid var(--row-border)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {formatReferenz(r.referenz_nr)}
                    </td>

                    {/* DATUM + Zahlungsziel */}
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--row-border)', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(r.datum)}</div>
                      {zlStatus && (
                        <div style={{ fontSize: 10, fontWeight: 700, marginTop: 1, color: zlStatus === 'ueberfaellig' ? 'var(--rose)' : 'var(--amber)' }}>
                          {zlStatus === 'ueberfaellig' ? '⚠ Überfällig' : `Fällig ${formatDate(r.zahlungsziel)}`}
                        </div>
                      )}
                    </td>

                    {/* PERSON */}
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text)', fontWeight: 500, borderBottom: '1px solid var(--row-border)' }}>
                      {personMap[r.person_id]?.name ?? r.person_id}
                    </td>

                    {/* LEISTUNGSERBRINGER */}
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text)', borderBottom: '1px solid var(--row-border)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={corrMap[r.leistungserbringer_id]?.name}>
                      {corrMap[r.leistungserbringer_id]?.name ?? r.leistungserbringer_id}
                    </td>

                    {/* TYP (optional) */}
                    {isVisible('typ') && (
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--row-border)' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface-hi)', padding: '2px 8px', borderRadius: 5 }}>{r.typ}</span>
                      </td>
                    )}

                    {/* BETRAG */}
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 700, color: 'var(--text)', textAlign: 'right', borderBottom: '1px solid var(--row-border)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {formatEuro(r.betrag)}
                    </td>

                    {/* STATUS */}
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--row-border)' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        <StatusBadge label="Zahlung" status={r.zahlung_status} context="zahlung" />
                        <StatusBadge label="Beihilfe" status={r.beihilfe_status} context="beihilfe" />
                        <StatusBadge label="PKV" status={r.pkv_status} context="pkv" />
                      </div>
                    </td>

                    {/* BEIHILFE */}
                    <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid var(--row-border)', whiteSpace: 'nowrap' }}>
                      {r.beihilfe_anteil_erwartet != null && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(r.beihilfe_anteil_erwartet)}</div>
                      )}
                      {r.beihilfe_erstattet_betrag != null && (
                        <div style={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: r.beihilfe_differenz != null && r.beihilfe_differenz < 0 ? 'var(--rose)' : 'var(--green)' }}>
                          {formatEuro(r.beihilfe_erstattet_betrag)}
                        </div>
                      )}
                      {r.beihilfe_anteil_erwartet == null && r.beihilfe_erstattet_betrag == null && (
                        <span style={{ color: 'var(--text-subtle)', fontSize: 12 }}>—</span>
                      )}
                    </td>

                    {/* PKV */}
                    <td style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid var(--row-border)', whiteSpace: 'nowrap' }}>
                      {r.pkv_anteil_erwartet != null && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(r.pkv_anteil_erwartet)}</div>
                      )}
                      {r.pkv_erstattet_betrag != null && (
                        <div style={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: r.pkv_differenz != null && r.pkv_differenz < 0 ? 'var(--rose)' : 'var(--green)' }}>
                          {formatEuro(r.pkv_erstattet_betrag)}
                        </div>
                      )}
                      {r.pkv_anteil_erwartet == null && r.pkv_erstattet_betrag == null && (
                        <span style={{ color: 'var(--text-subtle)', fontSize: 12 }}>—</span>
                      )}
                    </td>

                    {/* NOTIZ (optional) */}
                    {isVisible('notiz') && (
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)', borderBottom: '1px solid var(--row-border)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={r.notiz ?? undefined}>
                        {r.notiz ?? '—'}
                      </td>
                    )}

                    {/* PAPERLESS (optional) */}
                    {isVisible('paperless') && (
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--row-border)' }}>
                        <PaperlessBadge r={r} paperlessNgxUrl={paperlessNgxUrl} />
                      </td>
                    )}

                    {/* Aktionen */}
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--row-border)', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={e => { e.stopPropagation(); setAnhangExpandedId(id => id === r.id ? null : r.id) }}
                          title="Anhänge"
                          style={{ padding: '3px 7px', fontSize: 11, borderRadius: 5, cursor: 'pointer', border: `1px solid ${anhangExpandedId === r.id ? 'var(--border-hi)' : 'var(--border)'}`, background: anhangExpandedId === r.id ? 'var(--surface-hi)' : 'transparent', color: 'var(--text-muted)' }}>
                          📎
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); onArchivToggle(r.id, !archivModus) }}
                          title={archivModus ? 'Wiederherstellen' : 'Archivieren'}
                          style={{ padding: '3px 7px', fontSize: 11, borderRadius: 5, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--amber)' }}>
                          {archivModus ? '↩' : '🗄'}
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); onDelete(r.id) }}
                          title="Löschen"
                          style={{ padding: '3px 7px', fontSize: 11, borderRadius: 5, cursor: 'pointer', border: '1px solid var(--border)', background: 'transparent', color: 'var(--rose)' }}>
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Beleg-Expandier-Zeile */}
                  {anhangExpandedId === r.id && (
                    <tr style={{ background: 'var(--surface-alt)' }}>
                      <td colSpan={20} style={{ padding: '12px 24px' }}>
                        <BelegReferenzListe mode="rechnung" id={r.id} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>

          {/* ── Summenzeile ─────────────────────────────────────────────── */}
          {filtered.length > 1 && (
            <tfoot>
              <tr style={{ background: 'var(--surface-alt)', borderTop: '2px solid var(--border)' }}>
                <td colSpan={2} style={{ padding: '8px 12px 8px 14px' }} />
                <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)' }}>
                  {filtered.length} Rechnungen
                </td>
                <td colSpan={2 + (isVisible('typ') ? 1 : 0)} />
                <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 700, color: 'var(--text)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {formatEuro(totals.betrag)}
                </td>
                <td />
                <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {totals.hasBH && (
                    <>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(totals.bhErwartet)}</div>
                      {totals.bhTatsaechlich > 0 && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(totals.bhTatsaechlich)}</div>}
                    </>
                  )}
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {totals.hasPKV && (
                    <>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(totals.pkvErwartet)}</div>
                      {totals.pkvTatsaechlich > 0 && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>{formatEuro(totals.pkvTatsaechlich)}</div>}
                    </>
                  )}
                </td>
                {isVisible('notiz') && <td />}
                {isVisible('paperless') && <td />}
                <td />
              </tr>
            </tfoot>
          )}
        </table>

        {/* Keyboard-Hint */}
        {tableFocused && filtered.length > 0 && (
          <div style={{ position: 'sticky', bottom: 0, right: 0, textAlign: 'right', padding: '4px 12px', fontSize: 10, color: 'var(--text-subtle)', background: 'var(--surface-alt)', borderTop: '1px solid var(--border)' }}>
            ↑↓ navigieren · Enter öffnen · Leertaste auswählen · Esc zurücksetzen
          </div>
        )}
      </div>
    </div>
  )
}
