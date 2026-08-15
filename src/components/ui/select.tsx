import * as React from "react"
import MuiMenu from "@mui/material/Menu"
import MuiMenuItem from "@mui/material/MenuItem"
import MuiListSubheader from "@mui/material/ListSubheader"
import MuiDivider from "@mui/material/Divider"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/** MUI's Select has no restriction on empty-string values (unlike Radix) — kept as
 * identity functions only for call-site compatibility, no longer doing any mapping. */
export const SELECT_EMPTY_VALUE = "";
export function toSelectItemValue(value: string): string {
  return value;
}
export function fromSelectItemValue(value: string): string {
  return value;
}

type SelectCtx = {
  value?: string
  onValueChange?: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  anchorEl: HTMLElement | null
  setAnchorEl: (el: HTMLElement | null) => void
  labels: Map<string, React.ReactNode>
  registerLabel: (value: string, label: React.ReactNode) => void
  disabled?: boolean
}
const SelectContext = React.createContext<SelectCtx | null>(null)

function Select({
  value,
  defaultValue,
  onValueChange,
  children,
  disabled,
  // Accepted for call-site compatibility; MUI's Menu-based Select has no modal mode.
  modal: _modal,
}: {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children?: React.ReactNode
  modal?: boolean
  disabled?: boolean
}) {
  const [internal, setInternal] = React.useState(defaultValue ?? "")
  const [open, setOpen] = React.useState(false)
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)
  const labelsRef = React.useRef(new Map<string, React.ReactNode>())
  const [, forceUpdate] = React.useState(0)

  const currentValue = value !== undefined ? value : internal

  const handleChange = (v: string) => {
    setInternal(v)
    onValueChange?.(v)
  }

  const registerLabel = React.useCallback((v: string, label: React.ReactNode) => {
    if (labelsRef.current.get(v) !== label) {
      labelsRef.current.set(v, label)
      forceUpdate((n) => n + 1)
    }
  }, [])

  return (
    <SelectContext.Provider
      value={{
        value: currentValue,
        onValueChange: handleChange,
        open,
        setOpen,
        anchorEl,
        setAnchorEl,
        labels: labelsRef.current,
        registerLabel,
        disabled,
      }}
    >
      {children}
    </SelectContext.Provider>
  )
}

// No-op passthrough — items register directly with Select's context.
function SelectGroup({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

function SelectValue({ placeholder, className }: { placeholder?: React.ReactNode; className?: string }) {
  const ctx = React.useContext(SelectContext)
  const label = ctx?.value ? ctx.labels.get(ctx.value) : undefined
  return (
    <span data-slot="select-value" className={cn(!label && "text-muted-foreground", className)}>
      {label ?? placeholder}
    </span>
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: "sm" | "default" }) {
  const ctx = React.useContext(SelectContext)
  return (
    <button
      type="button"
      data-slot="select-trigger"
      data-size={size}
      disabled={ctx?.disabled}
      onClick={(e) => {
        if (ctx?.disabled) return
        ctx?.setAnchorEl(e.currentTarget)
        ctx?.setOpen(true)
      }}
      className={cn(
        "border-input flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50",
        size === "default" ? "h-9" : "h-8",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon className="size-4 opacity-50" />
    </button>
  )
}

function SelectContent({ className, children }: { className?: string; children?: React.ReactNode; position?: string }) {
  const ctx = React.useContext(SelectContext)
  return (
    <MuiMenu
      data-slot="select-content"
      open={!!ctx?.open}
      anchorEl={ctx?.anchorEl}
      onClose={() => ctx?.setOpen(false)}
      sx={{ zIndex: 1400 }}
      slotProps={{ paper: { className: cn("min-w-32", className) } }}
    >
      {children}
    </MuiMenu>
  )
}

function SelectLabel({ className, ...props }: React.ComponentProps<typeof MuiListSubheader>) {
  return (
    <MuiListSubheader
      data-slot="select-label"
      className={cn("text-muted-foreground px-2 py-1.5 text-xs leading-normal", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  value,
  disabled,
}: {
  className?: string
  children?: React.ReactNode
  value: string
  disabled?: boolean
}) {
  const ctx = React.useContext(SelectContext)
  const isSelected = ctx?.value === value

  React.useEffect(() => {
    ctx?.registerLabel(value, children)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, children])

  return (
    <MuiMenuItem
      data-slot="select-item"
      disabled={disabled}
      selected={isSelected}
      className={cn("relative pr-8 pl-2", className)}
      onClick={() => {
        ctx?.onValueChange?.(value)
        ctx?.setOpen(false)
      }}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        {isSelected && <CheckIcon className="size-4" />}
      </span>
      {children === "" || children == null ? <span className="text-muted-foreground">(empty)</span> : children}
    </MuiMenuItem>
  )
}

function SelectSeparator({ className }: { className?: string }) {
  return <MuiDivider data-slot="select-separator" className={cn("-mx-1 my-1", className)} />
}

// MUI's Menu scrolls natively — Radix's dedicated scroll-up/down buttons
// have no equivalent need here; kept as no-op exports for call-site compatibility.
function SelectScrollUpButton() {
  return null
}
function SelectScrollDownButton() {
  return null
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
