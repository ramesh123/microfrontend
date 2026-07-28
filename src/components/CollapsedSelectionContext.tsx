import * as React from 'react'

type CollapsedSelection = {
  selectedKey: string | null
  setSelectedKey: (v: string | null) => void
}

const CollapsedSelectionContext = React.createContext<CollapsedSelection | undefined>(undefined)

export function CollapsedSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null)

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
