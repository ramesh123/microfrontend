import * as React from "react";
import MuiDialog from "@mui/material/Dialog";
import CloseIcon from "@mui/icons-material/Close";
import IconButton from "@mui/material/IconButton";
import { cn } from "@/lib/utils";
import ShadTooltip from "../common/shadTooltipComponent";

type DialogCtx = { open: boolean; setOpen: (open: boolean) => void };
// Exported so any other Dialog-like Root (e.g. a future no-close variant)
// can write to this same context — lets a single DialogClose work
// correctly regardless of which Root implementation actually rendered it.
export const DialogContext = React.createContext<DialogCtx | null>(null);

interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
  // Accepted for call-site compatibility; MUI's Dialog is always modal.
  modal?: boolean;
}

function Dialog({ open, defaultOpen, onOpenChange, children }: DialogProps) {
  const [internal, setInternal] = React.useState(defaultOpen ?? false);
  const isOpen = open !== undefined ? open : internal;

  const setOpen = (next: boolean) => {
    setInternal(next);
    onOpenChange?.(next);
  };

  return <DialogContext.Provider value={{ open: isOpen, setOpen }}>{children}</DialogContext.Provider>;
}

function DialogTrigger({
  asChild,
  children,
}: {
  asChild?: boolean;
  children?: React.ReactNode;
}) {
  const ctx = React.useContext(DialogContext);
  const isElement = React.isValidElement<{ onClick?: (e: React.MouseEvent) => void }>(children);
  const handleClick = (e: React.MouseEvent) => {
    if (isElement) children.props.onClick?.(e);
    ctx?.setOpen(true);
  };

  if (asChild && isElement) {
    return React.cloneElement(children, { onClick: handleClick });
  }
  return <button type="button" onClick={handleClick}>{children}</button>;
}

function DialogClose({
  asChild,
  children,
}: {
  asChild?: boolean;
  children?: React.ReactNode;
}) {
  const ctx = React.useContext(DialogContext);
  const isElement = React.isValidElement<{ onClick?: (e: React.MouseEvent) => void }>(children);
  const handleClick = (e: React.MouseEvent) => {
    if (isElement) children.props.onClick?.(e);
    ctx?.setOpen(false);
  };
  if (asChild && isElement) {
    return React.cloneElement(children, { onClick: handleClick });
  }
  return <button type="button" onClick={handleClick}>{children}</button>;
}

// Create a VisuallyHidden component for accessibility
const VisuallyHidden = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ children, ...props }, ref) => (
    <span
      ref={ref}
      className="absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0"
      style={{ clip: "rect(0 0 0 0)", clipPath: "inset(50%)" }}
      {...props}
    >
      {children}
    </span>
  ),
);
VisuallyHidden.displayName = "VisuallyHidden";

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  hideTitle?: boolean;
  hideCloseButton?: boolean;
  closeButtonClassName?: string;
  showOverlay?: boolean;
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, hideTitle = false, hideCloseButton = false, closeButtonClassName, showOverlay = true, ...props }, ref) => {
    const ctx = React.useContext(DialogContext);

    const hasDialogTitle = React.Children.toArray(children).some(
      (child) => React.isValidElement(child) && child.type === DialogTitle,
    );

    return (
      <MuiDialog
        open={!!ctx?.open}
        onClose={() => ctx?.setOpen(false)}
        hideBackdrop={!showOverlay}
        sx={{ zIndex: 1300 }}
        slotProps={{
          paper: {
            ref,
            className: cn("rounded-xl p-6 gap-4 flex flex-col relative", className),
            ...props,
          },
        }}
      >
        {!hasDialogTitle && !hideTitle && (
          <VisuallyHidden>
            <DialogTitle>Dialog</DialogTitle>
          </VisuallyHidden>
        )}
        {children}
        {!hideCloseButton && (
          <ShadTooltip styleClasses="z-[1300]" content="Close" side="bottom" avoidCollisions>
            <IconButton
              onClick={() => ctx?.setOpen(false)}
              className={cn("absolute right-2 top-2", closeButtonClassName)}
              size="small"
            >
              <CloseIcon sx={{ fontSize: 18 }} />
              <span className="sr-only">Close</span>
            </IconButton>
          </ShadTooltip>
        )}
      </MuiDialog>
    );
  },
);
DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1 text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  VisuallyHidden,
};
