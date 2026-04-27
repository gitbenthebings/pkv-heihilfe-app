const KEY_MAX_DIM = 'scan_max_dim'
const KEY_JPEG_QUALITY = 'scan_jpeg_quality'

export const DEFAULT_MAX_DIM = 3500
export const DEFAULT_JPEG_QUALITY = 0.82

export function getScanMaxDim(): number {
  const v = localStorage.getItem(KEY_MAX_DIM)
  const n = v ? parseInt(v, 10) : NaN
  return isNaN(n) || n < 500 || n > 8000 ? DEFAULT_MAX_DIM : n
}

export function getScanJpegQuality(): number {
  const v = localStorage.getItem(KEY_JPEG_QUALITY)
  const n = v ? parseFloat(v) : NaN
  return isNaN(n) || n < 0.1 || n > 1 ? DEFAULT_JPEG_QUALITY : n
}

export function setScanMaxDim(value: number) {
  localStorage.setItem(KEY_MAX_DIM, String(value))
}

export function setScanJpegQuality(value: number) {
  localStorage.setItem(KEY_JPEG_QUALITY, String(value))
}
