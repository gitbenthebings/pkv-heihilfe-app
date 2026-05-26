import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

const STORAGE_KEY = 'pkv_selected_jahr'
const CURRENT_YEAR = new Date().getFullYear()

interface JahrContextType {
  jahr: number
  setJahr: (j: number) => void
  jahreOptionen: number[]
}

const JahrContext = createContext<JahrContextType>({
  jahr: CURRENT_YEAR,
  setJahr: () => {},
  jahreOptionen: [],
})

export function JahrProvider({ children }: { children: ReactNode }) {
  const [jahr, setJahrState] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = parseInt(stored, 10)
        if (!isNaN(parsed) && parsed >= 2020 && parsed <= CURRENT_YEAR + 1) return parsed
      }
    } catch {}
    return CURRENT_YEAR
  })

  const setJahr = useCallback((j: number) => {
    try { localStorage.setItem(STORAGE_KEY, String(j)) } catch {}
    setJahrState(j)
  }, [])

  const jahreOptionen = Array.from({ length: CURRENT_YEAR - 2019 }, (_, i) => 2020 + i)

  return (
    <JahrContext.Provider value={{ jahr, setJahr, jahreOptionen }}>
      {children}
    </JahrContext.Provider>
  )
}

export function useJahr() {
  return useContext(JahrContext)
}
