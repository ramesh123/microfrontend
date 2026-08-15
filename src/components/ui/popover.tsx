import * as React from "react"
import MuiPopover from "@mui/material/Popover"

type PopoverCtx = {
  open: boolean
  setOpen: (open: boolean) => void
  anchorEl: HTMLElement | null
  setAnchorEl: (el: HTMLElement | null) => void
}
const PopoverContext = React.createContext<PopoverCtx | null>(null)

interface PopoverProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

function Popover({ open, defaultOpen, onOpenChange, children }: PopoverProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false)
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)
  const isOpen = open !== undefined ? open : internalOpen

  const setOpen = (next: boolean) => {
    setInternalOpen(next)
    onOpenChange?.(next)
  }

  return (
    <PopoverContext.Provider value={{ open: isOpen, setOpen, anchorEl, setAnchorEl }}>
      {children}
    </PopoverContext.Provider>
  )
}

function PopoverTrigger({
  asChild,
  children,
}: {
  asChild?: boolean
  children?: React.ReactNode
}) {
  const ctx = React.useContext(PopoverContext)
  const isElement = React.isValidElement<{ onClick?: (e: React.MouseEvent<HTMLElement>) => void }>(children)

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    ctx?.setAnchorEl(e.currentTarget)
    ctx?.setOpen(!ctx.open)
  }

  if (asChild && isElement) {
    return React.cloneElement(children, {
      onClick: (e: React.MouseEvent<HTMLElement>) => {
        children.props.onClick?.(e)
        handleClick(e)
      },
    })
  }

  return <button type="button" data-slot="popover-trigger" onClick={handleClick}>{children}</button>
}

function PopoverAnchor({ children }: { children?: React.ReactElement }) {
  const ctx = React.useContext(PopoverContext)
  const ref = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (ref.current) ctx?.setAnchorEl(ref.current)
  }, [ctx])

  if (!React.isValidElement(children)) return <>{children}</>
  return React.cloneElement(children, { ref } as never)
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  children,
}: {
  className?: string
  align?: "start" | "center" | "end"
  sideOffset?: number
  children?: React.ReactNode
}) {
  const ctx = React.useContext(PopoverContext)
  const horizontal = align === "start" ? "left" : align === "end" ? "right" : "center"

  return (
    <MuiPopover
      open={!!ctx?.open}
      anchorEl={ctx?.anchorEl}
      onClose={() => ctx?.setOpen(false)}
      anchorOrigin={{ vertical: "bottom", horizontal }}
      transformOrigin={{ vertical: -sideOffset, horizontal }}
      slotProps={{ paper: { className, sx: { zIndex: 1400 } } }}
    >
      {children}
    </MuiPopover>
  )
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
