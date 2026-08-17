import * as React from "react";
import "@material/web/tabs/tabs.js";
import "@material/web/tabs/primary-tab.js";

// md-tabs tracks the active tab by numeric index (activeTabIndex), not by a
// string value the way our API (and Radix's) does — TabsList builds an
// ordered [value, ...] array from its TabsTrigger children's `value` props
// once, then translates index <-> value in both directions using that array.
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
      <div data-slot="tabs" className={className} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

function TabsList({ className, children }: { className?: string; children?: React.ReactNode }) {
  const ctx = React.useContext(TabsContext);

  const values = React.Children.toArray(children).map((child) =>
    React.isValidElement(child) ? (child.props as { value?: string }).value : undefined,
  );
  const activeIndex = ctx ? values.indexOf(ctx.value) : -1;

  return (
    <md-tabs
      data-slot="tabs-list"
      className={className}
      activeTabIndex={activeIndex === -1 ? 0 : activeIndex}
      onChange={(e: React.ChangeEvent<HTMLElement>) => {
        const index = (e.target as unknown as { activeTabIndex: number }).activeTabIndex;
        const nextValue = values[index];
        if (nextValue !== undefined) ctx?.setValue(nextValue);
      }}
    >
      {children}
    </md-tabs>
  );
}

function TabsTrigger({
  value,
  className,
  children,
  disabled,
}: {
  value: string;
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
}) {
  const ctx = React.useContext(TabsContext);
  return (
    <md-primary-tab
      data-slot="tabs-trigger"
      className={className}
      active={ctx?.value === value}
      disabled={disabled}
    >
      {children}
    </md-primary-tab>
  );
}

function TabsContent({ value, className, children }: { value: string; className?: string; children?: React.ReactNode }) {
  const ctx = React.useContext(TabsContext);
  if (ctx?.value !== value) return null;
  return (
    <div data-slot="tabs-content" className={className} style={{ flex: 1, outline: "none" }}>
      {children}
    </div>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
