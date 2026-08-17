import * as React from "react";
import { cn } from "@/lib/utils";
import "@material/web/dialog/dialog.js";
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

// Same slot-bucketing as dialog.tsx's DialogContent — see the comment there.
const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const ctx = React.useContext(DialogContext);

    const contentChildren: React.ReactNode[] = [];
    let actionsChildren: React.ReactNode = null;

    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && child.type === DialogFooter) {
        actionsChildren = (child.props as { children?: React.ReactNode }).children;
      } else {
        contentChildren.push(child);
      }
    });

    return (
      <md-dialog
        open={!!ctx?.open}
        onClosed={() => ctx?.setOpen(false)}
        onCancel={() => ctx?.setOpen(false)}
        style={{ zIndex: 50 }}
      >
        <div ref={ref} slot="content" className={cn("rounded-xl gap-3 flex flex-col", className)} {...props}>
          {contentChildren}
        </div>
        {actionsChildren && <div slot="actions">{actionsChildren}</div>}
      </md-dialog>
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
