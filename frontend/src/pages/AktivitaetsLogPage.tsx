import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAllAktivitaet } from '../api/aktivitaet'
import { getRechnungen } from '../api/rechnungen'
import { getPersonen } from '../api/personen'
import { AKTION_LABELS, AKTION_DOT, AktivitaetDiffs } from '../components/AktivitaetsLog'
import RechnungDetailSlider from '../components/RechnungDetailSlider'

// ── Sidebar-Komponenten ────────────────────────────────────────────────────────

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
      {dot && <span style={{ width: 8, height: 8, borderRadius: 3, background: dot, flexShrink: 0, opacity: active ? 1 : 0.6 }} />}
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

// ── Aktions-Definitionen ──────────────────────────────────────────────────────

const AKTION_ITEMS = [
  { value: '', label: 'Alle Aktionen' },
  { value: 'erstellt', label: 'Erstellt' },
  { value: 'geaendert', label: 'Geändert' },
  { value: 'antrag_zugewiesen', label: 'Antrag zugewiesen' },
  { value: 'antrag_entfernt', label: 'Antrag entfernt' },
  { value: 'antrag_status_geaendert', label: 'Antrag-Status' },
  { value: 'anhang_hochgeladen', label: 'Anhang hochgeladen' },
  { value: 'anhang_geloescht', label: 'Anhang gelöscht' },
] as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDayLabel(ts: string): string {
  try {
    return new Date(ts).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return ts.slice(0, 10) }
}

function formatTime(ts: string): string {
  try { return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}

// ── Mobile Tab Button ─────────────────────────────────────────────────────────

function MobileTab({ label, dot, active, onClick }: {
  label: string; dot?: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '10px 14px', fontSize: 13, background: 'none', border: 'none',
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

// ── Hauptseite ────────────────────────────────────────────────────────────────

export default function AktivitaetsLogPage() {
  const qc = useQueryClient()
  const [personFilter, setPersonFilter] = useState('')
  const [aktionFilter, setAktionFilter] = useState('')
  const [q, setQ] = useState('')
  const [sliderRechnungId, setSliderRechnungId] = useState<string | null>(null)

  const { data: aktivitaeten = [], isLoading } = useQuery({
    queryKey: ['aktivitaet-alle'],
    queryFn: getAllAktivitaet,
  })
  const { data: rechnungen = [] } = useQuery({ queryKey: ['rechnungen'], queryFn: () => getRechnungen() })
  const { data: personen = [] } = useQuery({ queryKey: ['personen'], queryFn: getPersonen })

  const rechnungenMap = useMemo(() => Object.fromEntries(rechnungen.map(r => [r.id, r])), [rechnungen])
  const personenMap = useMemo(() => Object.fromEntries(personen.map(p => [p.id, p])), [personen])

  const personCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const a of aktivitaeten) {
      const pid = rechnungenMap[a.rechnung_id]?.person_id
      if (pid) map[pid] = (map[pid] ?? 0) + 1
    }
    return map
  }, [aktivitaeten, rechnungenMap])

  const aktionCounts = useMemo(() => {
    const map: Record<string, number> = { '': aktivitaeten.length }
    for (const a of aktivitaeten) map[a.aktion] = (map[a.aktion] ?? 0) + 1
    return map
  }, [aktivitaeten])

  const filtered = useMemo(() => {
    return aktivitaeten.filter(a => {
      const r = rechnungenMap[a.rechnung_id]
      if (personFilter && r?.person_id !== personFilter) return false
      if (aktionFilter && a.aktion !== aktionFilter) return false
      if (q) {
        const ref = r?.referenz_nr != null ? `r-${String(r.referenz_nr).padStart(4, '0')}` : ''
        const person = r ? (personenMap[r.person_id]?.name ?? '').toLowerCase() : ''
        const search = q.toLowerCase()
        if (!ref.includes(search) && !person.includes(search)) return false
      }
      return true
    })
  }, [aktivitaeten, personFilter, aktionFilter, q, rechnungenMap, personenMap])

  const grouped = useMemo(() => {
    const days: Array<{ day: string; items: typeof filtered }> = []
    for (const a of filtered) {
      const day = a.erstellt_am.slice(0, 10)
      const last = days[days.length - 1]
      if (last && last.day === day) last.items.push(a)
      else days.push({ day, items: [a] })
    }
    return days
  }, [filtered])

  const personenMitAktivitaet = useMemo(
    () => personen.filter(p => personCounts[p.id] > 0),
    [personen, personCounts]
  )

  const fieldStyle: React.CSSProperties = {
    background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 8,
    padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none',
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row" style={{ height: '100%', overflow: 'hidden' }}>

        {/* ── Mobile: Person-Tabs ── */}
        <div className="sm:hidden" style={{
          borderBottom: '1px solid var(--border)', background: 'var(--surface)',
          flexShrink: 0, overflowX: 'auto', overflowY: 'hidden',
        }}>
          <div style={{ display: 'flex', padding: '0 4px', minWidth: 'max-content' }}>
            <MobileTab label="Alle" active={!personFilter} onClick={() => setPersonFilter('')} />
            {personenMitAktivitaet.map(p => (
              <MobileTab key={p.id} label={p.name} dot="var(--blue)" active={personFilter === p.id} onClick={() => setPersonFilter(p.id)} />
            ))}
          </div>
        </div>

        {/* ── Desktop Sidebar ── */}
        <div className="hidden sm:flex" style={{
          width: 220, minWidth: 220, flexShrink: 0,
          borderRight: '1px solid var(--border)',
          background: 'var(--surface)',
          flexDirection: 'column', overflowY: 'auto',
        }}>
          <div style={{ padding: '18px 14px 8px' }}>
            <FilterGroup title="Person">
              <FilterRow label="Alle" count={aktivitaeten.length} active={!personFilter} dot="var(--primary)" onClick={() => setPersonFilter('')} />
              {personenMitAktivitaet.map(p => (
                <FilterRow key={p.id} label={p.name} count={personCounts[p.id] ?? 0} active={personFilter === p.id} dot="var(--blue)" onClick={() => setPersonFilter(p.id)} />
              ))}
            </FilterGroup>

            <FilterGroup title="Aktion">
              {AKTION_ITEMS.map(item => (
                <FilterRow
                  key={item.value}
                  label={item.label}
                  count={aktionCounts[item.value] ?? 0}
                  active={aktionFilter === item.value}
                  dot={item.value ? AKTION_DOT[item.value] : 'var(--primary)'}
                  onClick={() => setAktionFilter(item.value)}
                />
              ))}
            </FilterGroup>
          </div>
        </div>

        {/* ── Hauptbereich ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

          {/* Toolbar */}
          <div style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }} className="px-4 py-3 sm:px-6 sm:py-4">
            <div style={{ marginBottom: 10 }}>
              <h1 style={{ fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }} className="text-[18px] sm:text-[21px]">
                Protokoll
              </h1>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                {filtered.length} {filtered.length === 1 ? 'Eintrag' : 'Einträge'}
                {personFilter && ` · ${personenMap[personFilter]?.name ?? ''}`}
                {aktionFilter && ` · ${AKTION_LABELS[aktionFilter] ?? aktionFilter}`}
              </div>
            </div>
            <div style={{ position: 'relative', maxWidth: 420 }}>
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)', fontSize: 13 }}>⌕</span>
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Suche nach Person, Rechnung…"
                style={{ ...fieldStyle, paddingLeft: 30, width: '100%' }}
              />
            </div>
          </div>

          {/* Mobile: Aktion-Filter (zweite Zeile) */}
          <div className="sm:hidden" style={{
            borderBottom: '1px solid var(--border)', background: 'var(--surface)',
            flexShrink: 0, overflowX: 'auto', overflowY: 'hidden',
          }}>
            <div style={{ display: 'flex', padding: '0 4px', minWidth: 'max-content' }}>
              {AKTION_ITEMS.map(item => (
                <MobileTab
                  key={item.value}
                  label={item.label}
                  dot={item.value ? AKTION_DOT[item.value] : undefined}
                  active={aktionFilter === item.value}
                  onClick={() => setAktionFilter(item.value)}
                />
              ))}
            </div>
          </div>

          {/* Log-Einträge */}
          <div style={{ flex: 1, overflowY: 'auto' }} className="p-4 pb-10 sm:px-6 sm:py-5 sm:pb-10">
            {isLoading && (
              <p style={{ fontSize: 13, color: 'var(--text-subtle)', padding: '24px 0' }}>Lade…</p>
            )}
            {!isLoading && filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-subtle)', fontSize: 13 }}>
                Keine Einträge gefunden.
              </div>
            )}

            {!isLoading && grouped.map(({ day, items }) => (
              <div key={day} style={{ marginBottom: 24 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: 'var(--text-subtle)',
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                  marginBottom: 8, paddingBottom: 6,
                  borderBottom: '1px solid var(--border)',
                }}>
                  {formatDayLabel(items[0].erstellt_am)}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {items.map(item => {
                    const r = rechnungenMap[item.rechnung_id]
                    const rechnungLabel = r?.referenz_nr != null
                      ? `R-${String(r.referenz_nr).padStart(4, '0')}`
                      : undefined
                    const personName = r ? (personenMap[r.person_id]?.name ?? '') : ''
                    const dot = AKTION_DOT[item.aktion] ?? 'var(--text-subtle)'

                    return (
                      <div
                        key={item.id}
                        style={{
                          background: 'var(--surface)', border: '1px solid var(--border)',
                          borderRadius: 8, padding: '10px 14px',
                          cursor: r ? 'pointer' : 'default',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { if (r) e.currentTarget.style.background = 'var(--row-hover)' }}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
                        onClick={() => { if (r) setSliderRechnungId(r.id) }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: dot }} />
                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                              {AKTION_LABELS[item.aktion] ?? item.aktion}
                            </span>
                            {rechnungLabel && (
                              <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--primary)', flexShrink: 0 }}>
                                {rechnungLabel}
                              </span>
                            )}
                            {personName && (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {personName}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-subtle)', flexShrink: 0 }}>
                            {formatTime(item.erstellt_am)}
                          </span>
                        </div>
                        <AktivitaetDiffs item={item} />
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <RechnungDetailSlider
        rechnungId={sliderRechnungId}
        onClose={() => setSliderRechnungId(null)}
        onUpdate={() => qc.invalidateQueries({ queryKey: ['aktivitaet-alle'] })}
        onKopieren={() => {}}
      />
    </>
  )
}
