import * as React from "react";
import MuiDialog from "@mui/material/Dialog";
import { cn } from "@/lib/utils";
// Reuses dialog.tsx's context (not a separate instance) so the shared
// DialogClose there works correctly whether it's rendered inside this
// Root or dialog.tsx's — see baseModal, which shares Footer/DialogClose
// across both "dialog" and "modal" types.
import { DialogContext } from "./dialog";

interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
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
  children?: React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>;
}) {
  const ctx = React.useContext(DialogContext);
  const handleClick = (e: React.MouseEvent) => {
    children?.props.onClick?.(e);
    ctx?.setOpen(true);
  };
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, { onClick: handleClick });
  }
  return <button type="button" onClick={handleClick}>{children}</button>;
}

const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const ctx = React.useContext(DialogContext);
    return (
      <MuiDialog
        open={!!ctx?.open}
        onClose={() => ctx?.setOpen(false)}
        sx={{ zIndex: 50 }}
        slotProps={{ paper: { ref, className: cn("rounded-xl p-3 gap-3 flex flex-col", className), ...props } }}
      >
        {children}
      </MuiDialog>
    );
  },
);
DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
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

export { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger };
