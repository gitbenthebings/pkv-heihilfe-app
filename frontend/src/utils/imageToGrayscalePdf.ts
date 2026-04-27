import { jsPDF } from 'jspdf'
import { getScanMaxDim, getScanJpegQuality } from './scanSettings'

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'))
    img.src = url
  })
}

function applyGrayscale(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = imageData.data
  for (let i = 0; i < d.length; i += 4) {
    // ITU-R BT.601 Luminanz-Formel
    const gray = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])
    d[i] = d[i + 1] = d[i + 2] = gray
  }
  ctx.putImageData(imageData, 0, 0)
}

/**
 * Konvertiert ein Array von Canvas-Elementen in ein mehrseitiges Graustufen-PDF.
 * Jedes Canvas wird zu einer Seite. Wird vom ScanEditor verwendet.
 */
export async function canvasesToPdf(canvases: HTMLCanvasElement[]): Promise<File> {
  if (canvases.length === 0) throw new Error('Keine Seiten vorhanden')

  let pdf: jsPDF | null = null

  const MAX_DIM = getScanMaxDim()
  const JPEG_QUALITY = getScanJpegQuality()

  for (const src of canvases) {
    let w = src.width
    let h = src.height

    // Ggf. skalieren
    const canvas = document.createElement('canvas')
    if (w > MAX_DIM || h > MAX_DIM) {
      const ratio = Math.min(MAX_DIM / w, MAX_DIM / h)
      canvas.width = Math.round(w * ratio)
      canvas.height = Math.round(h * ratio)
      canvas.getContext('2d')!.drawImage(src, 0, 0, canvas.width, canvas.height)
      w = canvas.width
      h = canvas.height
    } else {
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(src, 0, 0)
    }

    applyGrayscale(canvas)
    const jpegData = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    const orientation = w >= h ? 'l' : 'p'

    if (!pdf) {
      pdf = new jsPDF({ orientation, unit: 'px', format: [w, h], compress: true })
    } else {
      pdf.addPage([w, h], orientation)
    }
    pdf.addImage(jpegData, 'JPEG', 0, 0, w, h)
  }

  const blob = pdf!.output('blob')
  const date = new Date().toISOString().slice(0, 10)
  return new File([blob], `scan-${date}.pdf`, { type: 'application/pdf' })
}

/**
 * Konvertiert eine Bilddatei in ein komprimiertes Graustufen-PDF.
 * PDF-Dateien werden unverändert zurückgegeben.
 */
export async function fileToGrayscalePdf(file: File): Promise<File> {
  if (file.type === 'application/pdf') return file

  const MAX_DIM = getScanMaxDim()
  const JPEG_QUALITY = getScanJpegQuality()

  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)

    let w = img.naturalWidth
    let h = img.naturalHeight
    if (w === 0 || h === 0) throw new Error('Bild hat keine gültige Größe')

    if (w > MAX_DIM || h > MAX_DIM) {
      const ratio = Math.min(MAX_DIM / w, MAX_DIM / h)
      w = Math.round(w * ratio)
      h = Math.round(h * ratio)
    }

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, w, h)
    applyGrayscale(canvas)

    const orientation = w >= h ? 'l' : 'p'
    const pdf = new jsPDF({ orientation, unit: 'px', format: [w, h], compress: true })
    pdf.addImage(canvas.toDataURL('image/jpeg', JPEG_QUALITY), 'JPEG', 0, 0, w, h)

    const blob = pdf.output('blob')
    const basename = file.name.replace(/\.[^.]+$/, '')
    return new File([blob], `${basename}.pdf`, { type: 'application/pdf' })
  } finally {
    URL.revokeObjectURL(url)
  }
}
