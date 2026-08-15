import * as React from "react"
import MuiCollapse from "@mui/material/Collapse"

type CollapsibleCtx = { open: boolean; toggle: () => void }
const CollapsibleContext = React.createContext<CollapsibleCtx | null>(null)

interface CollapsibleProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  children?: React.ReactNode
  // When true, Root doesn't render its own wrapper — it clones data-state/
  // data-slot/className onto its single child instead (e.g. so a sidebar
  // <li> can itself be the "group/collapsible" element that descendant
  // group-data-[state=open]/collapsible: selectors target).
  asChild?: boolean
}

function Collapsible({ open, defaultOpen, onOpenChange, className, children, asChild }: CollapsibleProps) {
  const [internal, setInternal] = React.useState(defaultOpen ?? false)
  const isOpen = open !== undefined ? open : internal

  const toggle = () => {
    const next = !isOpen
    setInternal(next)
    onOpenChange?.(next)
  }

  const dataState = isOpen ? "open" : "closed"

  return (
    <CollapsibleContext.Provider value={{ open: isOpen, toggle }}>
      {asChild && React.isValidElement(children) ? (
        React.cloneElement(children as React.ReactElement<{ className?: string }>, {
          "data-slot": "collapsible",
          "data-state": dataState,
          className: [className, (children as React.ReactElement<{ className?: string }>).props.className]
            .filter(Boolean)
            .join(" "),
        } as never)
      ) : (
        <div data-slot="collapsible" data-state={dataState} className={className}>
          {children}
        </div>
      )}
    </CollapsibleContext.Provider>
  )
}

function CollapsibleTrigger({
  asChild,
  children,
  ...props
}: { asChild?: boolean; children?: React.ReactElement | React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = React.useContext(CollapsibleContext)

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>
    return React.cloneElement(child, {
      onClick: (e: React.MouseEvent) => {
        child.props.onClick?.(e)
        ctx?.toggle()
      },
    })
  }

  return (
    <button type="button" data-slot="collapsible-trigger" onClick={() => ctx?.toggle()} {...props}>
      {children}
    </button>
  )
}

function CollapsibleContent({ className, children }: { className?: string; children?: React.ReactNode }) {
  const ctx = React.useContext(CollapsibleContext)
  return (
    <MuiCollapse in={ctx?.open ?? false} data-slot="collapsible-content" className={className}>
      {children}
    </MuiCollapse>
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
