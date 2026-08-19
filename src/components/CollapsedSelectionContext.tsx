import * as React from 'react'

const STORAGE_KEY = 'sidebar-collapsed-selection'

type CollapsedSelection = {
  selectedKey: string | null
  setSelectedKey: (v: string | null) => void
}

const CollapsedSelectionContext = React.createContext<CollapsedSelection | undefined>(undefined)

function readStoredKey(): string | null {
  if (typeof sessionStorage === 'undefined') return null
  return sessionStorage.getItem(STORAGE_KEY)
}

export function CollapsedSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedKey, setSelectedKeyState] = React.useState<string | null>(() => readStoredKey())

  const setSelectedKey = React.useCallback((value: string | null) => {
    setSelectedKeyState(value)
    if (typeof sessionStorage === 'undefined') return
    if (value) {
      sessionStorage.setItem(STORAGE_KEY, value)
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  return (
    <CollapsedSelectionContext.Provider value={{ selectedKey, setSelectedKey }}>
      {children}
    </CollapsedSelectionContext.Provider>
  )
}

export function useCollapsedSelection() {
  const ctx = React.useContext(CollapsedSelectionContext)
  if (!ctx) throw new Error('useCollapsedSelection must be used within CollapsedSelectionProvider')
  return ctx
}

export default CollapsedSelectionContext
