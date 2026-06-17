import { useState } from 'react'
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

function TypeBadge({ typ }: { typ: string }) {
  return typ === 'pkv'
    ? <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'var(--teal-dim)', color: 'var(--teal)', border: '1px solid rgba(0,196,176,.2)' }}>PKV</span>
    : <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(74,136,245,.2)' }}>BH</span>
}

function StatusBadge({ status }: { status: AntragStatus }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.entwurf
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
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
  has_widerspruch: boolean
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

function AntragCard({ antrag, stelle, pkv, active, onClick, onDelete, summary }: {
  antrag: BeihilfeAntrag
  stelle: Beihilfestelle | undefined
  pkv: Pkv | undefined
  active: boolean
  onClick: () => void
  onDelete?: () => void
  summary?: AntragSummary
}) {
  const [hov, setHov] = useState(false)
  const isPkv = antrag.typ === 'pkv'
  const tone = isPkv ? 'teal' : 'blue'
  const status = antrag.status as AntragStatus
  const institutionName = isPkv ? (pkv?.name ?? antrag.pkv_versicherer ?? '—') : (stelle?.name ?? '—')

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--surface)', borderRadius: 12, overflow: 'hidden',
        display: 'flex', flexDirection: 'column', position: 'relative', cursor: 'pointer',
        border: active ? '2px solid var(--primary)' : '1px solid var(--border)',
        boxShadow: hov ? '0 10px 28px rgba(0,0,0,0.2)' : 'none',
        transform: hov ? 'translateY(-2px)' : 'none',
        transition: 'transform 0.14s, box-shadow 0.14s, border-color 0.14s',
      }}
    >
      {/* Type header */}
      <div style={{
        padding: '12px 14px 11px',
        background: `color-mix(in srgb, var(--${tone}) 10%, var(--surface-alt))`,
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 9, flexWrap: 'wrap' }}>
          <TypeBadge typ={antrag.typ} />
          <StatusBadge status={status} />
          {summary?.has_widerspruch && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'var(--rose-dim)', color: 'var(--rose)', border: '1px solid rgba(240,96,112,.2)', whiteSpace: 'nowrap' }}>
              Widerspruch
            </span>
          )}
          <span style={{ fontSize: 9, color: 'var(--text-subtle)', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
            #{String(antrag.referenz_nr).padStart(4, '0')}
          </span>
        </div>
        <MiniStepTrack status={status} />
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px 14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          fontSize: 13.5, fontWeight: 700, color: 'var(--text)', lineHeight: 1.35,
          marginBottom: 4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          minHeight: 37,
        }}>
          {antrag.titel ?? <span style={{ color: 'var(--text-subtle)', fontStyle: 'italic', fontWeight: 400 }}>Kein Titel</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 10 }}>
          {institutionName}
        </div>

        {summary && summary.betrag > 0 && (
          <div style={{ marginTop: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.01em' }}>
              {fmtEur(summary.betrag)}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 1, flexWrap: 'wrap' }}>
              {summary.erwartet != null && (
                <span style={{ fontSize: 10, color: 'var(--text-subtle)', fontVariantNumeric: 'tabular-nums' }}>
                  erw. {fmtEur(summary.erwartet)}
                </span>
              )}
              {summary.tatsaechlich != null && (
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)', fontVariantNumeric: 'tabular-nums' }}>
                  erst. {fmtEur(summary.tatsaechlich)}
                </span>
              )}
            </div>
            {summary.tatsaechlich != null && summary.erwartet != null && summary.erwartet > 0 && (
              <div style={{ height: 3, borderRadius: 2, background: 'var(--surface-alt)', overflow: 'hidden', marginTop: 5 }}>
                <div style={{
                  width: `${Math.min(100, (summary.tatsaechlich / summary.erwartet) * 100)}%`,
                  height: '100%', borderRadius: 2,
                  background: summary.tatsaechlich >= summary.erwartet ? 'var(--green)' : 'var(--amber)',
                  transition: 'width .5s ease',
                }} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 14px 10px', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 10, color: 'var(--text-subtle)', fontVariantNumeric: 'tabular-nums' }}>
          {['versendet', 'in_bearbeitung'].includes(antrag.status) && antrag.versendet_am != null
            ? (() => { const d = daysSince(antrag.versendet_am); return d != null ? `seit ${d} Tag${d === 1 ? '' : 'en'}` : new Date(antrag.erstellt_am).toLocaleDateString('de-DE') })()
            : new Date(antrag.erstellt_am).toLocaleDateString('de-DE')}
        </span>
        {antrag.status === 'entwurf' && onDelete && (
          <span
            onClick={e => { e.stopPropagation(); onDelete() }}
            style={{
              fontSize: 9, fontWeight: 700, color: 'var(--rose)', cursor: 'pointer',
              background: hov ? 'var(--rose-dim)' : 'transparent',
              padding: '1px 7px', borderRadius: 10,
              border: `1px solid ${hov ? 'rgba(240,96,112,.2)' : 'transparent'}`,
              transition: 'all .12s',
            }}
          >Löschen</span>
        )}
      </div>

      {/* Hover overlay */}
      {hov && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'var(--overlay)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'overlay-in 0.15s ease',
          pointerEvents: 'none',
        }}>
          <span style={{
            background: 'var(--primary)', color: '#fff',
            fontSize: 12, fontWeight: 600,
            padding: '8px 16px', borderRadius: 20,
            boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
          }}>Antrag öffnen</span>
        </div>
      )}
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

  const stelleMap = Object.fromEntries(beihilfestellen.map(b => [b.id, b]))
  const pkvMap = Object.fromEntries(pkvListe.map(p => [p.id, p]))

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteAntrag(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['antraege'] }),
  })

  if (antraege.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-subtle)', fontSize: 12 }}>
        Keine Anträge gefunden.
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: 16,
      padding: '18px 24px 32px',
    }}>
      {antraege.map(a => (
        <AntragCard
          key={a.id}
          antrag={a}
          stelle={stelleMap[a.beihilfestelle_id ?? '']}
          pkv={pkvMap[a.pkv_id ?? '']}
          active={a.id === selectedId}
          onClick={() => onSelect(a.id)}
          onDelete={() => deleteMut.mutate(a.id)}
          summary={summaries?.[a.id]}
        />
      ))}
    </div>
  )
}
