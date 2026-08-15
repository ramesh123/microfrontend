import * as React from "react";
import MuiMenu from "@mui/material/Menu";
import MuiMenuItem from "@mui/material/MenuItem";
import { cn } from "@/lib/utils";

type SelectCtx = {
  value?: string;
  onValueChange?: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  anchorEl: HTMLElement | null;
  setAnchorEl: (el: HTMLElement | null) => void;
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
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const currentValue = value !== undefined ? value : internal;

  const handleChange = (v: string) => {
    setInternal(v);
    onValueChange?.(v);
  };

  return (
    <SelectContext.Provider value={{ value: currentValue, onValueChange: handleChange, open, setOpen, anchorEl, setAnchorEl }}>
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
        className={cn("flex w-full items-center justify-between", className)}
        onClick={(e) => {
          ctx?.setAnchorEl(e.currentTarget);
          ctx?.setOpen(true);
        }}
        {...props}
      >
        {children}
      </button>
    );
  },
);
SelectTrigger.displayName = "SelectTrigger";

const SelectContent = React.forwardRef<HTMLDivElement, { className?: string; children?: React.ReactNode; position?: string }>(
  ({ className, children }, ref) => {
    const ctx = React.useContext(SelectContext);
    return (
      <MuiMenu
        open={!!ctx?.open}
        anchorEl={ctx?.anchorEl}
        onClose={() => ctx?.setOpen(false)}
        sx={{ zIndex: 50 }}
        slotProps={{ paper: { ref, className: cn("min-w-[11.5rem]", className) } }}
      >
        {children}
      </MuiMenu>
    );
  },
);
SelectContent.displayName = "SelectContent";

// MUI's Menu already portals via its own Popper/Modal internally — no
// separate "without portal" variant is meaningful, so this is the same implementation.
const SelectContentWithoutPortal = SelectContent;

const SelectLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)} {...props} />
  ),
);
SelectLabel.displayName = "SelectLabel";

const SelectItem = React.forwardRef<
  HTMLLIElement,
  { className?: string; children?: React.ReactNode; value: string; disabled?: boolean }
>(({ className, children, value, disabled }, ref) => {
  const ctx = React.useContext(SelectContext);
  return (
    <MuiMenuItem
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
    </MuiMenuItem>
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
