import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteBeleg, fetchBelegThumbnailBlob } from '../api/belege'
import { TYP_LABELS } from './BelegeUpload'
import { useToast } from '../context/ToastContext'
import type { Beleg, BelegTyp } from '../types'

interface Props {
  beleg: Beleg
  selected?: boolean
  onOpenDetail: (id: string) => void
  onDeleted?: () => void
}

// Typ → CSS-Variable-Ton (matching design)
const TYPE_TONE: Record<BelegTyp, string> = {
  rechnung: 'amber',
  erstbescheid: 'teal',
  widerspruchsbescheid: 'rose',
  rezept: 'green',
  ueberweisung: 'blue',
  sonstiges: 'purple',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function DocThumb({ typ, height = 148 }: { typ: BelegTyp | null; height?: number }) {
  const tone = typ ? TYPE_TONE[typ] : 'purple'
  const lines = [100, 86, 92, 70, 96, 64, 88, 52, 90, 76, 84, 68, 94]
  return (
    <div style={{
      position: 'relative', height, background: 'var(--surface-alt)',
      overflow: 'hidden', display: 'flex', alignItems: 'flex-start',
      justifyContent: 'center', paddingTop: 14,
    }}>
      <div style={{
        width: '64%', height: height + 30,
        background: 'var(--paper)',
        borderRadius: '4px 4px 0 0',
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        padding: '12px 13px 0',
        flexShrink: 0,
      }}>
        <div style={{ height: 4, width: '52%', background: `var(--${tone})`, borderRadius: 2, marginBottom: 4, opacity: 0.85 }} />
        <div style={{ height: 3, width: '34%', background: `var(--${tone})`, borderRadius: 2, marginBottom: 9, opacity: 0.4 }} />
        {lines.map((w, i) => (
          <div key={i} style={{ height: 2.5, width: `${w}%`, background: 'var(--border)', borderRadius: 2, marginBottom: 5, opacity: i === 0 ? 0.85 : 0.5 }} />
        ))}
      </div>
    </div>
  )
}

export default function BelegCard({ beleg, selected, onOpenDetail, onDeleted }: Props) {
  const qc = useQueryClient()
  const { showToast } = useToast()
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pendingDelete, setPendingDelete] = useState(false)
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  const [hovered, setHovered] = useState(false)

  const displayName = beleg.bezeichnung || beleg.dateiname
  const tone = beleg.typ ? TYPE_TONE[beleg.typ] : 'purple'
  const linkedCount = beleg.linked_rechnungen.length + beleg.linked_antraege.length

  useEffect(() => {
    if (!beleg.has_thumbnail) return
    let revoked = false
    fetchBelegThumbnailBlob(beleg.id)
      .then(url => { if (!revoked) setThumbUrl(url) })
      .catch(() => {})
    return () => {
      revoked = true
      if (thumbUrl) URL.revokeObjectURL(thumbUrl)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beleg.id, beleg.has_thumbnail])

  const deleteMut = useMutation({
    mutationFn: () => deleteBeleg(beleg.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['belege'] })
      onDeleted?.()
    },
  })

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setPendingDelete(true)
    deleteTimerRef.current = setTimeout(() => deleteMut.mutate(), 5000)
    showToast(`„${displayName}" wird gelöscht`, {
      label: 'Rückgängig',
      onClick: () => {
        if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
        setPendingDelete(false)
      },
    })
  }

  const ext = beleg.dateiname.split('.').pop()?.toUpperCase() ?? 'PDF'

  return (
    <div
      onClick={() => onOpenDetail(beleg.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--surface)',
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        opacity: pendingDelete ? 0.35 : 1,
        pointerEvents: pendingDelete ? 'none' : undefined,
        cursor: 'pointer',
        border: selected ? '2px solid var(--primary)' : '1px solid var(--border)',
        boxShadow: hovered ? '0 10px 28px rgba(0,0,0,0.2)' : 'none',
        transform: hovered ? 'translateY(-2px)' : 'none',
        transition: 'transform 0.14s, box-shadow 0.14s, border-color 0.14s',
      }}
    >
      {/* Thumbnail area */}
      <div style={{ position: 'relative' }}>
        {thumbUrl ? (
          <div style={{ height: 148, background: 'var(--surface-alt)', overflow: 'hidden' }}>
            <img src={thumbUrl} alt={displayName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ) : (
          <DocThumb typ={beleg.typ} height={148} />
        )}

        {/* Ext tag */}
        <span style={{
          position: 'absolute', top: 8, right: 8,
          fontSize: 8, fontWeight: 800, letterSpacing: '0.06em',
          background: 'var(--surface-hi)', color: 'var(--text-muted)',
          padding: '2px 6px', borderRadius: 5, textTransform: 'uppercase',
        }}>{ext}</span>

        {/* TypeBadge top-left */}
        {beleg.typ && (
          <div style={{ position: 'absolute', top: 8, left: 8 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: `var(--${tone}-dim)`,
              color: `var(--${tone})`,
              border: `1px solid color-mix(in srgb, var(--${tone}) 30%, transparent)`,
              letterSpacing: '0.02em', whiteSpace: 'nowrap',
            }}>
              {TYP_LABELS[beleg.typ]}
            </span>
          </div>
        )}

        {/* Hover overlay */}
        {hovered && (
          <>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'var(--overlay)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'overlay-in 0.15s ease',
            }}>
              <span style={{
                background: 'var(--primary)', color: '#fff',
                fontSize: 12, fontWeight: 600,
                padding: '8px 16px', borderRadius: 20,
                boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
              }}>✎ Öffnen & bearbeiten</span>
            </div>
            <button
              onClick={handleDelete}
              disabled={deleteMut.isPending}
              title="Löschen"
              style={{
                position: 'absolute', top: 7, right: 7,
                width: 26, height: 26, borderRadius: 7,
                border: 'none', cursor: 'pointer',
                background: 'var(--surface)', color: 'var(--rose)',
                fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              }}
            >🗑</button>
          </>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: '10px 13px 12px' }}>
        <div style={{
          fontSize: 12.5, fontWeight: 600, color: 'var(--text)',
          marginBottom: 3, lineHeight: 1.35,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', minHeight: 34,
        }} title={displayName}>
          {displayName}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginBottom: 9, fontVariantNumeric: 'tabular-nums' }}>
          {beleg.datum ? beleg.datum.split('-').reverse().join('.') + ' · ' : ''}
          {formatBytes(beleg.groesse)}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1 }} />
          {linkedCount > 0 ? (
            <span style={{
              fontSize: 9, fontWeight: 700,
              color: 'var(--green)', background: 'var(--green-dim)',
              padding: '2px 7px', borderRadius: 10,
              display: 'flex', alignItems: 'center', gap: 3,
            }}>⛓ {linkedCount}</span>
          ) : (
            <span style={{
              fontSize: 9, fontWeight: 700,
              color: 'var(--amber)', background: 'var(--amber-dim)',
              padding: '2px 7px', borderRadius: 10,
            }}>frei</span>
          )}
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: beleg.ocr_status === 'done' ? 'var(--green)' : 'var(--text-subtle)',
          }}>
            {beleg.ocr_status === 'done' ? 'OCR ✓' : 'OCR ○'}
          </span>
        </div>
      </div>
    </div>
  )
}
