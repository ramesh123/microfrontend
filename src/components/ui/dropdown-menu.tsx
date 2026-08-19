import * as React from "react";
import "@material/web/menu/menu.js";
import "@material/web/menu/menu-item.js";
import "@material/web/menu/sub-menu.js";
import "@material/web/divider/divider.js";
import { Check as CheckIcon, ChevronRight as ChevronRightIcon, Circle as CircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { adoptCompactMenuItemStyles } from "@/lib/compact-md-menu";
import { dismissOtherMenus, useMdMenu } from "@/lib/use-md-menu";

type MenuCtx = {
  open: boolean;
  setOpen: (open: boolean) => void;
  anchorId: string;
};
const DropdownMenuContext = React.createContext<MenuCtx | null>(null);
const RadioGroupContext = React.createContext<{ value?: string; onValueChange?: (v: string) => void } | null>(null);

type Side = "top" | "right" | "bottom" | "left";
type Align = "start" | "center" | "end";

function sideAlignToCorners(side: Side, align: Align): { anchorCorner: string; menuCorner: string } {
  if (side === "top") {
    const inline = align === "end" ? "end" : "start";
    return { anchorCorner: `start-${inline}`, menuCorner: `end-${inline}` };
  }
  if (side === "bottom") {
    const inline = align === "end" ? "end" : "start";
    return { anchorCorner: `end-${inline}`, menuCorner: `start-${inline}` };
  }
  if (side === "right") {
    if (align === "end") return { anchorCorner: "end-end", menuCorner: "end-start" };
    if (align === "center") return { anchorCorner: "start-end", menuCorner: "start-start" };
    return { anchorCorner: "start-end", menuCorner: "start-start" };
  }
  if (side === "left") {
    if (align === "end") return { anchorCorner: "end-start", menuCorner: "end-end" };
    if (align === "center") return { anchorCorner: "start-start", menuCorner: "start-end" };
    return { anchorCorner: "start-start", menuCorner: "start-end" };
  }
  return { anchorCorner: "end-start", menuCorner: "start-start" };
}

function sideAlignToOffsets(side: Side, sideOffset = 4): { xOffset: number; yOffset: number } {
  if (side === "right") return { xOffset: sideOffset, yOffset: 0 };
  if (side === "left") return { xOffset: -sideOffset, yOffset: 0 };
  if (side === "top") return { xOffset: 0, yOffset: -sideOffset };
  return { xOffset: 0, yOffset: sideOffset };
}

function DropdownMenu({
  children,
  // Accepted for call-site compatibility; md-menu has no modal mode.
  modal: _modal,
}: {
  children?: React.ReactNode;
  modal?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const anchorId = React.useId();
  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, anchorId }}>
      {children}
    </DropdownMenuContext.Provider>
  );
}

// No-op passthroughs — md-menu handles its own portaling/grouping.
function DropdownMenuPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}
function DropdownMenuGroup({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

function DropdownMenuTrigger({
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
  const ctx = React.useContext(DropdownMenuContext);
  const isElement = React.isValidElement<{
    onClick?: (e: React.MouseEvent<HTMLElement>) => void;
    onPointerDown?: (e: React.PointerEvent<HTMLElement>) => void;
    id?: string;
  }>(children);
  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (isElement) children.props.onPointerDown?.(e);
    dismissOtherMenus(ctx?.anchorId);
  };
  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    if (isElement) children.props.onClick?.(e);
    ctx?.setOpen(!ctx.open);
  };
  if (asChild && isElement) {
    return React.cloneElement(children, {
      onClick: handleClick,
      onPointerDown: handlePointerDown,
      id: ctx?.anchorId,
    });
  }
  return (
    <button
      type="button"
      id={ctx?.anchorId}
      data-slot="dropdown-menu-trigger"
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      {children}
    </button>
  );
}

function DropdownMenuContent({
  className,
  children,
  side = "bottom",
  align = "start",
  sideOffset = 4,
  // Radix-only knob some call sites still pass through; md-menu restores
  // focus to its anchor on close by default, so this is accepted for
  // call-site compatibility but has no effect.
  onCloseAutoFocus,
}: {
  className?: string;
  sideOffset?: number;
  side?: Side;
  align?: Align;
  children?: React.ReactNode;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const ctx = React.useContext(DropdownMenuContext);
  const { menuRef, onClosing, onClosed } = useMdMenu(!!ctx?.open, ctx?.setOpen ?? (() => {}), ctx?.anchorId);
  const { anchorCorner, menuCorner } = sideAlignToCorners(side, align);
  const { xOffset, yOffset } = sideAlignToOffsets(side, sideOffset);
  return (
    <md-menu
      ref={menuRef}
      data-slot="dropdown-menu-content"
      quick
      anchor={ctx?.anchorId}
      onClosing={onClosing}
      onClosed={onClosed}
      anchorCorner={anchorCorner}
      menuCorner={menuCorner}
      xOffset={xOffset}
      yOffset={yOffset}
      positioning="popover"
      className={cn("min-w-32", className)}
    >
      {children}
    </md-menu>
  );
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  onClick,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  inset?: boolean;
  variant?: "default" | "destructive";
}) {
  const ctx = React.useContext(DropdownMenuContext);
  return (
    <md-menu-item
      ref={adoptCompactMenuItemStyles}
      data-slot="dropdown-menu-item"
      className={cn(inset && "pl-8", variant === "destructive" && "text-destructive", className)}
      onClick={(e: React.MouseEvent<HTMLElement>) => {
        onClick?.(e);
        ctx?.setOpen(false);
      }}
      {...props}
    >
      <span className="flex w-full min-w-0 items-center gap-2">
        {children}
      </span>
    </md-menu-item>
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  onCheckedChange,
  ...props
}: {
  className?: string;
  children?: React.ReactNode;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
} & Omit<React.HTMLAttributes<HTMLElement>, "onClick">) {
  return (
    <md-menu-item
      ref={adoptCompactMenuItemStyles}
      data-slot="dropdown-menu-checkbox-item"
      // Without this, md-menu-item's default click handler always requests
      // the parent md-menu to close (see menuItemController.js) — wrong for
      // a checkbox item, which should stay open so multiple boxes can be
      // toggled in one pass, matching the original Radix/MUI behavior.
      keepOpen
      className={cn("relative pl-8", className)}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        {checked && <CheckIcon size={16} />}
      </span>
      {children}
    </md-menu-item>
  );
}

function DropdownMenuRadioGroup({
  value,
  onValueChange,
  children,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
}) {
  return <RadioGroupContext.Provider value={{ value, onValueChange }}>{children}</RadioGroupContext.Provider>;
}

function DropdownMenuRadioItem({
  className,
  children,
  value,
  ...props
}: { className?: string; children?: React.ReactNode; value: string } & Omit<
  React.HTMLAttributes<HTMLElement>,
  "onClick" | "value"
>) {
  const group = React.useContext(RadioGroupContext);
  const checked = group?.value === value;
  return (
    <md-menu-item
      ref={adoptCompactMenuItemStyles}
      data-slot="dropdown-menu-radio-item"
      // Same reasoning as DropdownMenuCheckboxItem — the original behavior
      // (unchanged from the MUI-era version) never explicitly closed the menu
      // on a radio-item click, leaving that to the call site's onValueChange
      // handler; md-menu-item's default auto-close-on-click would otherwise
      // override that.
      keepOpen
      className={cn("relative pl-8", className)}
      onClick={() => group?.onValueChange?.(value)}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        {checked && <CircleIcon size={8} fill="currentColor" />}
      </span>
      {children}
    </md-menu-item>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }) {
  return (
    <div
      data-slot="dropdown-menu-label"
      className={cn("px-2 py-1.5 text-sm font-medium leading-normal", inset && "pl-8", className)}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className }: { className?: string }) {
  return <md-divider data-slot="dropdown-menu-separator" className={cn("-mx-1 my-1", className)} />;
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn("text-muted-foreground ml-auto text-xs tracking-widest", className)}
      {...props}
    />
  );
}

// md-sub-menu is a real submenu primitive (unlike MUI, which needed a
// hand-rolled nested Menu anchored on hover) — it expects a slot="item"
// trigger plus a nested <md-menu> as its two children and manages its own
// hover-open/close timing internally, no external open/anchor state needed.
// DropdownMenuSubTrigger/SubContent don't render themselves; DropdownMenuSub
// walks its children once to pull each one's props into that slot structure,
// same "reads its children's props" pattern used in avatar.tsx/tooltip.tsx.
function DropdownMenuSub({ children }: { children?: React.ReactNode }) {
  let trigger: React.ReactNode = null;
  let triggerClassName: string | undefined;
  let content: React.ReactNode = null;
  let contentClassName: string | undefined;

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === DropdownMenuSubTrigger) {
      const p = child.props as { children?: React.ReactNode; className?: string };
      trigger = p.children;
      triggerClassName = p.className;
    } else if (child.type === DropdownMenuSubContent) {
      const p = child.props as { children?: React.ReactNode; className?: string };
      content = p.children;
      contentClassName = p.className;
    }
  });

  return (
    <md-sub-menu data-slot="dropdown-menu-sub">
      <md-menu-item ref={adoptCompactMenuItemStyles} slot="item" className={triggerClassName}>
        <span className="flex w-full min-w-0 items-center gap-2">
          {trigger}
          <ChevronRightIcon size={16} className="ml-auto" />
        </span>
      </md-menu-item>
      <md-menu positioning="popover" quick className={cn("min-w-32", contentClassName)}>
        {content}
      </md-menu>
    </md-sub-menu>
  );
}

// Not rendered directly — DropdownMenuSub reads these props above.
function DropdownMenuSubTrigger({
  className,
  inset,
  children,
}: React.HTMLAttributes<HTMLElement> & { inset?: boolean }) {
  return <>{children}</>;
}

function DropdownMenuSubContent({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <>{children}</>;
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
};
