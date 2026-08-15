import * as React from "react"
import MuiSnackbar from "@mui/material/Snackbar"
import MuiAlert from "@mui/material/Alert"
import IconButton from "@mui/material/IconButton"
import CloseIcon from "@mui/icons-material/Close"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// NOTE: nothing in this app currently mounts a <ToastProvider>/<ToastViewport>
// tree using these components — src/hooks/use-toast.ts only consumes the
// ToastProps/ToastActionElement *types* below. Converted faithfully to MUI
// (Snackbar/Alert) to preserve the existing API shape in case a Toaster gets
// wired up later; behavior is unchanged (still not rendered anywhere).

const ToastProvider = ({ children }: { children?: React.ReactNode }) => <>{children}</>

const ToastViewport = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("fixed top-0 right-0 z-[100] flex max-h-screen w-full flex-col p-4 md:max-w-[420px]", className)}
      {...props}
    />
  ),
)
ToastViewport.displayName = "ToastViewport"

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-md border p-4 pr-6 shadow-lg transition-all",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive: "destructive border-destructive bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
)

interface ToastRootProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof toastVariants> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const Toast = React.forwardRef<HTMLDivElement, ToastRootProps>(
  ({ className, variant, open = true, onOpenChange, children, ...props }, ref) => {
    return (
      <MuiSnackbar
        open={open}
        onClose={() => onOpenChange?.(false)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MuiAlert
          ref={ref}
          severity={variant === "destructive" ? "error" : undefined}
          className={cn(toastVariants({ variant }), className)}
          {...props}
        >
          {children}
        </MuiAlert>
      </MuiSnackbar>
    )
  },
)
Toast.displayName = "Toast"

const ToastAction = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-secondary focus:outline-none focus:ring-1 focus:ring-ring disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
        className,
      )}
      {...props}
    />
  ),
)
ToastAction.displayName = "ToastAction"

const ToastClose = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <IconButton
      ref={ref}
      size="small"
      className={cn(
        "absolute right-1 top-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100",
        className,
      )}
      {...props}
    >
      <CloseIcon sx={{ fontSize: 16 }} />
    </IconButton>
  ),
)
ToastClose.displayName = "ToastClose"

const ToastTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm font-semibold [&+div]:text-xs", className)} {...props} />
  ),
)
ToastTitle.displayName = "ToastTitle"

const ToastDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("text-sm opacity-90", className)} {...props} />,
)
ToastDescription.displayName = "ToastDescription"

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
