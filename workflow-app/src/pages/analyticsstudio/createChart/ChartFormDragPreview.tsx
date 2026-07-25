import { CalendarDays, Hash, GripVertical, Type } from "lucide-react";
import type { Field } from "@/pages/charts/components/ChartConfigurator";
import { formatFieldName } from "@/pages/charts/ChartFormulator/utils";
import { cn } from "@/lib/utils";

function FieldIcon({ type }: { type: string }) {
  switch (type) {
    case "number":
      return <Hash className="size-4 text-amber-600 dark:text-amber-400" />;
    case "date":
      return <CalendarDays className="size-4 text-sky-600 dark:text-sky-400" />;
    default:
      return <Type className="size-4 text-violet-600 dark:text-violet-400" />;
  }
}

export default function ChartFormDragPreview({ field }: { field: Field }) {
  const typeAccent =
    field.type === "number"
      ? "border-amber-500/40 from-amber-500/10"
      : field.type === "date"
        ? "border-sky-500/40 from-sky-500/10"
        : "border-violet-500/40 from-violet-500/10";

  return (
    <div
      className={cn(
        "flex min-w-[160px] items-center gap-2.5 rounded-xl border-2 bg-gradient-to-r to-background px-3 py-2.5 shadow-xl ring-4 ring-primary/15",
        typeAccent,
      )}
    >
      <GripVertical className="size-3.5 shrink-0 text-muted-foreground/60" />
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-background/90 ring-1 ring-border/50">
        <FieldIcon type={field.type} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{formatFieldName(field.name)}</p>
        <p className="text-[10px] capitalize text-muted-foreground">{field.type} field</p>
      </div>
    </div>
  );
}
