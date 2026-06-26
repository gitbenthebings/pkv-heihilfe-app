import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getBescheidAnhaenge, uploadBescheidAnhang, deleteBescheidAnhang,
  fetchBescheidAnhangBlob, fetchBescheidAnhangFile,
  triggerBescheidOcr, getBescheidVorschlag,
} from '../api/bescheid_anhaenge'
import { getConfig } from '../api/config'
import { fileToGrayscalePdf, canvasesToPdf } from '../utils/imageToGrayscalePdf'
import ScanEditor from './ScanEditor'
import type { BescheidAnhang, BescheidVorschlag } from '../types'

interface Props {
  antragId: string
  bescheidId: string
  onVorschlag?: (v: BescheidVorschlag) => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function PdfIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-red-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 2H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zm-1 14H9V4h10v12zM4 6H2v14a2 2 0 002 2h14v-2H4V6z" />
    </svg>
  )
}

function OcrBadge({ status, running }: { status?: string | null; running: boolean }) {
  if (running) return (
    <span style={{ fontSize: 10, color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
      <span style={{ display: 'inline-block', width: 10, height: 10, border: '1.5px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      OCR…
    </span>
  )
  if (status === 'done') return <span style={{ fontSize: 10, color: 'var(--green)', flexShrink: 0 }}>✓ OCR</span>
  if (status === 'failed') return <span style={{ fontSize: 10, color: 'var(--rose)', flexShrink: 0 }}>OCR fehlgeschlagen</span>
  if (status === 'unavailable') return <span style={{ fontSize: 10, color: 'var(--amber)', flexShrink: 0 }}>Kein Tesseract</span>
  return null
}

export default function BescheidAnhangUpload({ antragId, bescheidId, onVorschlag }: Props) {
  const qc = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [sharingId, setSharingId] = useState<string | null>(null)
  const [ocrTriggeringId, setOcrTriggeringId] = useState<string | null>(null)
  const [vorschlagLoadingId, setVorschlagLoadingId] = useState<string | null>(null)

  // IDs die gerade OCR laufen haben (upload oder manuell getriggert)
  const [triggeredIds, setTriggeredIds] = useState<Set<string>>(new Set())
  const [polling, setPolling] = useState(false)

  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [scanFile, setScanFile] = useState<File | null>(null)
  const [scanPages, setScanPages] = useState<HTMLCanvasElement[]>([])
  const [multipageEnabled, setMultipageEnabled] = useState(true)

  useEffect(() => {
    getConfig().then(c => setMultipageEnabled(c.multipage_scan))
  }, [])

  const queryKey = ['bescheid-anhaenge', bescheidId]

  const { data: anhaenge = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => getBescheidAnhaenge(antragId, bescheidId),
    refetchInterval: polling ? 2000 : false,
  })

  // Polling stoppen sobald alle getriggerten Anhänge einen Status haben
  useEffect(() => {
    if (!polling || triggeredIds.size === 0) return
    const triggered = anhaenge.filter(a => triggeredIds.has(a.id))
    if (triggered.length > 0 && triggered.every(a => a.ocr_status != null)) {
      setPolling(false)
      setTriggeredIds(new Set())
    }
  }, [anhaenge, polling, triggeredIds])

  function markTriggered(id: string) {
    setTriggeredIds(prev => { const s = new Set(prev); s.add(id); return s })
    setPolling(true)
  }

  const uploadFile = async (file: File, index: number) => {
    const nr = String(index).padStart(2, '0')
    const filename = `bescheid_${nr}.pdf`
    const anhang = await uploadBescheidAnhang(antragId, bescheidId, new File([file], filename, { type: 'application/pdf' }))
    markTriggered(anhang.id)
  }

  const uploadFiles = async (files: File[]) => {
    setUploadError(null)
    setUploading(true)
    try {
      for (let i = 0; i < files.length; i++) {
        const pdf = await fileToGrayscalePdf(files[i])
        await uploadFile(new File([pdf], 'x.pdf', { type: 'application/pdf' }), anhaenge.length + i + 1)
      }
      qc.invalidateQueries({ queryKey })
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload fehlgeschlagen')
    } finally {
      setUploading(false)
      if (cameraRef.current) cameraRef.current.value = ''
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleFileInput = (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploadError(null)
    const arr = Array.from(files)
    const images = arr.filter(f => f.type.startsWith('image/'))
    const pdfs = arr.filter(f => !f.type.startsWith('image/'))
    if (images.length > 0) setScanFile(images[0])
    if (pdfs.length > 0) uploadFiles(pdfs)
    if (cameraRef.current) cameraRef.current.value = ''
    if (fileRef.current) fileRef.current.value = ''
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
      setUploadError(null)
      try {
        const pdf = await canvasesToPdf(newPages)
        await uploadFile(new File([pdf], 'x.pdf', { type: 'application/pdf' }), anhaenge.length + 1)
        qc.invalidateQueries({ queryKey })
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : 'Upload fehlgeschlagen')
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

  const handleOpen = async (a: BescheidAnhang) => {
    setOpeningId(a.id)
    try {
      const blobUrl = await fetchBescheidAnhangBlob(antragId, bescheidId, a.id)
      const win = window.open(blobUrl, '_blank')
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000)
      if (!win) setUploadError('Popup-Blocker: Bitte Popups für diese Seite erlauben')
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'PDF konnte nicht geöffnet werden')
    } finally {
      setOpeningId(null)
    }
  }

  const handleShare = async (a: BescheidAnhang) => {
    setSharingId(a.id)
    try {
      const file = await fetchBescheidAnhangFile(antragId, bescheidId, a.id, a.dateiname)
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: a.dateiname })
      } else {
        const url = URL.createObjectURL(file)
        const link = document.createElement('a')
        link.href = url
        link.download = a.dateiname
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 5_000)
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setUploadError('Teilen fehlgeschlagen: ' + e.message)
      }
    } finally {
      setSharingId(null)
    }
  }

  const handleOcrTrigger = async (a: BescheidAnhang) => {
    setOcrTriggeringId(a.id)
    try {
      await triggerBescheidOcr(antragId, bescheidId, a.id)
      markTriggered(a.id)
      qc.invalidateQueries({ queryKey })
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'OCR konnte nicht gestartet werden')
    } finally {
      setOcrTriggeringId(null)
    }
  }

  const handleVorschlag = async (a: BescheidAnhang) => {
    setVorschlagLoadingId(a.id)
    try {
      const vorschlag = await getBescheidVorschlag(antragId, bescheidId, a.id)
      onVorschlag?.(vorschlag)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Vorschlag konnte nicht geladen werden')
    } finally {
      setVorschlagLoadingId(null)
    }
  }

  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
    fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface-alt)',
    border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer',
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment"
          style={{ display: 'none' }} onChange={e => handleFileInput(e.target.files)} />
        <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple
          style={{ display: 'none' }} onChange={e => handleFileInput(e.target.files)} />

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => cameraRef.current?.click()} disabled={uploading} style={{ ...btnStyle, opacity: uploading ? 0.5 : 1 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Abfotografieren
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ ...btnStyle, opacity: uploading ? 0.5 : 1 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            PDF hochladen
          </button>
          {uploading && <span style={{ fontSize: 11, color: 'var(--text-subtle)', alignSelf: 'center' }}>Wird verarbeitet…</span>}
        </div>

        {uploadError && <p style={{ fontSize: 11, color: 'var(--rose)' }}>{uploadError}</p>}

        {isLoading && <p style={{ fontSize: 11, color: 'var(--text-subtle)' }}>Lade…</p>}
        {anhaenge.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {anhaenge.map((a: BescheidAnhang) => {
              const isRunning = triggeredIds.has(a.id) && a.ocr_status == null
              const canStart = !isRunning && (a.ocr_status == null || a.ocr_status === 'failed' || a.ocr_status === 'unavailable')
              return (
                <div key={a.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
                    background: 'var(--surface-alt)', border: '1px solid var(--border)',
                    borderRadius: 5, padding: '5px 8px',
                  }}>
                    <PdfIcon />
                    <button
                      onClick={() => handleOpen(a)}
                      disabled={openingId === a.id}
                      style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: openingId === a.id ? 0.5 : 1 }}
                      title={a.dateiname}
                    >
                      {openingId === a.id ? 'Öffne…' : a.dateiname}
                    </button>
                    <span style={{ color: 'var(--text-subtle)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{formatBytes(a.groesse)}</span>
                    <OcrBadge status={a.ocr_status} running={isRunning} />
                    <button
                      onClick={() => handleShare(a)}
                      disabled={sharingId === a.id}
                      style={{ color: 'var(--text-subtle)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, opacity: sharingId === a.id ? 0.5 : 1, display: 'flex' }}
                      title="Teilen / Herunterladen"
                    >
                      {sharingId === a.id ? (
                        <span style={{ display: 'inline-block', width: 14, height: 14, border: '1.5px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                      ) : (
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => { if (confirm(`"${a.dateiname}" wirklich löschen?`)) deleteBescheidAnhang(antragId, bescheidId, a.id).then(() => qc.invalidateQueries({ queryKey })) }}
                      style={{ color: 'var(--text-subtle)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, fontSize: 15, lineHeight: 1 }}
                      title="Löschen"
                    >×</button>
                  </div>

                  {/* OCR-Aktionszeile */}
                  {(canStart || a.ocr_status === 'done') && (
                    <div style={{ display: 'flex', gap: 4, paddingLeft: 2 }}>
                      {canStart && (
                        <button
                          onClick={() => handleOcrTrigger(a)}
                          disabled={ocrTriggeringId === a.id}
                          style={{ fontSize: 10, padding: '2px 7px', color: 'var(--text-muted)', background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', opacity: ocrTriggeringId === a.id ? 0.5 : 1 }}
                        >
                          {ocrTriggeringId === a.id ? 'Startet…' : 'OCR starten'}
                        </button>
                      )}
                      {a.ocr_status === 'done' && onVorschlag && (
                        <button
                          onClick={() => handleVorschlag(a)}
                          disabled={vorschlagLoadingId === a.id}
                          style={{ fontSize: 10, padding: '2px 7px', color: '#fff', background: 'var(--primary)', border: 'none', borderRadius: 4, cursor: 'pointer', opacity: vorschlagLoadingId === a.id ? 0.6 : 1 }}
                        >
                          {vorschlagLoadingId === a.id ? 'Lade…' : 'Positionen vorschlagen'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
