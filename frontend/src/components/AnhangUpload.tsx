import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAnhaenge, uploadAnhang, deleteAnhang, fetchAnhangBlob, fetchAnhangFile } from '../api/anhaenge'
import { getConfig } from '../api/config'
import { fileToGrayscalePdf, canvasesToPdf } from '../utils/imageToGrayscalePdf'
import ScanEditor from './ScanEditor'
import type { Anhang } from '../types'

interface Props {
  rechnungId: string
  referenzNr?: number | null
  compact?: boolean
}

function buildFilename(referenzNr: number | null | undefined, index: number): string {
  const nr = referenzNr != null ? String(referenzNr).padStart(5, '0') : 'xxxxx'
  const idx = String(index).padStart(2, '0')
  return `rg${nr}_${idx}.pdf`
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

export default function AnhangUpload({ rechnungId, referenzNr, compact = false }: Props) {
  const qc = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [sharingId, setSharingId] = useState<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Scan-Editor-Zustand
  const [scanFile, setScanFile] = useState<File | null>(null)
  const [scanPages, setScanPages] = useState<HTMLCanvasElement[]>([])
  const [multipageEnabled, setMultipageEnabled] = useState(true)

  useEffect(() => {
    getConfig().then(c => setMultipageEnabled(c.multipage_scan))
  }, [])

  const { data: anhaenge = [], isLoading } = useQuery({
    queryKey: ['anhaenge', rechnungId],
    queryFn: () => getAnhaenge(rechnungId),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteAnhang(rechnungId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['anhaenge', rechnungId] }),
  })

  // Direkter Upload (PDF oder vorverarbeitetes Bild ohne Editor)
  const uploadFiles = async (files: File[]) => {
    setUploadError(null)
    setUploading(true)
    try {
      for (let i = 0; i < files.length; i++) {
        const pdf = await fileToGrayscalePdf(files[i])
        const filename = buildFilename(referenzNr, anhaenge.length + i + 1)
        await uploadAnhang(rechnungId, new File([pdf], filename, { type: 'application/pdf' }))
      }
      qc.invalidateQueries({ queryKey: ['anhaenge', rechnungId] })
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload fehlgeschlagen')
    } finally {
      setUploading(false)
      if (cameraRef.current) cameraRef.current.value = ''
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // Dateiauswahl-Handler (Kamera oder Datei-Picker)
  const handleFileInput = (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploadError(null)
    const arr = Array.from(files)

    // Bilder → Scan-Editor; PDFs → direkt hochladen
    const images = arr.filter(f => f.type.startsWith('image/'))
    const pdfs = arr.filter(f => !f.type.startsWith('image/'))

    if (images.length > 0) {
      // Erstes Bild im Editor öffnen (scanPages bereits gesetzt bei Mehrseiten-Flow)
      setScanFile(images[0])
    }
    if (pdfs.length > 0) {
      uploadFiles(pdfs)
    }

    // Input zurücksetzen, damit onChange bei gleichem File wieder feuert
    if (cameraRef.current) cameraRef.current.value = ''
    if (fileRef.current) fileRef.current.value = ''
  }

  // Callback vom ScanEditor
  const handleScanConfirm = async (canvas: HTMLCanvasElement, addMore: boolean) => {
    const newPages = [...scanPages, canvas]

    if (addMore) {
      // Seite sammeln, Editor schließen, Kamera erneut öffnen
      setScanPages(newPages)
      setScanFile(null)
      // Kurze Verzögerung damit das DOM den Editor entfernt bevor die Kamera öffnet
      setTimeout(() => cameraRef.current?.click(), 80)
    } else {
      // Alle Seiten als eine PDF hochladen
      setScanFile(null)
      setScanPages([])
      setUploading(true)
      setUploadError(null)
      try {
        const pdf = await canvasesToPdf(newPages)
        const filename = buildFilename(referenzNr, anhaenge.length + 1)
        await uploadAnhang(rechnungId, new File([pdf], filename, { type: 'application/pdf' }))
        qc.invalidateQueries({ queryKey: ['anhaenge', rechnungId] })
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

  const handleShare = async (a: Anhang) => {
    setSharingId(a.id)
    try {
      const file = await fetchAnhangFile(rechnungId, a.id, a.dateiname)
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: a.dateiname })
      } else {
        // Fallback: Download
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

  const handleOpen = async (a: Anhang) => {
    setOpeningId(a.id)
    try {
      const blobUrl = await fetchAnhangBlob(rechnungId, a.id)
      const win = window.open(blobUrl, '_blank')
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000)
      if (!win) setUploadError('Popup-Blocker: Bitte Popups für diese Seite erlauben')
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'PDF konnte nicht geöffnet werden')
    } finally {
      setOpeningId(null)
    }
  }

  const btnBase = compact
    ? 'flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50'
    : 'flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50'

  return (
    <>
      {/* Scan-Editor Overlay */}
      {scanFile && (
        <ScanEditor
          file={scanFile}
          multipageEnabled={multipageEnabled}
          pageCount={scanPages.length}
          onConfirm={handleScanConfirm}
          onCancel={handleScanCancel}
        />
      )}

      <div className="space-y-1.5">
        {/* Versteckte Inputs */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => handleFileInput(e.target.files)}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={e => handleFileInput(e.target.files)}
        />

        {/* Upload-Buttons */}
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => cameraRef.current?.click()} disabled={uploading} className={btnBase}>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Scannen
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className={btnBase}>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            PDF
          </button>
          {uploading && (
            <span className="text-xs text-gray-400 dark:text-gray-500 self-center">
              Wird verarbeitet…
            </span>
          )}
        </div>

        {uploadError && (
          <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>
        )}

        {/* Anhang-Liste */}
        {isLoading && <p className="text-xs text-gray-400 dark:text-gray-500">Lade…</p>}
        {anhaenge.length > 0 && (
          <div className="space-y-1">
            {anhaenge.map((a: Anhang) => (
              <div
                key={a.id}
                className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5"
              >
                <PdfIcon />
                <button
                  onClick={() => handleOpen(a)}
                  disabled={openingId === a.id}
                  className="flex-1 truncate text-left text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
                  title={a.dateiname}
                >
                  {openingId === a.id ? 'Öffne…' : a.dateiname}
                </button>
                <span className="text-gray-400 dark:text-gray-500 shrink-0 tabular-nums">
                  {formatBytes(a.groesse)}
                </span>
                <button
                  onClick={() => handleShare(a)}
                  disabled={sharingId === a.id}
                  className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 shrink-0 disabled:opacity-50"
                  title="Teilen / Herunterladen"
                >
                  {sharingId === a.id ? (
                    <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`"${a.dateiname}" wirklich löschen?`)) deleteMut.mutate(a.id)
                  }}
                  disabled={deleteMut.isPending}
                  className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 shrink-0 disabled:opacity-50 text-base leading-none"
                  title="Löschen"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
