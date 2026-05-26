import { useState, useEffect } from 'react'

type Theme = 'chalk' | 'carbon'

function getInitialTheme(): Theme {
  const saved = localStorage.getItem('pkv-theme') as Theme | null
  if (saved === 'chalk' || saved === 'carbon') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'carbon' : 'chalk'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    // keep Tailwind dark: variants working for components not yet migrated
    if (theme === 'carbon') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('pkv-theme', theme)
  }, [theme])

  const dark = theme === 'carbon'
  const toggle = () => setTheme(t => t === 'chalk' ? 'carbon' : 'chalk')
  return { dark, toggle, theme }
}
