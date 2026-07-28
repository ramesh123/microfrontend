import { useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarDays,
  GripVertical,
  Hash,
  Layers,
  MousePointerClick,
  Plus,
  Search,
  Type,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { inferFieldType } from "../chartFormUtils";
import type { ChartWizardSource } from "../types";

interface InteractionsStepProps {
  sources: ChartWizardSource[];
  selectedSourceName?: string;
  usedColumnNames?: string[];
  drilldownSupported: boolean;
  enableDrilldown: boolean;
  drilldownColumns: string[];
  onToggleDrilldown: (value: boolean) => void;
  onDrilldownColumnsChange: (columns: string[]) => void;
  isViewOnly?: boolean;
}

function ColumnTypeIcon({ type }: { type: "string" | "number" | "date" }) {
  if (type === "number") return <Hash className="size-3 shrink-0 text-sky-600" />;
  if (type === "date") return <CalendarDays className="size-3 shrink-0 text-primary" />;
  return <Type className="size-3 shrink-0 text-emerald-600" />;
}

interface SortableDrilldownItemProps {
  column: string;
  index: number;
  onRemove: (index: number) => void;
  isViewOnly?: boolean;
}

function SortableDrilldownItem({
  column,
  index,
  onRemove,
  isViewOnly = false,
}: SortableDrilldownItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column,
  });
  const type = inferFieldType(column);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative flex gap-2">
      <div className="relative z-10 flex flex-col items-center pt-1">
        <div className="flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-sm ring-2 ring-background">
          {index + 1}
        </div>
      </div>
      <div className="min-w-0 flex-1 rounded-lg border border-primary/20 bg-gradient-to-r from-primary/10 to-background px-2 py-1.5 shadow-sm">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={cn(
              "rounded p-0.5 text-muted-foreground",
              isViewOnly ? "cursor-default opacity-50" : "cursor-grab touch-none hover:bg-muted/60 active:cursor-grabbing",
            )}
            aria-label={`Reorder ${column}`}
            disabled={isViewOnly}
            {...(isViewOnly ? {} : { ...attributes, ...listeners })}
          >
            <GripVertical className="size-3.5" />
          </button>
          <ColumnTypeIcon type={type} />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
              Level {index + 1}
            </p>
            <p className="truncate text-xs font-semibold">{column}</p>
          </div>
          {!isViewOnly ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(index)}
            >
              <X className="size-3" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function InteractionsStep({
  sources,
  selectedSourceName,
  usedColumnNames = [],
  drilldownSupported,
  enableDrilldown,
  drilldownColumns,
  onToggleDrilldown,
  onDrilldownColumnsChange,
  isViewOnly = false,
}: InteractionsStepProps) {
  const [search, setSearch] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const availableColumns = useMemo(() => {
    const activeSource =
      sources.find((source) => source.name === selectedSourceName) ?? sources[0];
    return activeSource?.columns ?? [];
  }, [selectedSourceName, sources]);

  const filteredColumns = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return availableColumns;
    return availableColumns.filter((column) => column.toLowerCase().includes(query));
  }, [availableColumns, search]);

  const selectedSet = useMemo(() => new Set(drilldownColumns), [drilldownColumns]);
  const usedSet = useMemo(() => new Set(usedColumnNames), [usedColumnNames]);

  const addColumn = (column: string) => {
    if (isViewOnly) return;
    if (selectedSet.has(column)) return;
    onDrilldownColumnsChange([...drilldownColumns, column]);
  };

  const removeColumn = (index: number) => {
    if (isViewOnly) return;
    onDrilldownColumnsChange(drilldownColumns.filter((_, i) => i !== index));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (isViewOnly) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = drilldownColumns.indexOf(String(active.id));
    const newIndex = drilldownColumns.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    onDrilldownColumnsChange(arrayMove(drilldownColumns, oldIndex, newIndex));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/50 p-1 ">
      <div className="mx-auto flex min-h-0 w-full max-w-9xl flex-1 flex-col">
        {drilldownSupported ? (
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b bg-gradient-to-r from-primary/10 via-background to-background px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                  <Layers className="size-3.5" />
                </div>
                <div className="min-w-0">
                  <Label htmlFor="drilldown-toggle" className="text-xs font-bold uppercase text-foreground tracking-tight">
                    Drilldown levels
                  </Label>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Drag to reorder. Top to bottom is the drill path.
                  </p>
                </div>
              </div>
              <Switch
                id="drilldown-toggle"
                checked={enableDrilldown}
                onCheckedChange={onToggleDrilldown}
                disabled={isViewOnly}
                className="h-5 w-9 data-[state=checked]:bg-primary [&>span]:size-4 data-[state=checked]:[&>span]:translate-x-4"
              />
            </div>

            {enableDrilldown ? (
              <div className="grid min-h-0 flex-1 gap-0 max-lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:grid-rows-[minmax(0,1fr)]">
                <div className="flex min-h-0 flex-col border-b p-4 lg:border-b-0 lg:border-r">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase text-foreground tracking-tight">
                      Available columns
                    </p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {availableColumns.length} total
                    </span>
                  </div>
                  <div className="relative mb-3">
                    <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search columns..."
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border bg-muted/20">
                    <div className="space-y-1 p-2">
                      {filteredColumns.length === 0 ? (
                        <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                          No columns match your search.
                        </p>
                      ) : (
                        filteredColumns.map((column) => {
                          const type = inferFieldType(column);
                          const isSelected = selectedSet.has(column);
                          const isUsedInChart = usedSet.has(column);
                          return (
                            <button
                              key={column}
                              type="button"
                              disabled={isSelected || isViewOnly}
                              onClick={() => addColumn(column)}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors",
                                isSelected
                                  ? "cursor-not-allowed border-primary/25 bg-primary/10 text-primary"
                                  : "border-transparent bg-background hover:border-primary/25 hover:bg-primary/5",
                              )}
                            >
                              <ColumnTypeIcon type={type} />
                              <span className="min-w-0 flex-1 truncate font-semibold">{column}</span>
                              {isUsedInChart ? (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                  In chart
                                </span>
                              ) : null}
                              {isSelected ? (
                                <span className="text-[10px] font-semibold text-primary">Added</span>
                              ) : (
                                <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-col p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase text-foreground tracking-tight">
                      Selected drill path
                    </p>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {drilldownColumns.length} level{drilldownColumns.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {drilldownColumns.length === 0 ? (
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/10 px-6 text-center">
                      <MousePointerClick className="mb-3 size-8 text-primary/60" />
                      <p className="text-sm font-medium">No drilldown levels yet</p>
                      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                        Add columns from the list to define how users drill from summary to detail.
                      </p>
                    </div>
                  ) : (
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      <div className="relative pl-2 pr-1 pb-2">
                        <div className="absolute bottom-3 left-[1.1rem] top-3 w-px bg-gradient-to-b from-primary via-primary/70 to-primary/30" />
                        <DndContext
                          sensors={isViewOnly ? undefined : sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={isViewOnly ? undefined : handleDragEnd}
                        >
                          <SortableContext
                            items={drilldownColumns}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="space-y-2">
                              {drilldownColumns.map((column, index) => (
                                <SortableDrilldownItem
                                  key={column}
                                  column={column}
                                  index={index}
                                  onRemove={removeColumn}
                                  isViewOnly={isViewOnly}
                                />
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="px-5 py-4 text-xs text-muted-foreground">
                Turn on drilldown to pick the column levels for interactive exploration.
              </div>
            )}
          </section>
        ) : (
          <section className="rounded-2xl border bg-muted/20 px-5 py-4 text-sm text-muted-foreground">
            Drilldown is not available for this chart type.
          </section>
        )}
      </div>
    </div>
  );
}
