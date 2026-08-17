import * as React from "react"
import { Button, buttonVariants, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import "@material/web/dialog/dialog.js"

type AlertDialogCtx = { open: boolean; setOpen: (open: boolean) => void }
const AlertDialogContext = React.createContext<AlertDialogCtx | null>(null)

interface AlertDialogProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

function AlertDialog({ open, defaultOpen, onOpenChange, children }: AlertDialogProps) {
  const [internal, setInternal] = React.useState(defaultOpen ?? false)
  const isOpen = open !== undefined ? open : internal

  const setOpen = (next: boolean) => {
    setInternal(next)
    onOpenChange?.(next)
  }

  return <AlertDialogContext.Provider value={{ open: isOpen, setOpen }}>{children}</AlertDialogContext.Provider>
}

function AlertDialogTrigger({
  asChild,
  children,
}: {
  asChild?: boolean
  children?: React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>
}) {
  const ctx = React.useContext(AlertDialogContext)
  const handleClick = (e: React.MouseEvent) => {
    children?.props.onClick?.(e)
    ctx?.setOpen(true)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, { onClick: handleClick })
  }
  return <button type="button" onClick={handleClick}>{children}</button>
}

// Kept only for API compatibility — md-dialog handles its own portal/overlay.
function AlertDialogPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

// Same slot-bucketing as dialog.tsx's DialogContent — see the comment there.
// type="alert" gives md-dialog the alertdialog ARIA role, matching the
// original component's semantics.
function AlertDialogContent({ className, children }: { className?: string; children?: React.ReactNode }) {
  const ctx = React.useContext(AlertDialogContext)

  const contentChildren: React.ReactNode[] = []
  let actionsChildren: React.ReactNode = null

  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.type === AlertDialogFooter) {
      actionsChildren = (child.props as { children?: React.ReactNode }).children
    } else {
      contentChildren.push(child)
    }
  })

  return (
    <md-dialog
      type="alert"
      open={!!ctx?.open}
      onClosed={() => ctx?.setOpen(false)}
      className={className}
      style={{ zIndex: 1300 }}
    >
      <div slot="content" className="flex flex-col gap-2">
        {contentChildren}
      </div>
      {actionsChildren && <div slot="actions">{actionsChildren}</div>}
    </md-dialog>
  )
}

function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
}

function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
      {...props}
    />
  )
}

function AlertDialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold", className)} {...props} />
}

function AlertDialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />
}

const AlertDialogAction = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, onClick, ...props }, ref) => {
  const ctx = React.useContext(AlertDialogContext)
  return (
    <Button
      ref={ref}
      className={cn(buttonVariants(), className)}
      onClick={(e) => {
        onClick?.(e)
        ctx?.setOpen(false)
      }}
      {...props}
    />
  )
})
AlertDialogAction.displayName = "AlertDialogAction"

const AlertDialogCancel = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, onClick, ...props }, ref) => {
  const ctx = React.useContext(AlertDialogContext)
  return (
    <Button
      ref={ref}
      variant="outline"
      className={cn("mt-2 sm:mt-0", className)}
      onClick={(e) => {
        onClick?.(e)
        ctx?.setOpen(false)
      }}
      {...props}
    />
  )
})
AlertDialogCancel.displayName = "AlertDialogCancel"

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
