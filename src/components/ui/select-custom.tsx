import * as React from "react";
import "@material/web/menu/menu.js";
import "@material/web/menu/menu-item.js";
import { cn } from "@/lib/utils";

// Same md-menu anchor-by-id approach as components/ui/select.tsx.
type SelectCtx = {
  value?: string;
  onValueChange?: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  anchorId: string;
};
const SelectContext = React.createContext<SelectCtx | null>(null);

function Select({
  value,
  defaultValue,
  onValueChange,
  children,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
}) {
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const [open, setOpen] = React.useState(false);
  const anchorId = React.useId();
  const currentValue = value !== undefined ? value : internal;

  const handleChange = (v: string) => {
    setInternal(v);
    onValueChange?.(v);
  };

  return (
    <SelectContext.Provider value={{ value: currentValue, onValueChange: handleChange, open, setOpen, anchorId }}>
      {children}
    </SelectContext.Provider>
  );
}

function SelectGroup({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

function SelectValue({ placeholder, className }: { placeholder?: React.ReactNode; className?: string }) {
  const ctx = React.useContext(SelectContext);
  return <span className={className}>{ctx?.value || placeholder}</span>;
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => {
    const ctx = React.useContext(SelectContext);
    return (
      <button
        ref={ref}
        type="button"
        id={ctx?.anchorId}
        className={cn("flex w-full items-center justify-between", className)}
        onClick={() => ctx?.setOpen(true)}
        {...props}
      >
        {children}
      </button>
    );
  },
);
SelectTrigger.displayName = "SelectTrigger";

const SelectContent = React.forwardRef<HTMLElement, { className?: string; children?: React.ReactNode; position?: string }>(
  ({ className, children }, ref) => {
    const ctx = React.useContext(SelectContext);
    return (
      <md-menu
        ref={ref}
        anchor={ctx?.anchorId}
        open={!!ctx?.open}
        onClosed={() => ctx?.setOpen(false)}
        className={cn("min-w-[11.5rem]", className)}
        style={{ zIndex: 50 }}
      >
        {children}
      </md-menu>
    );
  },
);
SelectContent.displayName = "SelectContent";

// md-menu already portals internally (positioning: 'fixed'/'popover') — no
// separate "without portal" variant is meaningful, same as before.
const SelectContentWithoutPortal = SelectContent;

const SelectLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)} {...props} />
  ),
);
SelectLabel.displayName = "SelectLabel";

const SelectItem = React.forwardRef<
  HTMLElement,
  { className?: string; children?: React.ReactNode; value: string; disabled?: boolean }
>(({ className, children, value, disabled }, ref) => {
  const ctx = React.useContext(SelectContext);
  return (
    <md-menu-item
      ref={ref}
      disabled={disabled}
      selected={ctx?.value === value}
      className={cn("relative flex w-full cursor-pointer select-none items-center rounded-sm px-3 py-1.5 text-sm", className)}
      onClick={() => {
        ctx?.onValueChange?.(value);
        ctx?.setOpen(false);
      }}
    >
      <div>{children}</div>
    </md-menu-item>
  );
});
SelectItem.displayName = "SelectItem";

const SelectSeparator = React.forwardRef<HTMLHRElement, React.HTMLAttributes<HTMLHRElement>>(
  ({ className, ...props }, ref) => <hr ref={ref} className={cn("-mx-1 my-1 border-t bg-muted", className)} {...props} />,
);
SelectSeparator.displayName = "SelectSeparator";

export {
  Select,
  SelectContent,
  SelectContentWithoutPortal,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
