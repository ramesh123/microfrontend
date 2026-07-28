import { useLayoutEffect, useRef, useState } from "react";
import { Hash, CalendarDays, Type } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface WizardFieldOption {
  name: string;
  type: string;
}

const FieldIcon = ({ type, name }: { type: string; name?: string }) => {
  const resolved = (type || "").toLowerCase();
  if (resolved === "number") return <Hash className="!size-3 text-muted-foreground" />;
  if (resolved === "date") return <CalendarDays className="!size-3 text-muted-foreground" />;
  return <Type className="!size-3 text-muted-foreground" />;
};

interface WizardColumnFieldPickerProps {
  paramLabel: string;
  fields: WizardFieldOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectField: (field: WizardFieldOption) => void;
  children: React.ReactNode;
}

export default function WizardColumnFieldPicker({
  paramLabel,
  fields,
  open,
  onOpenChange,
  search,
  onSearchChange,
  onSelectField,
  children,
}: WizardColumnFieldPickerProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [anchorWidth, setAnchorWidth] = useState<number>();

  useLayoutEffect(() => {
    const node = anchorRef.current;
    if (!node) return;

    const syncWidth = () => {
      setAnchorWidth(node.getBoundingClientRect().width);
    };

    syncWidth();

    const observer = new ResizeObserver(syncWidth);
    observer.observe(node);
    window.addEventListener("resize", syncWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncWidth);
    };
  }, [open]);

  const filtered = fields.filter((field) =>
    field.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className="w-full min-w-0">
          {children}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        collisionPadding={8}
        style={
          anchorWidth
            ? { width: anchorWidth, minWidth: anchorWidth, maxWidth: anchorWidth }
            : undefined
        }
        className={cn(
          "!w-auto p-0 shadow-md",
          anchorWidth ? "max-w-none" : "w-[var(--radix-popover-trigger-width)]",
        )}
      >
        <div className="border-b px-2.5 py-1.5">
          <p className="text-xs font-bold text-foreground">{paramLabel}</p>
        </div>
        <div className="p-2">
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search columns..."
            className="h-8 w-full text-xs"
            autoFocus
          />
        </div>
        <div className="max-h-[220px] overflow-y-auto px-1 pb-2">
          {filtered.length === 0 ? (
            <p className="py-3 text-center text-[11px] text-muted-foreground">No columns found</p>
          ) : (
            filtered.map((field) => (
              <button
                key={field.name}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent"
                onClick={() => onSelectField(field)}
              >
                <FieldIcon type={field.type} name={field.name} />
                <span className="truncate font-medium">{field.name}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
