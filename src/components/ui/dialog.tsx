import * as React from "react";
import { X as CloseIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import ShadTooltip from "../common/shadTooltipComponent";
import "@material/web/dialog/dialog.js";
import "@material/web/iconbutton/icon-button.js";

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
  // Accepted for call-site compatibility; md-dialog is always modal.
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

// md-dialog requires content in explicit named slots (content/actions/
// headline) rather than free-flowing children the way MUI's Dialog took them
// — DialogFooter's children go to slot="actions", everything else (including
// DialogHeader/DialogTitle/DialogDescription however a call site nests them)
// goes to slot="content" as one block. That trades the dialog's native
// sticky-headline-with-divider treatment for zero changes to how any of the
// ~15 call sites structure their JSX. md-dialog always renders its own
// backdrop scrim (no prop to disable it), so `showOverlay` no longer has an
// effect — noted here since call sites that passed `showOverlay={false}`
// will now see a change.
const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, hideTitle = false, hideCloseButton = false, closeButtonClassName, showOverlay = true, ...props }, ref) => {
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
        className={cn("rounded-xl", className)}
        style={{ zIndex: 1300 }}
      >
        <div ref={ref} slot="content" className="relative flex flex-col gap-4" {...props}>
          {contentChildren}
          {!hideCloseButton && (
            <ShadTooltip styleClasses="z-[1300]" content="Close" side="bottom" avoidCollisions>
              <md-icon-button
                type="button"
                onClick={() => ctx?.setOpen(false)}
                className={cn("absolute right-2 top-2", closeButtonClassName)}
              >
                <CloseIcon size={18} />
                <span className="sr-only">Close</span>
              </md-icon-button>
            </ShadTooltip>
          )}
        </div>
        {actionsChildren && <div slot="actions">{actionsChildren}</div>}
      </md-dialog>
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
