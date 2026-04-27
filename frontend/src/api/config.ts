export interface AppConfig {
  multipage_scan: boolean
  paperless_ngx_url?: string
  gdrive_configured?: boolean
}

let cached: AppConfig | null = null

export async function getConfig(): Promise<AppConfig> {
  if (cached) return cached
  try {
    const res = await fetch('/api/config')
    if (!res.ok) return { multipage_scan: true }
    cached = await res.json()
    return cached!
  } catch {
    return { multipage_scan: true }
  }
}
