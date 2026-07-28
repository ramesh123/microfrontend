import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react'

export type Theme = 'dark' | 'light' | 'light-theme' | 'system' | 'orange-light' | 'orange-dark' | 'blue-light' | 'blue-light-g' | 'blue-dark' | 'blue-dark-g' | 'purple-light' | 'purple-dark'

/** True when the active theme should use dark UI (matches document `classList` / React Flow `colorMode`). */
export function isThemeDarkAppearance(theme: Theme): boolean {
  if (theme === 'system') {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return theme === 'dark' || theme.endsWith('-dark') || theme === 'blue-dark-g'
}

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: 'blue-light',
  setTheme: () => null
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

const THEME_CLASSES = [
  'light',
  'dark',
  'light-theme',
  'orange-light',
  'orange-dark',
  'blue-light',
  'blue-light-g',
  'blue-dark',
  'blue-dark-g',
  'purple-light',
  'purple-dark',
] as const

/** Apply theme classes to <html> immediately (reads `prefers-color-scheme` when `theme === 'system'`). */
export function applyDocumentTheme(theme: Theme) {
  if (typeof window === 'undefined') return
  const root = window.document.documentElement
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  root.classList.remove(...THEME_CLASSES)
  const systemTheme = mediaQuery.matches ? 'dark' : 'light'
  const effectiveTheme = theme === 'system' ? systemTheme : theme
  root.classList.add(effectiveTheme)
}

export function ThemeProvider({ 
  children,
  defaultTheme = 'blue-light',
  storageKey = 'vite-ui-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, _setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )

  useLayoutEffect(() => {
    applyDocumentTheme(theme)
  }, [theme])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = () => {
      if (theme === 'system') {
        applyDocumentTheme('system')
      }
    }

    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  const setTheme = (next: Theme) => {
    localStorage.setItem(storageKey, next)
    // Sync DOM before React re-renders so charts/CSS-variable probes see the new theme in the same turn.
    applyDocumentTheme(next)
    _setTheme(next)
  }

  const value = {
    theme,
    setTheme
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
