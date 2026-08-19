import * as React from "react";
import "@material/web/menu/menu.js";
import { dismissOtherMenus, useMdMenu } from "@/lib/use-md-menu";

// No @material/web "popover" component exists — md-menu is reused as the
// generic anchored-surface engine here (same as select.tsx/dropdown-menu.tsx),
// anchored by element id rather than MUI's anchorEl reference.
type PopoverCtx = {
  open: boolean;
  setOpen: (open: boolean) => void;
  anchorId: string;
};
const PopoverContext = React.createContext<PopoverCtx | null>(null);

interface PopoverProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

function Popover({ open, defaultOpen, onOpenChange, children }: PopoverProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false);
  const anchorId = React.useId();
  const isOpen = open !== undefined ? open : internalOpen;

  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <PopoverContext.Provider value={{ open: isOpen, setOpen, anchorId }}>
      {children}
    </PopoverContext.Provider>
  );
}

function PopoverTrigger({
  asChild,
  children,
}: {
  asChild?: boolean;
  children?: React.ReactElement<{
    onClick?: (e: React.MouseEvent<HTMLElement>) => void;
    onPointerDown?: (e: React.PointerEvent<HTMLElement>) => void;
    id?: string;
  }>;
}) {
  const ctx = React.useContext(PopoverContext);
  const isElement = React.isValidElement<{
    onClick?: (e: React.MouseEvent<HTMLElement>) => void;
    onPointerDown?: (e: React.PointerEvent<HTMLElement>) => void;
    id?: string;
  }>(children);

  const handlePointerDown = () => {
    dismissOtherMenus(ctx?.anchorId);
  };
  const handleClick = () => {
    ctx?.setOpen(!ctx.open);
  };

  if (asChild && isElement) {
    return React.cloneElement(children, {
      id: ctx?.anchorId,
      onPointerDown: handlePointerDown,
      onClick: (e: React.MouseEvent<HTMLElement>) => {
        children.props.onClick?.(e);
        handleClick();
      },
    });
  }

  return (
    <button
      type="button"
      id={ctx?.anchorId}
      data-slot="popover-trigger"
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}

function PopoverAnchor({ children }: { children?: React.ReactElement }) {
  const ctx = React.useContext(PopoverContext);
  if (!React.isValidElement(children)) return <>{children}</>;
  return React.cloneElement(children, { id: ctx?.anchorId } as never);
}

function PopoverContent({
  className,
  align = "center",
  children,
}: {
  className?: string;
  align?: "start" | "center" | "end";
  sideOffset?: number;
  children?: React.ReactNode;
}) {
  const ctx = React.useContext(PopoverContext);
  const { menuRef, onClosing, onClosed } = useMdMenu(!!ctx?.open, ctx?.setOpen ?? (() => {}), ctx?.anchorId);
  const inline = align === "start" ? "start" : align === "end" ? "end" : "start";

  return (
    <md-menu
      ref={menuRef}
      anchor={ctx?.anchorId}
      quick
      onClosing={onClosing}
      onClosed={onClosed}
      anchorCorner={`end-${inline}`}
      menuCorner={`start-${inline}`}
      positioning="popover"
      className={className}
    >
      {children}
    </md-menu>
  );
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
