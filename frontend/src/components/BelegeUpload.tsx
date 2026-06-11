import React, { useState, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { uploadBeleg } from '../api/belege'
import { getConfig } from '../api/config'
import { canvasesToPdf, fileToGrayscalePdf } from '../utils/imageToGrayscalePdf'
import ScanEditor from './ScanEditor'
import AusstellerSelect, { isLeistungserbringerTyp, isBescheidTyp } from './AusstellerSelect'
import type { BelegTyp } from '../types'

interface Props {
  onUploaded?: () => void
  onCancel?: () => void
  queryKeys?: string[][]
}

export const TYP_LABELS: Record<BelegTyp, string> = {
  rechnung: 'Rechnung',
  erstbescheid: 'Erstbescheid',
  widerspruchsbescheid: 'Widerspruchsbescheid',
  rezept: 'Rezept',
  ueberweisung: 'Überweisung',
  sonstiges: 'Sonstiges',
}


const btnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
  fontSize: 12, color: 'var(--text-muted)', background: 'var(--surface-alt)',
  border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer',
}

const inputStyle: React.CSSProperties = {
  fontSize: 12, padding: '5px 8px',
  border: '1px solid var(--border)', borderRadius: 5,
  background: 'var(--surface)', color: 'var(--text)',
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <label style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{label}</label>
      {children}
    </div>
  )
}

export default function BelegeUpload({ onUploaded, onCancel, queryKeys = [] }: Props) {
  const qc = useQueryClient()
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  const [scanFile, setScanFile] = useState<File | null>(null)
  const [scanPages, setScanPages] = useState<HTMLCanvasElement[]>([])
  const [multipageEnabled, setMultipageEnabled] = useState(true)

  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const [bezeichnung, setBezeichnung] = useState('')
  const [datum, setDatum] = useState('')
  const [eingangsdatum, setEingangsdatum] = useState('')
  const [typ, setTyp] = useState<BelegTyp | ''>('')
  const [aktenzeichen, setAktenzeichen] = useState('')
  const [betrag, setBetrag] = useState('')
  const [aussteller, setAussteller] = useState('')
  const [notiz, setNotiz] = useState('')

  const [pendingFile, setPendingFile] = useState<{ pdf: File; thumb?: Blob } | null>(null)

  useEffect(() => {
    getConfig().then(c => setMultipageEnabled(c.multipage_scan))
  }, [])

  const resetMeta = () => {
    setBezeichnung(''); setDatum(''); setEingangsdatum(''); setTyp('')
    setAktenzeichen(''); setBetrag(''); setAussteller(''); setNotiz('')
  }

  const doUpload = async (pdf: File, thumb?: Blob) => {
    setUploading(true)
    setError(null)
    try {
      await uploadBeleg(pdf, thumb, {
        bezeichnung: bezeichnung || undefined,
        datum: datum || undefined,
        eingangsdatum: eingangsdatum || undefined,
        typ: (typ || undefined) as BelegTyp | undefined,
        aktenzeichen: aktenzeichen || undefined,
        betrag: betrag ? parseFloat(betrag) : undefined,
        aussteller: aussteller || undefined,
        notiz: notiz || undefined,
      })
      for (const key of queryKeys) {
        qc.invalidateQueries({ queryKey: key })
      }
      qc.invalidateQueries({ queryKey: ['belege'] })
      setPendingFile(null)
      resetMeta()
      onUploaded?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload fehlgeschlagen')
    } finally {
      setUploading(false)
    }
  }

  const handleFileInput = (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError(null)
    const arr = Array.from(files)
    const images = arr.filter(f => f.type.startsWith('image/'))
    const pdfs = arr.filter(f => !f.type.startsWith('image/'))
    if (images.length > 0) {
      setScanFile(images[0])
    } else if (pdfs.length > 0) {
      processAndStage(pdfs[0])
    }
    if (cameraRef.current) cameraRef.current.value = ''
    if (fileRef.current) fileRef.current.value = ''
  }

  const processAndStage = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const pdf = await fileToGrayscalePdf(file)
      setPendingFile({ pdf: new File([pdf], file.name.replace(/\.[^.]+$/, '.pdf'), { type: 'application/pdf' }) })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Datei konnte nicht verarbeitet werden')
    } finally {
      setUploading(false)
    }
  }

  const handleScanConfirm = async (canvas: HTMLCanvasElement, addMore: boolean) => {
    const newPages = [...scanPages, canvas]
    if (addMore) {
      setScanPages(newPages)
      setScanFile(null)
      setTimeout(() => cameraRef.current?.click(), 80)
    } else {
      setScanFile(null)
      setScanPages([])
      setUploading(true)
      setError(null)
      try {
        const pdf = await canvasesToPdf(newPages)
        const thumb = await new Promise<Blob | undefined>(resolve => {
          newPages[0].toBlob(b => resolve(b ?? undefined), 'image/jpeg', 0.7)
        })
        setPendingFile({ pdf, thumb })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Scan-Verarbeitung fehlgeschlagen')
      } finally {
        setUploading(false)
        if (cameraRef.current) cameraRef.current.value = ''
      }
    }
  }

  const handleScanCancel = () => {
    setScanFile(null)
    setScanPages([])
    if (cameraRef.current) cameraRef.current.value = ''
  }

  const handleDragEnter = () => { dragCounterRef.current++; setDragOver(true) }
  const handleDragLeave = () => { dragCounterRef.current--; if (dragCounterRef.current === 0) setDragOver(false) }
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault() }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current = 0
    setDragOver(false)
    handleFileInput(e.dataTransfer.files)
  }

  const isBescheid = isBescheidTyp(typ)
  const isLeistungserbringer = isLeistungserbringerTyp(typ)
  const betragLabel = isBescheid ? 'Erstattungsbetrag (€)' : 'Betrag (€)'
  const datumLabel = isBescheid ? 'Bescheid-Datum' : 'Belegdatum'
  const ausstellerLabel = isBescheid
    ? 'Aussteller (Behörde / PKV)'
    : isLeistungserbringer
      ? 'Leistungserbringer'
      : 'Aussteller'

  const handleTypChange = (newTyp: BelegTyp | '') => {
    const wasLeistungserbringer = isLeistungserbringerTyp(typ)
    const wasBescheid = isBescheidTyp(typ)
    const nowLeistungserbringer = isLeistungserbringerTyp(newTyp)
    const nowBescheid = isBescheidTyp(newTyp)
    if (wasLeistungserbringer !== nowLeistungserbringer || wasBescheid !== nowBescheid) {
      setAussteller('')
    }
    setTyp(newTyp)
  }

  // Metadata form (shown after file is staged)
  if (pendingFile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Metadaten (optional)</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>

          {/* Typ – first, drives conditional fields */}
          <FormField label="Typ">
            <select value={typ} onChange={e => handleTypChange(e.target.value as BelegTyp | '')} style={inputStyle}>
              <option value="">– Kein Typ –</option>
              {(Object.entries(TYP_LABELS) as [BelegTyp, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </FormField>

          {/* Aussteller */}
          <FormField label={ausstellerLabel}>
            <AusstellerSelect typ={typ} value={aussteller} onChange={setAussteller} style={inputStyle} />
          </FormField>

          {/* Bezeichnung – full width */}
          <FormField label="Bezeichnung">
            <input value={bezeichnung} onChange={e => setBezeichnung(e.target.value)}
              placeholder={pendingFile.pdf.name} style={{ ...inputStyle, gridColumn: '1 / -1' }} />
          </FormField>

          {/* Datum */}
          <FormField label={datumLabel}>
            <input type="date" value={datum} onChange={e => setDatum(e.target.value)} style={inputStyle} />
          </FormField>

          {/* Eingangsdatum – nur für Bescheide */}
          {isBescheid && (
            <FormField label="Eingangsdatum">
              <input type="date" value={eingangsdatum} onChange={e => setEingangsdatum(e.target.value)} style={inputStyle} />
            </FormField>
          )}

          {/* Aktenzeichen – nur für Bescheide */}
          {isBescheid && (
            <FormField label="Aktenzeichen">
              <input value={aktenzeichen} onChange={e => setAktenzeichen(e.target.value)}
                placeholder="z. B. BVA-2026-12345" style={inputStyle} />
            </FormField>
          )}

          {/* Betrag */}
          <FormField label={betragLabel}>
            <input type="number" step="0.01" min="0" value={betrag}
              onChange={e => setBetrag(e.target.value)} style={inputStyle} />
          </FormField>

          {/* Notiz – full width */}
          <div style={{ gridColumn: '1 / -1' }}>
            <FormField label="Notiz">
              <textarea value={notiz} onChange={e => setNotiz(e.target.value)} rows={2}
                style={{ ...inputStyle, resize: 'vertical', width: '100%', boxSizing: 'border-box' }} />
            </FormField>
          </div>
        </div>

        {error && <p style={{ fontSize: 11, color: 'var(--rose)', margin: 0 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => doUpload(pendingFile.pdf, pendingFile.thumb)}
            disabled={uploading}
            style={{ ...btnStyle, background: 'var(--primary)', color: '#fff', border: 'none', opacity: uploading ? 0.6 : 1 }}
          >
            {uploading ? 'Wird hochgeladen…' : 'Beleg speichern'}
          </button>
          <button
            onClick={() => { setPendingFile(null); onCancel?.() }}
            disabled={uploading}
            style={{ ...btnStyle, opacity: uploading ? 0.5 : 1 }}
          >
            Abbrechen
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {scanFile && (
        <ScanEditor
          file={scanFile}
          multipageEnabled={multipageEnabled}
          pageCount={scanPages.length}
          onConfirm={handleScanConfirm}
          onCancel={handleScanCancel}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment"
          style={{ display: 'none' }} onChange={e => handleFileInput(e.target.files)} />
        <input ref={fileRef} type="file" accept="image/*,application/pdf"
          style={{ display: 'none' }} onChange={e => handleFileInput(e.target.files)} />

        {/* Drop-Zone */}
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: 8,
            padding: '18px 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            background: dragOver ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'transparent',
            transition: 'all 0.15s',
            cursor: uploading ? 'default' : 'pointer',
          }}
          onClick={() => !uploading && fileRef.current?.click()}
        >
          <svg width="28" height="28" fill="none" stroke={dragOver ? 'var(--primary)' : 'var(--text-subtle)'}
            viewBox="0 0 24 24" style={{ transition: 'stroke 0.15s' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          <span style={{ fontSize: 12, color: dragOver ? 'var(--primary)' : 'var(--text-subtle)', fontWeight: dragOver ? 600 : 400 }}>
            {dragOver ? 'Datei ablegen' : 'PDF / Bild hierher ziehen oder klicken'}
          </span>

          {/* Inline-Buttons */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}
            onClick={e => e.stopPropagation()}>
            <button onClick={() => cameraRef.current?.click()} disabled={uploading}
              style={{ ...btnStyle, fontSize: 11, padding: '4px 10px', opacity: uploading ? 0.5 : 1 }}>
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Kamera
            </button>
            {onCancel && (
              <button onClick={onCancel} disabled={uploading}
                style={{ ...btnStyle, fontSize: 11, padding: '4px 10px', opacity: uploading ? 0.5 : 1 }}>
                Abbrechen
              </button>
            )}
          </div>

          {uploading && (
            <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>Wird verarbeitet…</span>
          )}
        </div>

        {error && <p style={{ fontSize: 11, color: 'var(--rose)', margin: 0 }}>{error}</p>}
      </div>
    </>
  )
}
