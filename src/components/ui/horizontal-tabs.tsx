import * as React from "react";
import "@material/web/tabs/tabs.js";
import "@material/web/tabs/secondary-tab.js";
import { cn } from "@/lib/utils";

// Same index<->value bridging as components/ui/tabs.tsx — see the comment
// there. Uses md-secondary-tab (a more compact visual style than primary-tab)
// to match this file's original "pill" toolbar look.
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

const TabsList = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, children, ...props }, ref) => {
    const ctx = React.useContext(TabsContext);
    const values = React.Children.toArray(children).map((child) =>
      React.isValidElement(child) ? (child.props as { value?: string }).value : undefined,
    );
    const activeIndex = ctx ? values.indexOf(ctx.value) : -1;

    return (
      <md-tabs
        ref={ref}
        activeTabIndex={activeIndex === -1 ? 0 : activeIndex}
        onChange={(e: React.ChangeEvent<HTMLElement>) => {
          const index = (e.target as unknown as { activeTabIndex: number }).activeTabIndex;
          const nextValue = values[index];
          if (nextValue !== undefined) ctx?.setValue(nextValue);
        }}
        className={cn("rounded-lg bg-muted p-0.5 min-h-0", className)}
        {...props}
      >
        {children}
      </md-tabs>
    );
  },
);
TabsList.displayName = "TabsList";

const TabsTrigger = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement> & { value: string; disabled?: boolean }
>(({ className, value, children, disabled, ...props }, ref) => {
  const ctx = React.useContext(TabsContext);
  return (
    <md-secondary-tab
      ref={ref}
      active={ctx?.value === value}
      disabled={disabled}
      className={cn("min-h-0 py-1.5 px-3 text-sm font-medium normal-case", className)}
      {...props}
    >
      {children}
    </md-secondary-tab>
  );
});
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
