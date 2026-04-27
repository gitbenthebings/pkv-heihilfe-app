import { useState, useRef, useEffect, useCallback } from 'react'

interface Crop { x: number; y: number; w: number; h: number }
type HandleId = 'tl' | 'tr' | 'bl' | 'br' | 'move'
interface DragState {
  handle: HandleId
  startPointer: { x: number; y: number }
  startCrop: Crop
}

interface Props {
  file: File
  multipageEnabled: boolean
  /** Anzahl bereits gesammelter Seiten (0 = erste Seite) */
  pageCount: number
  /**
   * addMore = true  → aktuelle Seite speichern, Kamera erneut öffnen
   * addMore = false → aktuelle Seite speichern, alles hochladen
   */
  onConfirm: (canvas: HTMLCanvasElement, addMore: boolean) => void
  onCancel: () => void
}

/** Maximale Canvas-Auflösung für die Anzeige (längere Seite) */
const MAX_DISPLAY = 1600
/** Minimale Crop-Größe in Canvas-Pixeln */
const MIN_CROP_PX = 40
/** Tap-Radius für Handles in Bildschirm-Pixeln */
const HANDLE_HIT_PX = 36
/** Visuelle Handle-Größe in Canvas-Pixeln */
const HANDLE_VIS = 20

/**
 * Erkennt automatisch das Dokument (helles Papier auf dunklerem Hintergrund)
 * mittels Sobel-Kantenerkennung auf einem herunterskaliertem Abbild.
 * Gibt null zurück wenn kein klares Dokument gefunden wurde → Fallback-Rahmen.
 */
function detectDocumentBounds(
  canvas: HTMLCanvasElement,
): { x: number; y: number; w: number; h: number } | null {
  const WORK_W = 400
  const ratio = canvas.width / WORK_W
  const WH = Math.round(canvas.height / ratio)

  // Auf Arbeitsgröße herunterskalieren
  const work = document.createElement('canvas')
  work.width = WORK_W
  work.height = WH
  const wCtx = work.getContext('2d')!
  wCtx.drawImage(canvas, 0, 0, WORK_W, WH)
  const { data } = wCtx.getImageData(0, 0, WORK_W, WH)

  // Graustufen
  const gray = new Uint8Array(WORK_W * WH)
  for (let i = 0; i < gray.length; i++) {
    const j = i * 4
    gray[i] = (0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2]) | 0
  }

  // Sobel-Kantenstärke
  const edges = new Float32Array(WORK_W * WH)
  for (let y = 1; y < WH - 1; y++) {
    for (let x = 1; x < WORK_W - 1; x++) {
      const i = y * WORK_W + x
      const gx =
        -gray[i - WORK_W - 1] + gray[i - WORK_W + 1]
        - 2 * gray[i - 1] + 2 * gray[i + 1]
        - gray[i + WORK_W - 1] + gray[i + WORK_W + 1]
      const gy =
        -gray[i - WORK_W - 1] - 2 * gray[i - WORK_W] - gray[i - WORK_W + 1]
        + gray[i + WORK_W - 1] + 2 * gray[i + WORK_W] + gray[i + WORK_W + 1]
      edges[i] = Math.sqrt(gx * gx + gy * gy)
    }
  }

  // Zeilen- und Spaltensummen — die Dokumentkante erzeugt eine hohe
  // Summe über die gesamte Breite/Höhe; Textkanten sind zu sporadisch.
  const rowSum = new Float32Array(WH)
  const colSum = new Float32Array(WORK_W)
  for (let y = 0; y < WH; y++) {
    for (let x = 0; x < WORK_W; x++) {
      const v = edges[y * WORK_W + x]
      rowSum[y] += v
      colSum[x] += v
    }
  }

  const maxRow = Math.max(...rowSum)
  const maxCol = Math.max(...colSum)
  if (maxRow === 0 || maxCol === 0) return null

  // Schwellwert: 25 % des stärksten Zeilenwerts
  const rowT = maxRow * 0.25
  const colT = maxCol * 0.25

  // 3 % Randstreifen überspringen (Foto-Artefakte am Bildrand vermeiden)
  const skipH = Math.ceil(WH * 0.03)
  const skipW = Math.ceil(WORK_W * 0.03)

  let top = skipH, bottom = WH - 1 - skipH
  let left = skipW, right = WORK_W - 1 - skipW

  for (let y = skipH; y < Math.floor(WH * 0.7); y++)
    if (rowSum[y] > rowT) { top = y; break }
  for (let y = WH - 1 - skipH; y >= Math.ceil(WH * 0.3); y--)
    if (rowSum[y] > rowT) { bottom = y; break }
  for (let x = skipW; x < Math.floor(WORK_W * 0.7); x++)
    if (colSum[x] > colT) { left = x; break }
  for (let x = WORK_W - 1 - skipW; x >= Math.ceil(WORK_W * 0.3); x--)
    if (colSum[x] > colT) { right = x; break }

  // Plausibilitätsprüfung: Dokument muss zwischen 30–93 % der Fläche einnehmen
  const relW = (right - left) / WORK_W
  const relH = (bottom - top) / WH
  if (relW < 0.30 || relH < 0.30 || relW > 0.93 || relH > 0.93) return null

  // Kleiner Inset damit der Hintergrund nicht im Crop ist
  const inset = 5
  const bx = Math.round((left + inset) * ratio)
  const by = Math.round((top + inset) * ratio)
  const bw = Math.round((right - left - 2 * inset) * ratio)
  const bh = Math.round((bottom - top - 2 * inset) * ratio)

  // Auf Canvas-Grenzen begrenzen
  const cx = Math.max(0, bx)
  const cy = Math.max(0, by)
  return {
    x: cx,
    y: cy,
    w: Math.min(canvas.width - cx, bw),
    h: Math.min(canvas.height - cy, bh),
  }
}

export default function ScanEditor({ file, multipageEnabled, pageCount, onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const cropRef = useRef<Crop>({ x: 0, y: 0, w: 0, h: 0 })
  const rotationRef = useRef<0 | 90 | 180 | 270>(0)
  const dragRef = useRef<DragState | null>(null)

  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)

  // Bild laden
  useEffect(() => {
    setLoaded(false)
    setLoadError(false)
    imgRef.current = null
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { imgRef.current = img; setLoaded(true) }
    img.onerror = () => setLoadError(true)
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Zeichnet Bild + Crop-Overlay auf den Canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || canvas.width === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rot = rotationRef.current
    const cw = canvas.width
    const ch = canvas.height
    const isSwapped = rot === 90 || rot === 270
    const rotNW = isSwapped ? img.naturalHeight : img.naturalWidth
    const scale = cw / rotNW
    const scaledNW = img.naturalWidth * scale
    const scaledNH = img.naturalHeight * scale

    // Gedrehtes Bild zeichnen
    ctx.clearRect(0, 0, cw, ch)
    ctx.save()
    ctx.translate(cw / 2, ch / 2)
    ctx.rotate((rot * Math.PI) / 180)
    ctx.drawImage(img, -scaledNW / 2, -scaledNH / 2, scaledNW, scaledNH)
    ctx.restore()

    const { x, y, w, h } = cropRef.current

    // Dunkle Maske außerhalb des Crop-Bereichs
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, cw, y)
    ctx.fillRect(0, y + h, cw, ch - y - h)
    ctx.fillRect(0, y, x, h)
    ctx.fillRect(x + w, y, cw - x - w, h)

    // Crop-Rahmen
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 2
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2)

    // Drittelllinien (Drittel-Regel)
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x + w / 3, y);     ctx.lineTo(x + w / 3, y + h)
    ctx.moveTo(x + 2 * w / 3, y); ctx.lineTo(x + 2 * w / 3, y + h)
    ctx.moveTo(x, y + h / 3);     ctx.lineTo(x + w, y + h / 3)
    ctx.moveTo(x, y + 2 * h / 3); ctx.lineTo(x + w, y + 2 * h / 3)
    ctx.stroke()

    // Eck-Handles
    for (const [hx, hy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
      const half = HANDLE_VIS / 2
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(hx - half - 1, hy - half - 1, HANDLE_VIS + 2, HANDLE_VIS + 2)
      ctx.fillStyle = 'white'
      ctx.fillRect(hx - half, hy - half, HANDLE_VIS, HANDLE_VIS)
    }
  }, [])

  // Canvas-Größe und Crop zurücksetzen wenn Bild geladen oder Rotation geändert
  useEffect(() => {
    if (!loaded) return
    const img = imgRef.current!
    const canvas = canvasRef.current!
    const rot = rotation
    rotationRef.current = rot

    const isSwapped = rot === 90 || rot === 270
    const rotNW = isSwapped ? img.naturalHeight : img.naturalWidth
    const rotNH = isSwapped ? img.naturalWidth : img.naturalHeight
    const scale = Math.min(1, MAX_DISPLAY / Math.max(rotNW, rotNH))
    const cw = Math.round(rotNW * scale)
    const ch = Math.round(rotNH * scale)
    canvas.width = cw
    canvas.height = ch

    // Bild zuerst rein zeichnen (ohne Overlay) damit detectDocumentBounds
    // Pixeldaten lesen kann
    const ctx = canvas.getContext('2d')!
    const scaledNW = img.naturalWidth * scale
    const scaledNH = img.naturalHeight * scale
    ctx.save()
    ctx.translate(cw / 2, ch / 2)
    ctx.rotate((rot * Math.PI) / 180)
    ctx.drawImage(img, -scaledNW / 2, -scaledNH / 2, scaledNW, scaledNH)
    ctx.restore()

    // Dokumentgrenzen automatisch erkennen; Fallback: 12 % Einzug (gut greifbar)
    const detected = detectDocumentBounds(canvas)
    if (detected) {
      cropRef.current = detected
    } else {
      const pad = Math.round(Math.min(cw, ch) * 0.12)
      cropRef.current = { x: pad, y: pad, w: cw - 2 * pad, h: ch - 2 * pad }
    }

    redraw()
  }, [loaded, rotation, redraw])

  // Canvas-Koordinaten aus Pointer-Event
  const canvasCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  // Welches Handle wurde getroffen?
  const getHandle = (cx: number, cy: number): HandleId | null => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const hrX = (HANDLE_HIT_PX / rect.width) * canvas.width
    const hrY = (HANDLE_HIT_PX / rect.height) * canvas.height
    const { x, y, w, h } = cropRef.current

    const corners: [HandleId, number, number][] = [
      ['tl', x, y], ['tr', x + w, y],
      ['bl', x, y + h], ['br', x + w, y + h],
    ]
    for (const [id, hx, hy] of corners) {
      if (Math.abs(cx - hx) <= hrX && Math.abs(cy - hy) <= hrY) return id
    }
    if (cx >= x && cx <= x + w && cy >= y && cy <= y + h) return 'move'
    return null
  }

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = canvasCoords(e.clientX, e.clientY)
    const handle = getHandle(x, y)
    if (!handle) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { handle, startPointer: { x, y }, startCrop: { ...cropRef.current } }
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return
    const { x, y } = canvasCoords(e.clientX, e.clientY)
    const { handle, startPointer: sp, startCrop: sc } = dragRef.current
    const dx = x - sp.x
    const dy = y - sp.y
    const canvas = canvasRef.current!
    const cw = canvas.width
    const ch = canvas.height

    let { x: nx, y: ny, w: nw, h: nh } = sc

    if (handle === 'move') {
      nx = Math.max(0, Math.min(cw - nw, sc.x + dx))
      ny = Math.max(0, Math.min(ch - nh, sc.y + dy))
    } else {
      if (handle === 'tl' || handle === 'bl') {
        const newX = Math.max(0, Math.min(sc.x + sc.w - MIN_CROP_PX, sc.x + dx))
        nw = sc.x + sc.w - newX; nx = newX
      }
      if (handle === 'tr' || handle === 'br') {
        nw = Math.max(MIN_CROP_PX, Math.min(cw - sc.x, sc.w + dx))
      }
      if (handle === 'tl' || handle === 'tr') {
        const newY = Math.max(0, Math.min(sc.y + sc.h - MIN_CROP_PX, sc.y + dy))
        nh = sc.y + sc.h - newY; ny = newY
      }
      if (handle === 'bl' || handle === 'br') {
        nh = Math.max(MIN_CROP_PX, Math.min(ch - sc.y, sc.h + dy))
      }
    }

    cropRef.current = { x: nx, y: ny, w: nw, h: nh }
    redraw()
  }, [redraw])

  const onPointerUp = useCallback(() => { dragRef.current = null }, [])

  // Ausgabe-Canvas: gedrehtes Bild + Zuschnitt (ohne Overlay)
  const buildOutputCanvas = (): HTMLCanvasElement => {
    const img = imgRef.current!
    const canvas = canvasRef.current!
    const rot = rotationRef.current
    const { x, y, w, h } = cropRef.current

    const isSwapped = rot === 90 || rot === 270
    const rotNW = isSwapped ? img.naturalHeight : img.naturalWidth
    const scale = canvas.width / rotNW
    const scaledNW = img.naturalWidth * scale
    const scaledNH = img.naturalHeight * scale

    // Gedrehtes Bild auf Offscreen-Canvas (ohne Overlay)
    const full = document.createElement('canvas')
    full.width = canvas.width
    full.height = canvas.height
    const fCtx = full.getContext('2d')!
    fCtx.save()
    fCtx.translate(full.width / 2, full.height / 2)
    fCtx.rotate((rot * Math.PI) / 180)
    fCtx.drawImage(img, -scaledNW / 2, -scaledNH / 2, scaledNW, scaledNH)
    fCtx.restore()

    // Zuschneiden
    const out = document.createElement('canvas')
    out.width = Math.round(w)
    out.height = Math.round(h)
    out.getContext('2d')!.drawImage(full, Math.round(x), Math.round(y), Math.round(w), Math.round(h), 0, 0, out.width, out.height)
    return out
  }

  const rotLeft  = () => setRotation(r => ({ 0: 270, 90: 0, 180: 90, 270: 180 }[r] as 0 | 90 | 180 | 270))
  const rotRight = () => setRotation(r => ({ 0: 90, 90: 180, 180: 270, 270: 0 }[r] as 0 | 90 | 180 | 270))

  const titleText = pageCount > 0 ? `Seite ${pageCount + 1}` : 'Scan bearbeiten'

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col select-none">
      {/* Obere Leiste */}
      <div className="h-14 bg-gray-900 flex items-center justify-between px-4 shrink-0">
        <button
          onClick={onCancel}
          className="text-gray-300 hover:text-white text-sm px-3 py-2 -ml-2 min-w-[5rem]"
        >
          Abbrechen
        </button>
        <span className="text-white text-sm font-medium">{titleText}</span>
        <button
          onClick={() => loaded && onConfirm(buildOutputCanvas(), false)}
          disabled={!loaded}
          className="text-blue-400 hover:text-blue-300 font-medium text-sm px-3 py-2 -mr-2 min-w-[5rem] text-right disabled:opacity-40"
        >
          {multipageEnabled && pageCount > 0 ? 'Fertig' : 'Hochladen'}
        </button>
      </div>

      {/* Canvas-Bereich */}
      <div className="flex-1 flex items-center justify-center overflow-hidden p-2">
        {!loaded && !loadError && (
          <p className="text-gray-400 text-sm">Lade Bild…</p>
        )}
        {loadError && (
          <p className="text-red-400 text-sm">Bild konnte nicht geladen werden.</p>
        )}
        <canvas
          ref={canvasRef}
          className={loaded ? 'touch-none' : 'hidden'}
          style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 7.5rem)', display: 'block' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>

      {/* Untere Leiste */}
      <div className="h-16 bg-gray-900 flex items-center justify-around px-4 shrink-0">
        <button onClick={rotLeft} className="flex flex-col items-center gap-0.5 text-gray-300 hover:text-white p-2 min-w-[4rem]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 10h10a8 8 0 018 8v2M3 10l4 4m-4-4l4-4" />
          </svg>
          <span className="text-xs">Links</span>
        </button>

        <button onClick={rotRight} className="flex flex-col items-center gap-0.5 text-gray-300 hover:text-white p-2 min-w-[4rem]">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 10H11a8 8 0 00-8 8v2M21 10l-4 4m4-4l-4-4" />
          </svg>
          <span className="text-xs">Rechts</span>
        </button>

        {multipageEnabled && (
          <button
            onClick={() => loaded && onConfirm(buildOutputCanvas(), true)}
            disabled={!loaded}
            className="flex flex-col items-center gap-0.5 text-blue-400 hover:text-blue-300 p-2 min-w-[4rem] disabled:opacity-40"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs">+ Seite</span>
          </button>
        )}
      </div>
    </div>
  )
}
