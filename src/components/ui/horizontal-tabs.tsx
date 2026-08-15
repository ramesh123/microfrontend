import * as React from "react";
import MuiTabs from "@mui/material/Tabs";
import MuiTab from "@mui/material/Tab";
import { cn } from "@/lib/utils";

type TabsCtx = { value: string; setValue: (v: string) => void };
const TabsContext = React.createContext<TabsCtx | null>(null);

interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children?: React.ReactNode;
}

function Tabs({ value, defaultValue, onValueChange, className, children }: TabsProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const current = value !== undefined ? value : internal;

  const setValue = (v: string) => {
    setInternal(v);
    onValueChange?.(v);
  };

  return (
    <TabsContext.Provider value={{ value: current, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const ctx = React.useContext(TabsContext);
    return (
      <MuiTabs
        ref={ref}
        value={ctx?.value ?? false}
        onChange={(_event, newValue) => ctx?.setValue(newValue)}
        className={cn("rounded-lg bg-muted p-0.5 min-h-0", className)}
        variant="scrollable"
        scrollButtons="auto"
        {...props}
      >
        {children}
      </MuiTabs>
    );
  },
);
TabsList.displayName = "TabsList";

const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  React.HTMLAttributes<HTMLButtonElement> & { value: string; disabled?: boolean }
>(({ className, value, children, disabled, ...props }, ref) => (
  <MuiTab
    ref={ref}
    value={value}
    label={children}
    disabled={disabled}
    className={cn("min-h-0 py-1.5 px-3 text-sm font-medium normal-case", className)}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, value, children, ...props }, ref) => {
  const ctx = React.useContext(TabsContext);
  if (ctx?.value !== value) return null;
  return (
    <div ref={ref} className={cn("mt-2", className)} {...props}>
      {children}
    </div>
  );
});
TabsContent.displayName = "TabsContent";

export { Tabs, TabsContent, TabsList, TabsTrigger };
