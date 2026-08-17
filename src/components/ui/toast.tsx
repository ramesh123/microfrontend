import * as React from "react"
import "@material/web/iconbutton/icon-button.js"
import "@material/web/button/text-button.js"
import { X as CloseIcon } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// ToastAction used Tailwind's group-[.destructive]: selectors to pick up its
// hover/border colors from the ancestor Toast's variant — that only works
// because a plain <button> renders in the light DOM. md-text-button renders
// its actual surface inside a shadow root, which Tailwind utility classes on
// the host element can't reach, so this context carries the variant down
// directly instead (same shape as how Button itself maps variant -> color).
const ToastVariantContext = React.createContext<"default" | "destructive">("default")

// NOTE: nothing in this app currently mounts a <ToastProvider>/<ToastViewport>
// tree using these components — src/hooks/use-toast.ts only consumes the
// ToastProps/ToastActionElement *types* below. Converted faithfully (still
// not rendered anywhere) to preserve the existing API shape in case a
// Toaster gets wired up later. No @material/web snackbar component exists
// yet (a known gap in the library), so this is a plain fixed-position card
// rather than a library primitive.

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
  ({ className, variant = "default", open = true, onOpenChange, children, ...props }, ref) => {
    if (!open) return null
    return (
      <ToastVariantContext.Provider value={variant ?? "default"}>
        <div
          ref={ref}
          role="status"
          className={cn(toastVariants({ variant }), className)}
          {...props}
        >
          {children}
        </div>
      </ToastVariantContext.Provider>
    )
  },
)
Toast.displayName = "Toast"

const ToastAction = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => {
    const variant = React.useContext(ToastVariantContext)
    return (
      <md-text-button
        ref={ref}
        className={cn("h-8 shrink-0 text-sm font-medium", className)}
        style={
          variant === "destructive"
            ? ({
                "--md-text-button-label-text-color": "var(--destructive-foreground)",
                "--md-text-button-hover-label-text-color": "var(--destructive-foreground)",
                "--md-text-button-hover-state-layer-color": "var(--destructive-foreground)",
              } as React.CSSProperties)
            : undefined
        }
        {...props}
      />
    )
  },
)
ToastAction.displayName = "ToastAction"

const ToastClose = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <md-icon-button
      ref={ref}
      className={cn(
        "absolute right-1 top-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100",
        className,
      )}
      {...props}
    >
      <CloseIcon size={16} />
    </md-icon-button>
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
