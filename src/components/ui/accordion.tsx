import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// No @material/web accordion/expansion-panel component exists — this is a
// plain implementation. Root-level open/closed state (type="single"|
// "multiple", value/onValueChange) is unchanged from before; only the
// per-item rendering is now plain markup instead of MUI's Accordion family.
// The 0fr/1fr grid-template-rows transition is a standard CSS technique for
// animating to an intrinsic ("auto") height without JS measuring.
type AccordionCtx = {
  type: "single" | "multiple";
  value: string[];
  toggle: (itemValue: string) => void;
};
const AccordionContext = React.createContext<AccordionCtx | null>(null);
const AccordionItemContext = React.createContext<{ value: string; expanded: boolean } | null>(null);

interface AccordionProps {
  type?: "single" | "multiple";
  collapsible?: boolean;
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  className?: string;
  children?: React.ReactNode;
}

function Accordion({ type = "single", collapsible = true, value, defaultValue, onValueChange, className, children }: AccordionProps) {
  const toArray = (v: string | string[] | undefined): string[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
  const [internal, setInternal] = React.useState<string[]>(() => toArray(defaultValue));
  const current = value !== undefined ? toArray(value) : internal;

  const toggle = (itemValue: string) => {
    let next: string[];
    if (type === "single") {
      const isOpen = current.includes(itemValue);
      next = isOpen ? (collapsible ? [] : current) : [itemValue];
    } else {
      next = current.includes(itemValue) ? current.filter((v) => v !== itemValue) : [...current, itemValue];
    }
    setInternal(next);
    onValueChange?.(type === "single" ? next[0] ?? "" : next);
  };

  return (
    <AccordionContext.Provider value={{ type, value: current, toggle }}>
      <div data-slot="accordion" className={className}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

function AccordionItem({ value, className, children }: { value: string; className?: string; children?: React.ReactNode }) {
  const ctx = React.useContext(AccordionContext);
  const expanded = !!ctx?.value.includes(value);

  return (
    <AccordionItemContext.Provider value={{ value, expanded }}>
      <div data-slot="accordion-item" data-state={expanded ? "open" : "closed"} className={cn("border-b", className)}>
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

function AccordionTrigger({ className, children }: { className?: string; children?: React.ReactNode }) {
  const ctx = React.useContext(AccordionContext);
  const item = React.useContext(AccordionItemContext);

  return (
    <button
      type="button"
      data-slot="accordion-trigger"
      onClick={() => item && ctx?.toggle(item.value)}
      className={cn(
        "flex w-full flex-1 items-center justify-between gap-4 py-3 text-left text-sm font-medium transition-all hover:underline",
        className,
      )}
    >
      {children}
      <ChevronDownIcon
        size={16}
        className={cn("shrink-0 transition-transform duration-200", item?.expanded && "rotate-180")}
      />
    </button>
  );
}

function AccordionContent({ className, children }: { className?: string; children?: React.ReactNode }) {
  const item = React.useContext(AccordionItemContext);

  return (
    <div
      data-slot="accordion-content"
      style={{
        display: "grid",
        gridTemplateRows: item?.expanded ? "1fr" : "0fr",
        transition: "grid-template-rows 0.2s ease",
      }}
    >
      <div className="overflow-hidden">
        <div className={cn("pb-3 pt-0 text-sm", className)}>{children}</div>
      </div>
    </div>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
