import * as React from "react"
import MuiDrawer from "@mui/material/Drawer"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type SheetCtx = { open: boolean; setOpen: (open: boolean) => void }
const SheetContext = React.createContext<SheetCtx | null>(null)

interface SheetProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

function Sheet({ open, defaultOpen, onOpenChange, children }: SheetProps) {
  const [internal, setInternal] = React.useState(defaultOpen ?? false)
  const isOpen = open !== undefined ? open : internal

  const setOpen = (next: boolean) => {
    setInternal(next)
    onOpenChange?.(next)
  }

  return <SheetContext.Provider value={{ open: isOpen, setOpen }}>{children}</SheetContext.Provider>
}

function SheetTrigger({
  asChild,
  children,
}: {
  asChild?: boolean
  children?: React.ReactNode
}) {
  const ctx = React.useContext(SheetContext)
  const isElement = React.isValidElement<{ onClick?: (e: React.MouseEvent) => void }>(children)
  const handleClick = (e: React.MouseEvent) => {
    if (isElement) children.props.onClick?.(e)
    ctx?.setOpen(true)
  }
  if (asChild && isElement) {
    return React.cloneElement(children, { onClick: handleClick })
  }
  return <button type="button" data-slot="sheet-trigger" onClick={handleClick}>{children}</button>
}

function SheetClose({
  asChild,
  children,
}: {
  asChild?: boolean
  children?: React.ReactNode
}) {
  const ctx = React.useContext(SheetContext)
  const isElement = React.isValidElement<{ onClick?: (e: React.MouseEvent) => void }>(children)
  const handleClick = (e: React.MouseEvent) => {
    if (isElement) children.props.onClick?.(e)
    ctx?.setOpen(false)
  }
  if (asChild && isElement) {
    return React.cloneElement(children, { onClick: handleClick })
  }
  return <button type="button" data-slot="sheet-close" onClick={handleClick}>{children}</button>
}

const sideToAnchor = { top: "top", right: "right", bottom: "bottom", left: "left" } as const

// Radix's Dialog content closed itself on any document-level outside pointerdown/focus
// (even into other portals like a Sonner toast), which is why the original wired
// onFocusOutside/onInteractOutside/onPointerDownOutside through preventDismissIfSonnerToast
// to stop that. MUI's Drawer only ever dismisses on an explicit backdrop click or Escape —
// it has no such "any outside interaction closes me" behavior — so that guard has nothing
// left to prevent here and was dropped.
function SheetContent({
  className,
  children,
  side = "right",
  hideClose = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  side?: "top" | "right" | "bottom" | "left"
  /** When true, the default floating close control is not rendered (use custom `SheetClose` in children). */
  hideClose?: boolean
}) {
  const ctx = React.useContext(SheetContext)

  return (
    <MuiDrawer
      data-slot="sheet-content"
      anchor={sideToAnchor[side]}
      open={!!ctx?.open}
      onClose={() => ctx?.setOpen(false)}
      sx={{ zIndex: 50 }}
      slotProps={{
        paper: {
          className: cn(
            "flex flex-col gap-4 relative",
            side === "right" && "w-[90vw] min-w-0 max-w-none border-l",
            side === "left" && "w-3/4 border-r sm:max-w-sm",
            side === "top" && "border-b",
            side === "bottom" && "border-t",
            className,
          ),
          ...props,
        },
      }}
    >
      {children}
      {!hideClose && (
        <button
          type="button"
          onClick={() => ctx?.setOpen(false)}
          className={cn(
            "absolute z-[60] flex size-11 items-center justify-center rounded-full border shadow-md transition-all",

            // Base
            "bg-background text-foreground border-border",

            // Hover based on theme
            "hover:bg-gray-100 dark:hover:bg-white",

            // Optional text contrast on hover
            "hover:bg-gray-100 hover:text-black",
            "dark:hover:bg-white dark:hover:text-black",

            // Focus
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",

            // Disabled
            "disabled:pointer-events-none disabled:opacity-50",

            // Position — sit just outside the sheet edge (closer than full button width offset)
            side === "right" && "left-[-3rem] top-2",
            side === "left" && "right-[-3rem] top-2",
            side === "top" && "bottom-4 right-4 left-auto top-auto",
            side === "bottom" && "right-4 top-4 left-auto bottom-auto",
          )}
        >
          <XIcon className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>
      )}
    </MuiDrawer>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 data-slot="sheet-title" className={cn("text-foreground font-semibold", className)} {...props} />
}

function SheetDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p data-slot="sheet-description" className={cn("text-muted-foreground text-sm", className)} {...props} />
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetContext,
}
