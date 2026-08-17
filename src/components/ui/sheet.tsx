import * as React from "react"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// No @material/web "sheet"/generic drawer component exists at a stable path
// (labs/navigationdrawer is a specific app-navigation drawer, not a generic
// slide-in panel for arbitrary content — different enough in purpose that
// force-fitting it seemed riskier than a plain implementation). This is a
// standard fixed-position sliding panel + backdrop, transitioning via CSS
// transform based on the controlled `open` state.
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

const sideToTransform = {
  right: "translateX(100%)",
  left: "translateX(-100%)",
  top: "translateY(-100%)",
  bottom: "translateY(100%)",
} as const

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
  const open = !!ctx?.open

  if (!open && !ctx) return null

  return (
    <div data-slot="sheet-content" style={{ position: "fixed", inset: 0, zIndex: 50, pointerEvents: open ? "auto" : "none" }}>
      <div
        onClick={() => ctx?.setOpen(false)}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          opacity: open ? 1 : 0,
          transition: "opacity 0.2s ease",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: open ? "translate(0,0)" : sideToTransform[side],
          transition: "transform 0.25s ease",
          display: "flex",
          [side === "left" ? "justifyContent" : side === "right" ? "justifyContent" : "alignItems"]:
            side === "left" ? "flex-start" : side === "right" ? "flex-end" : side === "top" ? "flex-start" : "flex-end",
          flexDirection: side === "top" || side === "bottom" ? "column" : "row",
        }}
      >
        <div
          className={cn(
            "bg-background flex flex-col gap-4 relative shadow-lg h-full",
            side === "right" && "w-[90vw] min-w-0 max-w-none border-l",
            side === "left" && "w-3/4 max-w-sm border-r",
            side === "top" && "!h-auto w-full border-b",
            side === "bottom" && "!h-auto w-full border-t",
            className,
          )}
          {...props}
        >
          {children}
          {!hideClose && (
            <button
              type="button"
              onClick={() => ctx?.setOpen(false)}
              className={cn(
                "absolute z-[60] flex size-11 items-center justify-center rounded-full border shadow-md transition-all",
                "bg-background text-foreground border-border",
                "hover:bg-gray-100 hover:text-black dark:hover:bg-white dark:hover:text-black",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                "disabled:pointer-events-none disabled:opacity-50",
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
        </div>
      </div>
    </div>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex flex-col gap-1.5 p-4", className)} {...props} />
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
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
