import * as React from "react"
import MuiTabs from "@mui/material/Tabs"
import MuiTab from "@mui/material/Tab"

type TabsCtx = { value: string; setValue: (v: string) => void }
const TabsContext = React.createContext<TabsCtx | null>(null)

interface TabsProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  className?: string
  children?: React.ReactNode
}

function Tabs({ value, defaultValue, onValueChange, className, children }: TabsProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? "")
  const current = value !== undefined ? value : internal

  const setValue = (v: string) => {
    setInternal(v)
    onValueChange?.(v)
  }

  return (
    <TabsContext.Provider value={{ value: current, setValue }}>
      <div data-slot="tabs" className={className} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

function TabsList({ className, children }: { className?: string; children?: React.ReactNode }) {
  const ctx = React.useContext(TabsContext)
  return (
    <MuiTabs
      data-slot="tabs-list"
      className={className}
      value={ctx?.value ?? false}
      onChange={(_event, newValue) => ctx?.setValue(newValue)}
      variant="scrollable"
      scrollButtons="auto"
    >
      {children}
    </MuiTabs>
  )
}

function TabsTrigger({
  value,
  className,
  children,
  disabled,
}: {
  value: string
  className?: string
  children?: React.ReactNode
  disabled?: boolean
}) {
  return (
    <MuiTab
      data-slot="tabs-trigger"
      className={className}
      value={value}
      label={children}
      disabled={disabled}
    />
  )
}

function TabsContent({ value, className, children }: { value: string; className?: string; children?: React.ReactNode }) {
  const ctx = React.useContext(TabsContext)
  if (ctx?.value !== value) return null
  return (
    <div data-slot="tabs-content" className={className} style={{ flex: 1, outline: "none" }}>
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
