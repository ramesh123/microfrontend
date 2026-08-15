import * as React from "react"
import MuiMenu from "@mui/material/Menu"
import MuiMenuItem from "@mui/material/MenuItem"
import MuiDivider from "@mui/material/Divider"
import MuiListSubheader from "@mui/material/ListSubheader"
import CheckIcon from "@mui/icons-material/Check"
import ChevronRightIcon from "@mui/icons-material/ChevronRight"
import CircleIcon from "@mui/icons-material/FiberManualRecord"

import { cn } from "@/lib/utils"

type MenuCtx = {
  open: boolean
  setOpen: (open: boolean) => void
  anchorEl: HTMLElement | null
  setAnchorEl: (el: HTMLElement | null) => void
}
const DropdownMenuContext = React.createContext<MenuCtx | null>(null)
const RadioGroupContext = React.createContext<{ value?: string; onValueChange?: (v: string) => void } | null>(null)

type Side = "top" | "right" | "bottom" | "left"
type Align = "start" | "center" | "end"
type Origin = { vertical: "top" | "center" | "bottom"; horizontal: "left" | "center" | "right" }

// side (which edge of the trigger the menu opens from) + align (position along
// the perpendicular axis) combine into MUI's anchorOrigin (point on the
// trigger) + transformOrigin (point on the menu placed at that anchor point).
function sideAlignToOrigins(side: Side, align: Align): { anchorOrigin: Origin; transformOrigin: Origin } {
  const horizontalFor: Record<Align, "left" | "center" | "right"> = { start: "left", center: "center", end: "right" }
  const verticalFor: Record<Align, "top" | "center" | "bottom"> = { start: "top", center: "center", end: "bottom" }

  if (side === "top" || side === "bottom") {
    return {
      anchorOrigin: { vertical: side, horizontal: horizontalFor[align] },
      transformOrigin: { vertical: side === "bottom" ? "top" : "bottom", horizontal: horizontalFor[align] },
    }
  }
  return {
    anchorOrigin: { vertical: verticalFor[align], horizontal: side },
    transformOrigin: { vertical: verticalFor[align], horizontal: side === "right" ? "left" : "right" },
  }
}

function DropdownMenu({
  children,
  // Accepted for call-site compatibility; MUI's Menu is always modal.
  modal: _modal,
}: {
  children?: React.ReactNode
  modal?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)
  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, anchorEl, setAnchorEl }}>
      {children}
    </DropdownMenuContext.Provider>
  )
}

// No-op passthroughs — MUI's Menu handles its own portaling/grouping.
function DropdownMenuPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}
function DropdownMenuGroup({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

function DropdownMenuTrigger({
  asChild,
  children,
}: {
  asChild?: boolean
  children?: React.ReactNode
}) {
  const ctx = React.useContext(DropdownMenuContext)
  const isElement = React.isValidElement<{ onClick?: (e: React.MouseEvent<HTMLElement>) => void }>(children)
  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    if (isElement) children.props.onClick?.(e)
    ctx?.setAnchorEl(e.currentTarget)
    ctx?.setOpen(true)
  }
  if (asChild && isElement) {
    return React.cloneElement(children, { onClick: handleClick })
  }
  return <button type="button" data-slot="dropdown-menu-trigger" onClick={handleClick}>{children}</button>
}

function DropdownMenuContent({
  className,
  children,
  side = "bottom",
  align = "start",
  // Radix-only knobs some call sites still pass through; MUI's Menu has no
  // direct equivalent (it auto-flips within the viewport and restores focus
  // to the trigger on close by default), so these are accepted for call-site
  // compatibility but have no effect.
  onCloseAutoFocus,
}: {
  className?: string
  sideOffset?: number
  side?: Side
  align?: Align
  children?: React.ReactNode
  onCloseAutoFocus?: (event: Event) => void
}) {
  const ctx = React.useContext(DropdownMenuContext)
  const { anchorOrigin, transformOrigin } = sideAlignToOrigins(side, align)
  return (
    <MuiMenu
      data-slot="dropdown-menu-content"
      open={!!ctx?.open}
      anchorEl={ctx?.anchorEl}
      onClose={() => ctx?.setOpen(false)}
      anchorOrigin={anchorOrigin}
      transformOrigin={transformOrigin}
      sx={{ zIndex: 1400 }}
      slotProps={{ paper: { className: cn("min-w-32", className) } }}
    >
      {children}
    </MuiMenu>
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  onClick,
  children,
  ...props
}: React.ComponentProps<typeof MuiMenuItem> & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  const ctx = React.useContext(DropdownMenuContext)
  return (
    <MuiMenuItem
      data-slot="dropdown-menu-item"
      className={cn(inset && "pl-8", variant === "destructive" && "text-destructive", className)}
      onClick={(e) => {
        onClick?.(e)
        ctx?.setOpen(false)
      }}
      {...props}
    >
      {children}
    </MuiMenuItem>
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  onCheckedChange,
  ...props
}: {
  className?: string
  children?: React.ReactNode
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
} & Omit<React.ComponentProps<typeof MuiMenuItem>, "onClick">) {
  return (
    <MuiMenuItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn("relative pl-8", className)}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        {checked && <CheckIcon sx={{ fontSize: 16 }} />}
      </span>
      {children}
    </MuiMenuItem>
  )
}

function DropdownMenuRadioGroup({
  value,
  onValueChange,
  children,
}: {
  value?: string
  onValueChange?: (value: string) => void
  children?: React.ReactNode
}) {
  return <RadioGroupContext.Provider value={{ value, onValueChange }}>{children}</RadioGroupContext.Provider>
}

function DropdownMenuRadioItem({
  className,
  children,
  value,
  ...props
}: { className?: string; children?: React.ReactNode; value: string } & Omit<
  React.ComponentProps<typeof MuiMenuItem>,
  "onClick" | "value"
>) {
  const group = React.useContext(RadioGroupContext)
  const checked = group?.value === value
  return (
    <MuiMenuItem
      data-slot="dropdown-menu-radio-item"
      className={cn("relative pl-8", className)}
      onClick={() => group?.onValueChange?.(value)}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        {checked && <CircleIcon sx={{ fontSize: 8 }} />}
      </span>
      {children}
    </MuiMenuItem>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof MuiListSubheader> & { inset?: boolean }) {
  return (
    <MuiListSubheader
      data-slot="dropdown-menu-label"
      className={cn("px-2 py-1.5 text-sm font-medium leading-normal", inset && "pl-8", className)}
      {...props}
    />
  )
}

function DropdownMenuSeparator({ className }: { className?: string }) {
  return <MuiDivider data-slot="dropdown-menu-separator" className={cn("-mx-1 my-1", className)} />
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn("text-muted-foreground ml-auto text-xs tracking-widest", className)}
      {...props}
    />
  )
}

// MUI has no built-in submenu — a nested Menu anchored to the sub-trigger,
// opened on hover/click, reproduces Radix's DropdownMenuSub/SubTrigger/SubContent.
type SubCtx = { open: boolean; setOpen: (open: boolean) => void; anchorEl: HTMLElement | null; setAnchorEl: (el: HTMLElement | null) => void }
const SubContext = React.createContext<SubCtx | null>(null)

function DropdownMenuSub({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)
  return <SubContext.Provider value={{ open, setOpen, anchorEl, setAnchorEl }}>{children}</SubContext.Provider>
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof MuiMenuItem> & { inset?: boolean }) {
  const sub = React.useContext(SubContext)
  return (
    <MuiMenuItem
      data-slot="dropdown-menu-sub-trigger"
      className={cn(inset && "pl-8", className)}
      onMouseEnter={(e) => {
        sub?.setAnchorEl(e.currentTarget)
        sub?.setOpen(true)
      }}
      {...props}
    >
      {children}
      <ChevronRightIcon sx={{ fontSize: 16, ml: "auto" }} />
    </MuiMenuItem>
  )
}

function DropdownMenuSubContent({ className, children }: { className?: string; children?: React.ReactNode }) {
  const sub = React.useContext(SubContext)
  return (
    <MuiMenu
      data-slot="dropdown-menu-sub-content"
      open={!!sub?.open}
      anchorEl={sub?.anchorEl}
      onClose={() => sub?.setOpen(false)}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
      sx={{ zIndex: 1400 }}
      slotProps={{ paper: { className: cn("min-w-32", className) } }}
    >
      {children}
    </MuiMenu>
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
