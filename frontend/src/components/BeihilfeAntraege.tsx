import { useState, useRef, useEffect, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteAntrag } from '../api/beihilfe_antraege'
import type { BeihilfeAntrag, Beihilfestelle, Pkv, AntragStatus } from '../types'

function fmtEur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

const STATUSES: AntragStatus[] = ['entwurf', 'versendet', 'in_bearbeitung', 'beschieden', 'archiviert']

const STATUS_LABELS: Record<AntragStatus, string> = {
  entwurf: 'Entwurf', versendet: 'Versendet', in_bearbeitung: 'In Bearb.',
  beschieden: 'Beschieden', archiviert: 'Archiviert',
}
const STATUS_STYLE: Record<AntragStatus, { bg: string; color: string; border: string }> = {
  entwurf:        { bg: 'var(--surface-hi)',  color: 'var(--text-muted)',  border: 'var(--border)' },
  versendet:      { bg: 'var(--blue-dim)',    color: 'var(--blue)',        border: 'rgba(74,136,245,.2)' },
  in_bearbeitung: { bg: 'var(--amber-dim)',   color: 'var(--amber)',       border: 'rgba(232,160,48,.2)' },
  beschieden:     { bg: 'var(--green-dim)',   color: 'var(--green)',       border: 'rgba(78,200,122,.2)' },
  archiviert:     { bg: 'var(--surface-hi)',  color: 'var(--text-subtle)', border: 'var(--border)' },
}

function Badge({ label, bg, color, border, size = 10 }: {
  label: string; bg: string; color: string; border: string; size?: number
}) {
  return (
    <span style={{
      background: bg, color, border: `1px solid ${border}`,
      fontSize: size, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      whiteSpace: 'nowrap', letterSpacing: '.03em',
    }}>{label}</span>
  )
}

function TypeBadge({ typ }: { typ: string }) {
  return typ === 'pkv'
    ? <Badge label="PKV" bg="var(--teal-dim)"  color="var(--teal)"  border="rgba(0,196,176,.2)"  size={9} />
    : <Badge label="BH"  bg="var(--blue-dim)"  color="var(--blue)"  border="rgba(74,136,245,.2)" size={9} />
}

function StatusBadge({ status }: { status: AntragStatus }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.entwurf
  return <Badge label={STATUS_LABELS[status] ?? status} bg={s.bg} color={s.color} border={s.border} />
}

function MiniStepTrack({ status }: { status: AntragStatus }) {
  const idx = STATUSES.indexOf(status)
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {STATUSES.slice(0, -1).map((s, i) => (
        <div key={s} style={{
          height: 3, borderRadius: 2,
          transition: 'all .3s cubic-bezier(.34,1.56,.64,1)',
          width: i === idx ? 20 : 8,
          background: i < idx ? 'var(--green)' : i === idx ? 'var(--primary)' : 'var(--border-hi)',
          opacity: i > idx ? 0.45 : 1,
        }} />
      ))}
    </div>
  )
}

interface AntragSummary {
  betrag: number
  erwartet: number | null
  tatsaechlich: number | null
}

function AntragCard({
  antrag, stelle, pkv, active, focused, onClick, onDelete, summary,
}: {
  antrag: BeihilfeAntrag
  stelle: Beihilfestelle | undefined
  pkv: Pkv | undefined
  active: boolean
  focused?: boolean
  onClick: () => void
  onDelete?: () => void
  summary?: AntragSummary
}) {
  const [hov, setHov] = useState(false)
  const institutionName = antrag.typ === 'pkv'
    ? (pkv?.name ?? antrag.pkv_versicherer ?? '—')
    : (stelle?.name ?? '—')

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '13px 16px', borderBottom: '1px solid var(--row-border)',
        cursor: 'pointer',
        borderLeft: active ? '3px solid var(--primary)' : '3px solid transparent',
        background: active ? 'var(--row-active)' : focused ? 'var(--row-hover)' : hov ? 'var(--row-hover)' : 'transparent',
        transition: 'background .12s, border-color .12s',
        position: 'relative',
      }}
    >
      {/* Row 1: badges + nr */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
        <TypeBadge typ={antrag.typ} />
        <StatusBadge status={antrag.status as AntragStatus} />
        <span style={{ fontSize: 9, color: 'var(--text-subtle)', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
          #{String(antrag.referenz_nr).padStart(4, '0')}
        </span>
      </div>

      {/* Row 2: title + institution */}
      <div style={{ marginBottom: 8 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'var(--text)',
          marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {antrag.titel ?? (
            <span style={{ color: 'var(--text-subtle)', fontStyle: 'italic', fontWeight: 400 }}>
              Kein Titel
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-subtle)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {institutionName}
        </div>
      </div>

      {/* Row 2.5: Financial summary */}
      {summary && summary.betrag > 0 && (
        <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {fmtEur(summary.betrag)}
          </span>
          {summary.erwartet != null && (
            <>
              <span style={{ color: 'var(--border-hi)', fontSize: 8 }}>·</span>
              <span style={{ fontSize: 9, color: 'var(--text-subtle)', fontVariantNumeric: 'tabular-nums' }}>
                erw. {fmtEur(summary.erwartet)}
              </span>
            </>
          )}
          {summary.tatsaechlich != null && summary.erwartet != null && summary.erwartet > 0 && (
            <div style={{ flex: 1, minWidth: 40, height: 3, background: 'var(--surface-alt)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(100, (summary.tatsaechlich / summary.erwartet) * 100)}%`,
                height: '100%',
                background: summary.tatsaechlich >= summary.erwartet ? 'var(--green)' : 'var(--amber)',
                borderRadius: 2, transition: 'width .5s ease',
              }} />
            </div>
          )}
        </div>
      )}

      {/* Row 3: MiniStepTrack + date + delete */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <MiniStepTrack status={antrag.status as AntragStatus} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, color: 'var(--text-subtle)', fontVariantNumeric: 'tabular-nums' }}>
            {new Date(antrag.erstellt_am).toLocaleDateString('de-DE')}
          </span>
          {antrag.status === 'entwurf' && hov && onDelete && (
            <span
              onClick={e => { e.stopPropagation(); onDelete() }}
              style={{
                fontSize: 9, fontWeight: 700, color: 'var(--rose)', cursor: 'pointer',
                background: 'var(--rose-dim)', padding: '1px 7px', borderRadius: 10,
                border: '1px solid rgba(240,96,112,.2)',
              }}
            >
              Löschen
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

interface Props {
  antraege: BeihilfeAntrag[]
  beihilfestellen: Beihilfestelle[]
  pkvListe: Pkv[]
  selectedId: string | undefined
  onSelect: (id: string) => void
  summaries?: Record<string, AntragSummary>
}

export default function BeihilfeAntraege({ antraege, beihilfestellen, pkvListe, selectedId, onSelect, summaries }: Props) {
  const qc = useQueryClient()
  const containerRef = useRef<HTMLDivElement>(null)
  const [focusedIdx, setFocusedIdx] = useState<number>(-1)

  const stelleMap = Object.fromEntries(beihilfestellen.map(b => [b.id, b]))
  const pkvMap = Object.fromEntries(pkvListe.map(p => [p.id, p]))

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteAntrag(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['antraege'] }),
  })

  // Wenn sich die Auswahl von außen ändert, fokussierten Index synchronisieren
  useEffect(() => {
    const idx = antraege.findIndex(a => a.id === selectedId)
    if (idx >= 0) setFocusedIdx(idx)
  }, [selectedId, antraege])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (antraege.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = Math.min(focusedIdx + 1, antraege.length - 1)
      setFocusedIdx(next)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = Math.max(focusedIdx - 1, 0)
      setFocusedIdx(prev)
    } else if (e.key === 'Enter' && focusedIdx >= 0) {
      onSelect(antraege[focusedIdx].id)
    }
  }, [antraege, focusedIdx, onSelect])

  if (antraege.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: 12 }}>
        Keine Anträge gefunden.
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ outline: 'none' }}
    >
      {antraege.map((a, i) => (
        <AntragCard
          key={a.id}
          antrag={a}
          stelle={stelleMap[a.beihilfestelle_id ?? '']}
          pkv={pkvMap[a.pkv_id ?? '']}
          active={a.id === selectedId}
          focused={i === focusedIdx && a.id !== selectedId}
          onClick={() => { setFocusedIdx(i); onSelect(a.id) }}
          onDelete={() => deleteMut.mutate(a.id)}
          summary={summaries?.[a.id]}
        />
      ))}
      {antraege.length > 1 && (
        <div style={{ padding: '4px 14px 8px', fontSize: 9, color: 'var(--text-subtle)', opacity: 0.6 }}>
          ↑↓ navigieren · Enter öffnen
        </div>
      )}
    </div>
  )
}
