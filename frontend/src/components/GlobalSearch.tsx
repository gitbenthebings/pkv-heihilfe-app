import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, FileText, ClipboardList, X } from 'lucide-react'
import { getRechnungen } from '../api/rechnungen'
import { getAntraege } from '../api/beihilfe_antraege'
import { getPersonen } from '../api/personen'
import { getCorrespondents } from '../api/correspondents'
import type { Rechnung, BeihilfeAntrag, Person, Correspondent } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEuro(v: number) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function formatRef(nr: number | null, prefix = 'R') {
  return nr != null ? `${prefix}-${String(nr).padStart(4, '0')}` : ''
}

function normStr(s: string) {
  return s.toLowerCase()
}

// ─── Result Types ─────────────────────────────────────────────────────────────

interface SearchResult {
  key: string
  type: 'rechnung' | 'antrag'
  title: string
  subtitle: string
  meta: string
  path: string
}

function searchRechnungen(
  q: string,
  rechnungen: Rechnung[],
  correspondentsById: Map<string, Correspondent>,
  personenById: Map<string, Person>,
): SearchResult[] {
  const lq = normStr(q)
  return rechnungen
    .filter(r => {
      const ref = formatRef(r.referenz_nr)
      const name = correspondentsById.get(r.leistungserbringer_id)?.name ?? ''
      const person = personenById.get(r.person_id)?.name ?? ''
      const notiz = r.notiz ?? ''
      return (
        normStr(ref).includes(lq) ||
        normStr(name).includes(lq) ||
        normStr(person).includes(lq) ||
        normStr(notiz).includes(lq)
      )
    })
    .slice(0, 8)
    .map(r => ({
      key: `r-${r.id}`,
      type: 'rechnung' as const,
      title: correspondentsById.get(r.leistungserbringer_id)?.name ?? r.leistungserbringer_id,
      subtitle: `${personenById.get(r.person_id)?.name ?? ''} · ${r.datum}`,
      meta: formatEuro(r.betrag),
      path: `/rechnungen?rechnung=${r.id}`,
    }))
}

function searchAntraege(q: string, antraege: BeihilfeAntrag[]): SearchResult[] {
  const lq = normStr(q)
  return antraege
    .filter(a => {
      const ref = formatRef(a.referenz_nr, 'A')
      const titel = a.titel ?? ''
      return normStr(ref).includes(lq) || normStr(titel).includes(lq)
    })
    .slice(0, 5)
    .map(a => ({
      key: `a-${a.id}`,
      type: 'antrag' as const,
      title: a.titel ?? formatRef(a.referenz_nr, 'A') ?? 'Antrag',
      subtitle: a.typ === 'pkv' ? 'PKV-Antrag' : 'Beihilfe-Antrag',
      meta: a.status,
      path: `/beihilfe-antraege/${a.id}`,
    }))
}

// ─── Result Row ───────────────────────────────────────────────────────────────

function ResultRow({
  result, active, onClick,
}: { result: SearchResult; active: boolean; onClick: () => void }) {
  const Icon = result.type === 'rechnung' ? FileText : ClipboardList
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '9px 14px', textAlign: 'left',
        background: active ? 'var(--primary-dim)' : 'transparent',
        border: 'none', cursor: 'pointer', borderRadius: 0,
      }}
    >
      <Icon
        style={{ flexShrink: 0, color: active ? 'var(--primary)' : 'var(--text-subtle)' }}
        className="w-4 h-4"
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }} className="truncate">
          {result.title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }} className="truncate">
          {result.subtitle}
        </div>
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-subtle)', flexShrink: 0 }}>{result.meta}</span>
    </button>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
}

export default function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Daten laden wenn Modal sich öffnet (aus Cache)
  const { data: rechnungen = [] } = useQuery({
    queryKey: ['rechnungen_search'],
    queryFn: () => getRechnungen(undefined, false, undefined),
    enabled: open,
    staleTime: 60_000,
  })
  const { data: antraege = [] } = useQuery({
    queryKey: ['antraege_search'],
    queryFn: () => getAntraege(),
    enabled: open,
    staleTime: 60_000,
  })
  const { data: personen = [] } = useQuery({ queryKey: ['personen'], queryFn: getPersonen })
  const { data: correspondents = [] } = useQuery({ queryKey: ['correspondents'], queryFn: getCorrespondents })

  const personenById = useMemo(() => new Map<string, Person>(personen.map(p => [p.id, p])), [personen])
  const correspondentsById = useMemo(() => new Map<string, Correspondent>(correspondents.map(c => [c.id, c])), [correspondents])

  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim() || query.length < 2) return []
    return [
      ...searchRechnungen(query, rechnungen, correspondentsById, personenById),
      ...searchAntraege(query, antraege),
    ]
  }, [query, rechnungen, antraege, correspondentsById, personenById])

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
      if (e.key === 'Enter' && results[activeIdx]) {
        navigate(results[activeIdx].path)
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, results, activeIdx, navigate, onClose])

  // Reset active index when results change
  useEffect(() => { setActiveIdx(0) }, [results])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '80px 16px 16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 540,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        boxShadow: '0 16px 48px rgba(0,0,0,0.35)',
        overflow: 'hidden',
      }}>
        {/* Suchfeld */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: query && results.length > 0 ? '1px solid var(--border)' : 'none' }}>
          <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--text-subtle)' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Suchen… (Leistungserbringer, Person, Notiz, Ref-Nr.)"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 14, color: 'var(--text)',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', display: 'flex' }}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Ergebnisse */}
        {query.length >= 2 && (
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {results.length === 0 ? (
              <div style={{ padding: '20px 14px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                Keine Treffer
              </div>
            ) : (
              results.map((r, i) => (
                <ResultRow
                  key={r.key}
                  result={r}
                  active={i === activeIdx}
                  onClick={() => { navigate(r.path); onClose() }}
                />
              ))
            )}
          </div>
        )}

        {/* Hint */}
        {query.length < 2 && (
          <div style={{ padding: '12px 14px', fontSize: 11, color: 'var(--text-subtle)' }}>
            Mindestens 2 Zeichen eingeben · ↑↓ navigieren · Enter öffnen · Esc schließen
          </div>
        )}
      </div>
    </div>
  )
}
