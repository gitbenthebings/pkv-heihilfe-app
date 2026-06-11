import React, { useState, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getBelege, uploadBeleg } from '../api/belege'
import BelegCard from '../components/BelegCard'
import BelegeUpload from '../components/BelegeUpload'
import { fileToGrayscalePdf } from '../utils/imageToGrayscalePdf'
import type { BelegTyp } from '../types'

const TYP_FILTER: Array<{ value: BelegTyp | ''; label: string }> = [
  { value: '', label: 'Alle' },
  { value: 'rechnung', label: 'Rechnung' },
  { value: 'erstbescheid', label: 'Erstbescheid' },
  { value: 'widerspruchsbescheid', label: 'Widerspruchsbescheid' },
  { value: 'rezept', label: 'Rezept' },
  { value: 'ueberweisung', label: 'Überweisung' },
  { value: 'sonstiges', label: 'Sonstiges' },
]

export default function BelegePage() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [typFilter, setTypFilter] = useState<BelegTyp | ''>('')
  const [datumVon, setDatumVon] = useState('')
  const [datumBis, setDatumBis] = useState('')
  const [showUpload, setShowUpload] = useState(false)

  // Seitenweites Drag & Drop
  const dragCounterRef = useRef(0)
  const [pageDragOver, setPageDragOver] = useState(false)
  const [batchUploading, setBatchUploading] = useState(false)
  const [batchError, setBatchError] = useState<string | null>(null)

  const handlePageDragEnter = () => {
    dragCounterRef.current++
    setPageDragOver(true)
  }
  const handlePageDragLeave = () => {
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setPageDragOver(false)
  }
  const handlePageDragOver = (e: React.DragEvent) => { e.preventDefault() }

  const handlePageDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current = 0
    setPageDragOver(false)
    setBatchError(null)

    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type === 'application/pdf' ||
      f.name.toLowerCase().endsWith('.pdf') ||
      f.type.startsWith('image/')
    )
    if (files.length === 0) return

    setBatchUploading(true)
    let errors = 0
    for (const file of files) {
      try {
        let pdf: File
        if (file.type.startsWith('image/')) {
          const pdfBlob = await fileToGrayscalePdf(file)
          pdf = new File([pdfBlob], file.name.replace(/\.[^.]+$/, '.pdf'), { type: 'application/pdf' })
        } else {
          pdf = file
        }
        const baseName = file.name.replace(/\.[^.]+$/, '')
        await uploadBeleg(pdf, undefined, { bezeichnung: baseName })
      } catch {
        errors++
      }
    }
    qc.invalidateQueries({ queryKey: ['belege'] })
    setBatchUploading(false)
    if (errors > 0) setBatchError(`${errors} Datei(en) konnten nicht hochgeladen werden`)
  }

  const queryKey = ['belege', q, typFilter, datumVon, datumBis]

  const { data: belege = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: () => getBelege({
      q: q || undefined,
      typ: (typFilter || undefined) as BelegTyp | undefined,
      datum_von: datumVon || undefined,
      datum_bis: datumBis || undefined,
    }),
    refetchInterval: (query) => {
      const items = query.state.data as import('../types').Beleg[] | undefined
      return items?.some((b: import('../types').Beleg) => !b.has_thumbnail || b.ocr_status === null) ? 4000 : false
    },
  })

  return (
    <div
      style={{ padding: '20px 24px', maxWidth: 1200, margin: '0 auto', position: 'relative' }}
      onDragEnter={handlePageDragEnter}
      onDragLeave={handlePageDragLeave}
      onDragOver={handlePageDragOver}
      onDrop={handlePageDrop}
    >
      {/* Drag-Overlay */}
      {pageDragOver && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
          border: '3px dashed var(--primary)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 12, pointerEvents: 'none',
        }}>
          <svg width="56" height="56" fill="none" stroke="var(--primary)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)' }}>
            Belege hier ablegen
          </span>
          <span style={{ fontSize: 13, color: 'var(--primary)', opacity: 0.7 }}>
            PDF oder Bilder – OCR läuft automatisch
          </span>
        </div>
      )}

      {/* Batch-Upload-Fortschritt */}
      {batchUploading && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 200,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}>
          <svg width="16" height="16" fill="none" stroke="var(--primary)" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span style={{ fontSize: 13, color: 'var(--text)' }}>Belege werden hochgeladen…</span>
        </div>
      )}
      {batchError && !batchUploading && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--rose-dim, #fee2e2)', borderRadius: 7, fontSize: 12, color: 'var(--rose)' }}>
          {batchError} <button onClick={() => setBatchError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', fontWeight: 600, marginLeft: 6 }}>✕</button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Belege</h1>
          <p style={{ fontSize: 12, color: 'var(--text-subtle)', margin: '2px 0 0' }}>Dokumentenarchiv · Drag & Drop zum Importieren</p>
        </div>
        <button
          onClick={() => setShowUpload(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', fontSize: 13, fontWeight: 500,
            background: 'var(--primary)', color: '#fff',
            border: 'none', borderRadius: 7, cursor: 'pointer',
          }}
        >
          {showUpload ? '✕ Schließen' : '+ Neuer Beleg'}
        </button>
      </div>

      {/* Upload Panel */}
      {showUpload && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: 20,
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px', color: 'var(--text)' }}>Neuer Beleg</p>
          <BelegeUpload
            queryKeys={[queryKey]}
            onUploaded={() => { setShowUpload(false); qc.invalidateQueries({ queryKey: ['belege'] }) }}
            onCancel={() => setShowUpload(false)}
          />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {/* Search */}
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Suche nach Bezeichnung, Notiz, Dateiname…"
          style={{
            fontSize: 13, padding: '8px 12px',
            border: '1px solid var(--border)', borderRadius: 7,
            background: 'var(--surface)', color: 'var(--text)',
            width: '100%', boxSizing: 'border-box',
          }}
        />

        {/* Type chips + date range */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {TYP_FILTER.map(f => (
            <button
              key={f.value}
              onClick={() => setTypFilter(f.value)}
              style={{
                fontSize: 12, padding: '4px 12px',
                borderRadius: 20, border: '1px solid var(--border)',
                background: typFilter === f.value ? 'var(--primary)' : 'var(--surface-alt)',
                color: typFilter === f.value ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer', fontWeight: typFilter === f.value ? 600 : 400,
              }}
            >
              {f.label}
            </button>
          ))}

          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-subtle)' }}>von</span>
          <input
            type="date"
            value={datumVon}
            onChange={e => setDatumVon(e.target.value)}
            style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface-alt)', color: 'var(--text)' }}
          />
          <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>bis</span>
          <input
            type="date"
            value={datumBis}
            onChange={e => setDatumBis(e.target.value)}
            style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface-alt)', color: 'var(--text)' }}
          />
          {(datumVon || datumBis) && (
            <button
              onClick={() => { setDatumVon(''); setDatumBis('') }}
              style={{ fontSize: 11, color: 'var(--text-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ✕ Datum
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {isLoading && (
        <p style={{ fontSize: 13, color: 'var(--text-subtle)', textAlign: 'center', padding: 40 }}>Lade…</p>
      )}

      {error && (
        <p style={{ fontSize: 13, color: 'var(--rose)', textAlign: 'center', padding: 20 }}>
          Fehler beim Laden der Belege
        </p>
      )}

      {!isLoading && !error && belege.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-subtle)' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.3, margin: '0 auto 12px', display: 'block' }}>
            <path d="M20 2H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zm-1 14H9V4h10v12zM4 6H2v14a2 2 0 002 2h14v-2H4V6z" />
          </svg>
          <p style={{ fontSize: 14, margin: 0 }}>
            {q || typFilter || datumVon || datumBis
              ? 'Keine Belege gefunden'
              : 'Noch keine Belege vorhanden – klicke auf „+ Neuer Beleg"'}
          </p>
        </div>
      )}

      {!isLoading && belege.length > 0 && (
        <>
          <p style={{ fontSize: 11, color: 'var(--text-subtle)', margin: '0 0 12px' }}>
            {belege.length} {belege.length === 1 ? 'Beleg' : 'Belege'}
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 16,
          }}>
            {belege.map(b => (
              <BelegCard key={b.id} beleg={b} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
