import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  getBeleg, updateBeleg, deleteBeleg, fetchBelegBlob,
  addBelegToRechnung, removeBelegFromRechnung,
  addBelegToAntrag, removeBelegFromAntrag,
  retriggerOcr,
} from '../api/belege'
import { getBeihilfestellen } from '../api/beihilfestellen'
import { getPkv } from '../api/pkv'
import { TYP_LABELS } from './BelegeUpload'
import VerknuepfungPicker from './VerknuepfungPicker'
import { useToast } from '../context/ToastContext'
import type { BelegTyp, Rechnung, BeihilfeAntrag } from '../types'

interface Props {
  belegId: string | null
  onClose: () => void
}

type Tab = 'details' | 'verknuepfungen' | 'inhalt'

const TYPE_TONE: Record<BelegTyp, string> = {
  rechnung: 'amber',
  erstbescheid: 'teal',
  widerspruchsbescheid: 'rose',
  rezept: 'green',
  ueberweisung: 'blue',
  sonstiges: 'purple',
}

const VIEWER_W = 470

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(d: string): string {
  return d.split('-').reverse().join('.')
}

// Faux paper mini-thumbnail used in drawer header
function DocThumb({ typ, height = 58 }: { typ: BelegTyp | null; height?: number }) {
  const tone = typ ? TYPE_TONE[typ] : 'purple'
  return (
    <div style={{
      width: 46, height,
      background: 'var(--surface-alt)',
      borderRadius: 6, overflow: 'hidden',
      border: '1px solid var(--border)',
      display: 'flex', alignItems: 'flex-start',
      justifyContent: 'center', paddingTop: 8,
      flexShrink: 0,
    }}>
      <div style={{
        width: '70%', height: height + 20,
        background: 'var(--paper)',
        borderRadius: '2px 2px 0 0',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        padding: '5px 5px 0',
      }}>
        <div style={{ height: 3, width: '60%', background: `var(--${tone})`, borderRadius: 1, marginBottom: 2, opacity: 0.9 }} />
        <div style={{ height: 2, width: '40%', background: `var(--${tone})`, borderRadius: 1, marginBottom: 5, opacity: 0.4 }} />
        {[90, 80, 95, 70, 85].map((w, i) => (
          <div key={i} style={{ height: 2, width: `${w}%`, background: 'var(--border)', borderRadius: 1, marginBottom: 4, opacity: 0.6 }} />
        ))}
      </div>
    </div>
  )
}

// ── DocViewer (slides in from the right) ────────────────────────────────────
function DocViewer({ belegId, typ, dateiname, groesse, open, onClose }: {
  belegId: string
  typ: BelegTyp | null
  dateiname: string
  groesse: number
  open: boolean
  onClose: () => void
}) {
  const tone = typ ? TYPE_TONE[typ] : 'purple'
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const prevOpen = useRef(false)

  useEffect(() => {
    if (open && !prevOpen.current) {
      fetchBelegBlob(belegId).then(url => setPdfUrl(url)).catch(() => {})
    }
    if (!open && pdfUrl) {
      URL.revokeObjectURL(pdfUrl)
      setPdfUrl(null)
    }
    prevOpen.current = open
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, belegId])

  return (
    <div style={{
      position: 'absolute', top: 0, bottom: 0, right: 0,
      width: VIEWER_W, maxWidth: '46vw',
      background: 'var(--bg)',
      borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      transform: open ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.34s cubic-bezier(0.32,0.72,0,1)',
      zIndex: 1,
    }}>
      {/* Viewer header */}
      <div style={{
        flexShrink: 0, height: 50,
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 14px',
      }}>
        <span style={{ width: 8, height: 8, borderRadius: 3, background: `var(--${tone})`, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {dateiname}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-subtle)', fontVariantNumeric: 'tabular-nums' }}>
            {formatBytes(groesse)}
          </div>
        </div>
        <button onClick={onClose} title="Vorschau schließen" style={{
          width: 28, height: 28, borderRadius: 7,
          border: '1px solid var(--border)', background: 'transparent',
          color: 'var(--text-subtle)', fontSize: 14, cursor: 'pointer', flexShrink: 0,
        }}>×</button>
      </div>

      {/* PDF content */}
      <div style={{ flex: 1, overflow: 'hidden', background: 'var(--surface-alt)' }}>
        {pdfUrl ? (
          <iframe
            src={pdfUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title={dateiname}
          />
        ) : open ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <span style={{ fontSize: 13, color: 'var(--text-subtle)' }}>Lade…</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ── LinkRow ─────────────────────────────────────────────────────────────────
function LinkRow({ accent, primary, secondary, meta, onRemove, onClick }: {
  accent: string
  primary: React.ReactNode
  secondary: React.ReactNode
  meta?: React.ReactNode
  onRemove?: () => void
  onClick?: () => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'stretch', borderRadius: 11,
        border: `1px solid ${hov ? 'var(--border-hi)' : 'var(--border)'}`,
        background: 'var(--surface-alt)', overflow: 'hidden',
        boxShadow: hov ? '0 6px 18px rgba(0,0,0,0.14)' : 'none',
        transition: 'border-color 0.14s, box-shadow 0.14s',
      }}
    >
      <div style={{ width: 3, background: accent, flexShrink: 0 }} />
      <div
        onClick={onClick}
        style={{ flex: 1, minWidth: 0, padding: '11px 14px', cursor: onClick ? 'pointer' : 'default' }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {primary}
          </span>
          {meta != null && <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{meta}</span>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {secondary}
        </div>
      </div>
      {onRemove && (
        <button
          onClick={e => { e.stopPropagation(); onRemove() }}
          title="Verknüpfung entfernen"
          style={{
            width: 42, flexShrink: 0, border: 'none',
            borderLeft: '1px solid var(--border)',
            background: hov ? 'var(--rose-dim)' : 'transparent',
            color: hov ? 'var(--rose)' : 'var(--text-subtle)',
            cursor: 'pointer', fontSize: 17, lineHeight: 1,
            transition: 'background 0.14s, color 0.14s',
          }}
        >×</button>
      )}
    </div>
  )
}

// ── LinkSection ──────────────────────────────────────────────────────────────
function LinkSection({ label, count, hint, children }: {
  label: string; count?: number; hint?: string; children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          {label}
        </span>
        {count != null && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: count > 0 ? 'var(--text-muted)' : 'var(--text-subtle)',
            background: 'var(--surface-hi)', borderRadius: 9,
            padding: '1px 7px', minWidth: 18, textAlign: 'center',
          }}>{count}</span>
        )}
        {hint && <span style={{ fontSize: 10, color: 'var(--text-subtle)', marginLeft: 'auto' }}>{hint}</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 12, color: 'var(--text-subtle)',
      padding: '12px 14px', border: '1px dashed var(--border)',
      borderRadius: 10, textAlign: 'center',
    }}>{text}</div>
  )
}

// ── InhaltTab ────────────────────────────────────────────────────────────────
function InhaltTab({ beleg, onRetriggerOcr, isPending }: {
  beleg: { ocr_status: string | null; ocr_text: string | null; hochgeladen_am: string }
  onRetriggerOcr: () => void
  isPending: boolean
}) {
  const [q, setQ] = useState('')
  const text = beleg.ocr_text ?? ''
  const chars = text.length

  const highlighted = useMemo(() => {
    if (!q.trim() || !text) return [{ t: text, match: false }]
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
    return parts.map(part => ({ t: part, match: part.toLowerCase() === q.toLowerCase() }))
  }, [q, text])

  const matchCount = highlighted.filter(p => p.match).length

  const copy = () => {
    navigator.clipboard?.writeText(text).catch(() => {})
  }

  if (beleg.ocr_status !== 'done' || !text) {
    return (
      <div style={{ textAlign: 'center', padding: '44px 20px', animation: 'tab-in 0.2s ease' }}>
        <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.4 }}>📄</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>
          {beleg.ocr_status === 'done' ? 'Kein Text erkannt' : beleg.ocr_status === 'failed' ? 'Texterkennung fehlgeschlagen' : beleg.ocr_status === 'unavailable' ? 'Nicht verfügbar' : 'Keine Texterkennung'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginBottom: 18 }}>
          {beleg.ocr_status === 'done'
            ? 'Leeres Dokument oder Scan-Qualität zu gering.'
            : beleg.ocr_status === null
              ? 'Texterkennung läuft…'
              : beleg.ocr_status === 'unavailable'
                ? 'Kein OCR-Tool installiert.'
                : 'Für diesen Beleg liegt noch kein OCR-Text vor.'}
        </div>
        {beleg.ocr_status !== 'unavailable' && beleg.ocr_status !== null && (
          <button
            onClick={onRetriggerOcr}
            disabled={isPending}
            style={{
              background: 'var(--primary)', color: '#fff', border: 'none',
              borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600,
              cursor: isPending ? 'default' : 'pointer', opacity: isPending ? 0.6 : 1,
            }}
          >
            Texterkennung starten
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ animation: 'tab-in 0.2s ease' }}>
      {/* Status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        padding: '10px 14px', borderRadius: 11,
        background: 'var(--green-dim)',
        border: '1px solid color-mix(in srgb, var(--green) 22%, transparent)',
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{
            width: 18, height: 18, borderRadius: '50%', background: 'var(--green)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0,
          }}>✓</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--green)' }}>Abgeschlossen</span>
          <span style={{ color: 'var(--text-subtle)' }}>·</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
            {chars.toLocaleString('de-DE')} Zeichen
          </span>
        </div>
        <button
          onClick={onRetriggerOcr}
          disabled={isPending}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 8, padding: '7px 14px', fontSize: 12,
            color: 'var(--text-muted)', cursor: isPending ? 'default' : 'pointer',
            opacity: isPending ? 0.5 : 1, flexShrink: 0, transition: 'background 0.12s',
          }}
        >↻ OCR wiederholen</button>
      </div>

      {/* Search + Copy */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-subtle)', fontSize: 13 }}>⌕</span>
          <input
            className="field"
            style={{ paddingLeft: 30, paddingRight: q.trim() ? 64 : 12, width: '100%', boxSizing: 'border-box' }}
            placeholder="Im erkannten Text suchen…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          {q.trim() && (
            <span style={{
              position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)',
              fontSize: 10, color: 'var(--text-subtle)', fontVariantNumeric: 'tabular-nums',
            }}>{matchCount} Treffer</span>
          )}
        </div>
        <button
          onClick={copy}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 8, padding: '7px 14px', fontSize: 12,
            color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0,
            transition: 'background 0.12s',
          }}
        >⧉ Kopieren</button>
      </div>

      {/* OCR text */}
      <div style={{
        background: 'var(--surface-alt)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '16px 18px',
        fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.7,
        color: 'var(--text-muted)', whiteSpace: 'pre-wrap',
        maxHeight: 'calc(100vh - 360px)', overflowY: 'auto',
      }}>
        {highlighted.map((part, i) =>
          part.match
            ? <mark key={i} style={{ background: 'var(--amber)', color: '#000', borderRadius: 2, padding: '0 1px' }}>{part.t}</mark>
            : <span key={i}>{part.t}</span>
        )}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-subtle)', marginTop: 10 }}>
        Hochgeladen am {new Date(beleg.hochgeladen_am).toLocaleDateString('de-DE')} · Volltext durchsuchbar
      </div>
    </div>
  )
}

// ── Field ────────────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 5 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

const FIELD_STYLE: React.CSSProperties = {
  width: '100%', background: 'var(--surface-alt)',
  border: '1px solid var(--border)', borderRadius: 8,
  padding: '8px 12px', fontSize: 13, color: 'var(--text)',
  outline: 'none', boxSizing: 'border-box',
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function BelegDetailSlider({ belegId, onClose }: Props) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [tab, setTab] = useState<Tab>('details')
  const [showPicker, setShowPicker] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [sessionLinkedR, setSessionLinkedR] = useState<string[]>([])
  const [sessionUnlinkedR, setSessionUnlinkedR] = useState<string[]>([])
  const [sessionLinkedA, setSessionLinkedA] = useState<string[]>([])
  const [sessionUnlinkedA, setSessionUnlinkedA] = useState<string[]>([])

  const { data: beleg, isLoading } = useQuery({
    queryKey: ['beleg', belegId],
    queryFn: () => getBeleg(belegId!),
    enabled: !!belegId,
    staleTime: 0,
  })

  const [bezeichnung, setBezeichnung] = useState('')
  const [typ, setTyp] = useState<BelegTyp | ''>('')
  const [datum, setDatum] = useState('')
  const [notiz, setNotiz] = useState('')
  const [stelleVal, setStelleVal] = useState('')  // '' | 'bh:{id}' | 'pkv:{id}'

  const { data: beihilfestellen = [] } = useQuery({ queryKey: ['beihilfestellen'], queryFn: getBeihilfestellen })
  const { data: pkvListe = [] } = useQuery({ queryKey: ['pkv'], queryFn: getPkv })

  useEffect(() => {
    if (beleg) {
      setBezeichnung(beleg.bezeichnung ?? '')
      setTyp(beleg.typ ?? '')
      setDatum(beleg.datum ?? '')
      setNotiz(beleg.notiz ?? '')
      if (beleg.beihilfestelle_id) setStelleVal(`bh:${beleg.beihilfestelle_id}`)
      else if (beleg.pkv_id) setStelleVal(`pkv:${beleg.pkv_id}`)
      else setStelleVal('')
      setSaveError(null)
    }
  }, [beleg?.id])

  // ESC: first close viewer, then panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewerOpen) setViewerOpen(false)
        else onClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, viewerOpen])

  // Close viewer when belegId changes
  useEffect(() => { setViewerOpen(false) }, [belegId])

  const saveMut = useMutation({
    mutationFn: () => updateBeleg(belegId!, {
      bezeichnung: bezeichnung || null,
      typ: (typ || null) as BelegTyp | null,
      datum: datum || null,
      notiz: notiz || null,
      beihilfestelle_id: stelleVal.startsWith('bh:') ? stelleVal.slice(3) : null,
      pkv_id: stelleVal.startsWith('pkv:') ? stelleVal.slice(4) : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['belege'] })
      qc.invalidateQueries({ queryKey: ['beleg', belegId] })
      setSaveError(null)
      showToast('Beleg gespeichert')
    },
    onError: (e: Error) => setSaveError(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: () => deleteBeleg(belegId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['belege'] })
      onClose()
    },
  })

  const ocrMut = useMutation({
    mutationFn: () => retriggerOcr(belegId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['beleg', belegId] })
      qc.invalidateQueries({ queryKey: ['belege'] })
      showToast('Texterkennung gestartet')
    },
  })

  const handleDelete = () => {
    const name = beleg?.bezeichnung || beleg?.dateiname || 'Beleg'
    deleteMut.mutate()
    showToast(`„${name}" gelöscht`, { label: 'Rückgängig', onClick: () => {} })
  }

  const linkRechnungMut = useMutation({
    mutationFn: (r: Rechnung) => addBelegToRechnung(r.id, belegId!),
    onMutate: (r) => setSessionLinkedR(p => p.includes(r.id) ? p : [...p, r.id]),
    onSuccess: (_, r) => { setSessionLinkedR(p => p.filter(x => x !== r.id)); qc.invalidateQueries({ queryKey: ['belege'] }); qc.invalidateQueries({ queryKey: ['beleg', belegId] }) },
    onError: (_e, r) => setSessionLinkedR(p => p.filter(x => x !== r.id)),
  })
  const unlinkRechnungMut = useMutation({
    mutationFn: (id: string) => removeBelegFromRechnung(id, belegId!),
    onMutate: (id) => setSessionUnlinkedR(p => [...p, id]),
    onSuccess: (_, id) => { setSessionUnlinkedR(p => p.filter(x => x !== id)); qc.invalidateQueries({ queryKey: ['belege'] }); qc.invalidateQueries({ queryKey: ['beleg', belegId] }); showToast('Verknüpfung entfernt') },
    onError: (_e, id) => setSessionUnlinkedR(p => p.filter(x => x !== id)),
  })
  const linkAntragMut = useMutation({
    mutationFn: (a: BeihilfeAntrag) => addBelegToAntrag(a.id, belegId!),
    onMutate: (a) => setSessionLinkedA(p => p.includes(a.id) ? p : [...p, a.id]),
    onSuccess: (_, a) => { setSessionLinkedA(p => p.filter(x => x !== a.id)); qc.invalidateQueries({ queryKey: ['belege'] }); qc.invalidateQueries({ queryKey: ['beleg', belegId] }) },
    onError: (_e, a) => setSessionLinkedA(p => p.filter(x => x !== a.id)),
  })
  const unlinkAntragMut = useMutation({
    mutationFn: (id: string) => removeBelegFromAntrag(id, belegId!),
    onMutate: (id) => setSessionUnlinkedA(p => [...p, id]),
    onSuccess: (_, id) => { setSessionUnlinkedA(p => p.filter(x => x !== id)); qc.invalidateQueries({ queryKey: ['belege'] }); qc.invalidateQueries({ queryKey: ['beleg', belegId] }); showToast('Verknüpfung entfernt') },
    onError: (_e, id) => setSessionUnlinkedA(p => p.filter(x => x !== id)),
  })

  if (!belegId) return null

  const displayLinkedR = beleg
    ? beleg.linked_rechnungen.filter(r => !sessionUnlinkedR.includes(r.id))
    : []
  const displayLinkedA = beleg
    ? beleg.linked_antraege.filter(a => !sessionUnlinkedA.includes(a.id))
    : []

  const excludeRechnungIds = beleg
    ? [...beleg.linked_rechnungen.map(r => r.id).filter(id => !sessionUnlinkedR.includes(id)), ...sessionLinkedR]
    : []
  const excludeAntragIds = beleg
    ? [...beleg.linked_antraege.map(a => a.id).filter(id => !sessionUnlinkedA.includes(id)), ...sessionLinkedA]
    : []

  const totalLinks = displayLinkedR.length + displayLinkedA.length
  const belegTyp = beleg?.typ ?? null

  const TABS = [
    { id: 'details' as Tab, label: 'Details' },
    { id: 'verknuepfungen' as Tab, label: 'Verknüpfungen', count: totalLinks },
    { id: 'inhalt' as Tab, label: 'Inhalt', tag: 'OCR', tagDone: beleg?.ocr_status === 'done' },
  ]

  const viewerOffset = viewerOpen ? VIEWER_W : 0

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'var(--overlay)',
          animation: 'overlay-in 0.2s ease',
        }}
      />

      {/* DocViewer (right edge, behind panel) */}
      {beleg && (
        <div style={{ position: 'fixed', top: 0, bottom: 0, right: 0, zIndex: 101 }}>
          <DocViewer
            belegId={belegId}
            typ={belegTyp}
            dateiname={beleg.dateiname}
            groesse={beleg.groesse}
            open={viewerOpen}
            onClose={() => setViewerOpen(false)}
          />
        </div>
      )}

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, bottom: 0,
        right: viewerOffset,
        width: '100%', maxWidth: 600,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-12px 0 48px rgba(0,0,0,0.32)',
        zIndex: 102,
        transition: 'right 0.34s cubic-bezier(0.32,0.72,0,1)',
      }}>
        {/* Header */}
        <div style={{ flexShrink: 0, borderBottom: '1px solid var(--border)', padding: '14px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
            {/* Mini DocThumb */}
            <DocThumb typ={belegTyp} height={58} />

            <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                {belegTyp && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    background: `var(--${TYPE_TONE[belegTyp]}-dim)`,
                    color: `var(--${TYPE_TONE[belegTyp]})`,
                    border: `1px solid color-mix(in srgb, var(--${TYPE_TONE[belegTyp]}) 30%, transparent)`,
                    letterSpacing: '0.02em',
                  }}>
                    {TYP_LABELS[belegTyp]}
                  </span>
                )}
                {beleg?.datum && (
                  <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatDate(beleg.datum)}
                  </span>
                )}
              </div>
              <div style={{
                fontSize: 15, fontWeight: 700, color: 'var(--text)',
                letterSpacing: '-0.01em', lineHeight: 1.3,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {isLoading ? '…' : (beleg?.bezeichnung || beleg?.dateiname)}
              </div>
              {beleg && (
                <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                  {formatBytes(beleg.groesse)} · {new Date(beleg.hochgeladen_am).toLocaleDateString('de-DE')}
                </div>
              )}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => setViewerOpen(o => !o)}
                style={{
                  padding: '6px 12px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5,
                  background: viewerOpen ? 'var(--primary-dim)' : 'transparent',
                  borderColor: viewerOpen ? 'var(--primary)' : 'var(--border)',
                  color: viewerOpen ? 'var(--primary)' : 'var(--text-muted)',
                  border: '1px solid', borderRadius: 8, cursor: 'pointer', fontWeight: 500,
                  transition: 'background 0.12s',
                }}
              >⤢ Vorschau</button>
              <button onClick={onClose} style={{
                width: 32, height: 32, borderRadius: 8,
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text-subtle)', fontSize: 16, cursor: 'pointer',
              }}>×</button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4 }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
                  padding: '10px 14px', fontSize: 13,
                  fontWeight: tab === t.id ? 600 : 400,
                  color: tab === t.id ? 'var(--primary)' : 'var(--text-muted)',
                  borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
                  marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {t.label}
                {t.count != null && (
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    background: tab === t.id ? 'var(--primary)' : 'var(--surface-hi)',
                    color: tab === t.id ? '#fff' : 'var(--text-subtle)',
                    borderRadius: 9, padding: '0 6px', minWidth: 18, textAlign: 'center',
                  }}>{t.count}</span>
                )}
                {t.tag && (
                  <span style={{
                    fontSize: 8, fontWeight: 700, letterSpacing: '0.05em',
                    color: t.tagDone ? 'var(--green)' : 'var(--text-subtle)',
                    border: `1px solid ${t.tagDone ? 'var(--green)' : 'var(--border-hi)'}`,
                    borderRadius: 5, padding: '1px 4px',
                  }}>{t.tag}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {isLoading && <p style={{ fontSize: 13, color: 'var(--text-subtle)' }}>Lade…</p>}

          {/* ── Details ── */}
          {!isLoading && beleg && tab === 'details' && (
            <div style={{ animation: 'tab-in 0.2s ease' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 14px', marginBottom: 18 }}>
                <Field label="Typ">
                  <select value={typ} onChange={e => setTyp(e.target.value as BelegTyp | '')} style={FIELD_STYLE}>
                    <option value="">– kein Typ –</option>
                    {(Object.entries(TYP_LABELS) as [BelegTyp, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Stelle">
                  <select value={stelleVal} onChange={e => setStelleVal(e.target.value)} style={FIELD_STYLE}>
                    <option value="">– keine –</option>
                    {beihilfestellen.length > 0 && (
                      <optgroup label="Beihilfestelle">
                        {beihilfestellen.map(b => <option key={b.id} value={`bh:${b.id}`}>{b.name}</option>)}
                      </optgroup>
                    )}
                    {pkvListe.length > 0 && (
                      <optgroup label="PKV">
                        {pkvListe.map(p => <option key={p.id} value={`pkv:${p.id}`}>{p.name}</option>)}
                      </optgroup>
                    )}
                  </select>
                </Field>
                <Field label="Datum">
                  <input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={FIELD_STYLE} />
                </Field>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Field label="Bezeichnung">
                    <input value={bezeichnung} onChange={e => setBezeichnung(e.target.value)}
                      placeholder={beleg.dateiname} style={FIELD_STYLE} />
                  </Field>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Field label="Notiz">
                    <textarea value={notiz} onChange={e => setNotiz(e.target.value)}
                      placeholder="Notiz hinzufügen…" rows={3}
                      style={{ ...FIELD_STYLE, resize: 'vertical', minHeight: 72, lineHeight: 1.5 }} />
                  </Field>
                </div>
              </div>

              {saveError && <p style={{ fontSize: 12, color: 'var(--rose)', margin: '0 0 10px' }}>{saveError}</p>}

              <button
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending}
                style={{
                  background: 'var(--primary)', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600,
                  cursor: saveMut.isPending ? 'default' : 'pointer',
                  opacity: saveMut.isPending ? 0.6 : 1, transition: 'opacity 0.15s',
                }}
              >
                {saveMut.isPending ? 'Speichern…' : 'Speichern'}
              </button>

              {/* Trennlinie */}
              <div style={{ height: 1, background: 'var(--border)', margin: '24px 0 18px' }} />

              {/* Datei-Metadaten */}
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 14 }}>
                Datei
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '18px 28px', marginBottom: 24 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>Dateiname</div>
                  <div style={{ fontSize: 13, color: 'var(--text)', wordBreak: 'break-word', lineHeight: 1.45 }}>{beleg.dateiname}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>Größe</div>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{formatBytes(beleg.groesse)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>Hochgeladen</div>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{new Date(beleg.hochgeladen_am).toLocaleDateString('de-DE')}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-subtle)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>Texterkennung</div>
                  {beleg.ocr_status === 'done'
                    ? <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600, whiteSpace: 'nowrap' }}>✓ Abgeschlossen</div>
                    : <div style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 600, whiteSpace: 'nowrap' }}>○ Ausstehend</div>}
                </div>
              </div>

              <button
                onClick={handleDelete}
                disabled={deleteMut.isPending}
                style={{
                  background: 'var(--rose-dim)', border: '1px solid color-mix(in srgb, var(--rose) 30%, transparent)',
                  color: 'var(--rose)', borderRadius: 8, padding: '8px 16px',
                  fontSize: 13, fontWeight: 600, cursor: deleteMut.isPending ? 'default' : 'pointer',
                  opacity: deleteMut.isPending ? 0.5 : 1,
                }}
              >
                Beleg löschen
              </button>
            </div>
          )}

          {/* ── Verknüpfungen ── */}
          {!isLoading && beleg && tab === 'verknuepfungen' && (
            <div style={{ animation: 'tab-in 0.2s ease' }}>
              {/* Summary */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 11,
                background: 'var(--surface-alt)', border: '1px solid var(--border)',
                marginBottom: 18,
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: totalLinks > 0 ? 'var(--green)' : 'var(--amber)',
                  background: totalLinks > 0 ? 'var(--green-dim)' : 'var(--amber-dim)',
                  borderRadius: 9, padding: '2px 9px',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>⛓ {totalLinks}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {totalLinks === 0 ? 'Noch keine Verknüpfung' : `${totalLinks === 1 ? 'Verknüpfung' : 'Verknüpfungen'} mit diesem Beleg`}
                </span>
              </div>

              {/* Rechnungen */}
              <LinkSection label="Rechnungen" count={displayLinkedR.length}>
                {displayLinkedR.length === 0 && <EmptyHint text="Noch keine Rechnung verknüpft" />}
                {displayLinkedR.map(r => (
                  <LinkRow
                    key={r.id}
                    accent="var(--amber)"
                    primary={(r.betrag / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    secondary={`${r.leistungserbringer} · ${r.person}`}
                    meta={formatDate(r.datum)}
                    onRemove={() => unlinkRechnungMut.mutate(r.id)}
                    onClick={() => { onClose(); navigate(`/rechnungen?rechnung=${r.id}`) }}
                  />
                ))}
              </LinkSection>

              {/* Anträge */}
              <LinkSection label="Anträge" count={displayLinkedA.length}>
                {displayLinkedA.length === 0 && <EmptyHint text="Noch kein Antrag verknüpft" />}
                {displayLinkedA.map(a => (
                  <LinkRow
                    key={a.id}
                    accent="var(--primary)"
                    primary={
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 9, padding: '2px 6px', borderRadius: 8, fontWeight: 700,
                          background: a.typ === 'pkv' ? 'var(--blue-dim)' : 'var(--teal-dim)',
                          color: a.typ === 'pkv' ? 'var(--blue)' : 'var(--teal)',
                          border: 'transparent',
                        }}>{a.typ === 'pkv' ? 'PKV' : 'BH'}</span>
                        #{a.referenz_nr}
                      </span>
                    }
                    secondary={a.stelle ?? 'Kein Titel'}
                    onRemove={() => unlinkAntragMut.mutate(a.id)}
                    onClick={() => { onClose(); navigate(`/beihilfe-antraege?antrag=${a.id}`) }}
                  />
                ))}
              </LinkSection>

              {/* Add-Button */}
              <button
                onClick={() => setShowPicker(true)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  border: '1px dashed var(--border-hi)', background: 'transparent',
                  color: 'var(--primary)', borderRadius: 11, padding: 11,
                  fontSize: 12.5, fontWeight: 600, cursor: 'pointer', transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--row-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> Verknüpfung hinzufügen
              </button>
            </div>
          )}

          {/* ── Inhalt (OCR) ── */}
          {!isLoading && beleg && tab === 'inhalt' && (
            <InhaltTab
              beleg={beleg}
              onRetriggerOcr={() => ocrMut.mutate()}
              isPending={ocrMut.isPending}
            />
          )}
        </div>
      </div>

      {showPicker && (
        <VerknuepfungPicker
          excludeRechnungIds={excludeRechnungIds}
          excludeAntragIds={excludeAntragIds}
          onSelectRechnung={r => { linkRechnungMut.mutate(r); setShowPicker(false) }}
          onSelectAntrag={a => { linkAntragMut.mutate(a); setShowPicker(false) }}
          onCancel={() => setShowPicker(false)}
        />
      )}
    </>
  )
}
