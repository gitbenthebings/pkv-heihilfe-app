import { createContext, useCallback, useContext, useRef, useState } from 'react'

interface ToastAction {
  label: string
  onClick: () => void
}

interface Toast {
  id: number
  message: string
  action?: ToastAction
}

interface ToastContextType {
  showToast: (message: string, action?: ToastAction) => void
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} })

let _nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: number) => {
    setToasts(t => t.filter(x => x.id !== id))
    const t = timers.current.get(id)
    if (t) clearTimeout(t)
    timers.current.delete(id)
  }, [])

  const showToast = useCallback((message: string, action?: ToastAction) => {
    const id = ++_nextId
    setToasts(prev => [...prev, { id, message, action }])
    const t = setTimeout(() => dismiss(id), action ? 5500 : 3000)
    timers.current.set(id, t)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8,
        pointerEvents: 'none',
      }}>
        {toasts.map(toast => (
          <div key={toast.id} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            pointerEvents: 'auto',
            fontSize: 13, color: 'var(--text)',
            minWidth: 220, maxWidth: 360,
          }}>
            <span style={{ flex: 1 }}>{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => { toast.action!.onClick(); dismiss(toast.id) }}
                style={{
                  background: 'var(--primary)', color: '#fff',
                  border: 'none', borderRadius: 5, padding: '3px 10px',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              onClick={() => dismiss(toast.id)}
              style={{
                background: 'none', border: 'none', color: 'var(--text-subtle)',
                cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px',
              }}
            >×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
