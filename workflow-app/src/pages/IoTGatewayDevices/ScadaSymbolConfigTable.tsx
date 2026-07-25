import { useMemo, useRef, useState, type HTMLAttributes } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Settings2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ScadaConfigTableRow = {
  id: string;
  name: string;
  type: string;
  [key: string]: unknown;
};

const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(6.5rem,0.7fr)_auto] items-center gap-2 border-b border-border px-2 py-1.5 last:border-b-0";

function buildSortIds<T extends ScadaConfigTableRow>(rows: T[]): string[] {
  const seen = new Map<string, number>();
  return rows.map((row, index) => {
    const base = row.id.trim() || `__row-${index}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}__${count}`;
  });
}

type ConfigRowCellsProps<T extends ScadaConfigTableRow> = {
  row: T;
  index: number;
  typeOptions: { value: string; label: string }[];
  idPlaceholder: string;
  namePlaceholder: string;
  onOpenSettings?: (index: number, row: T) => void;
  onUpdate?: (patch: Partial<T>) => void;
  onRemove?: () => void;
  dragActivator?: {
    setActivatorNodeRef: (element: HTMLElement | null) => void;
    attributes: HTMLAttributes<HTMLButtonElement>;
    listeners: HTMLAttributes<HTMLButtonElement>;
  };
  readOnly?: boolean;
  className?: string;
};

function ConfigRowCells<T extends ScadaConfigTableRow>({
  row,
  index,
  typeOptions,
  idPlaceholder,
  namePlaceholder,
  onOpenSettings,
  onUpdate,
  onRemove,
  dragActivator,
  readOnly,
  className,
}: ConfigRowCellsProps<T>) {
  return (
    <div className={cn(ROW_GRID, className)}>
      <Input
        value={row.id}
        readOnly={readOnly}
        onChange={(e) => onUpdate?.({ id: e.target.value } as Partial<T>)}
        placeholder={idPlaceholder}
        className="h-8 font-mono text-xs"
      />
      <Input
        value={row.name}
        readOnly={readOnly}
        onChange={(e) => onUpdate?.({ name: e.target.value } as Partial<T>)}
        placeholder={namePlaceholder}
        className="h-8 text-xs"
      />
      <Select
        value={row.type}
        onValueChange={(v) => onUpdate?.({ type: v } as Partial<T>)}
        disabled={readOnly}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {typeOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex min-w-[5.75rem] items-center justify-end gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-primary"
          title="Settings"
          disabled={readOnly || !onOpenSettings}
          onClick={() => onOpenSettings?.(index, row)}
        >
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          title="Remove"
          disabled={readOnly}
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <button
          type="button"
          ref={dragActivator?.setActivatorNodeRef}
          className={cn(
            "flex h-7 w-7 touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted",
            readOnly ? "cursor-default opacity-40" : "cursor-grab active:cursor-grabbing",
          )}
          title="Drag to reorder"
          disabled={readOnly || !dragActivator}
          {...dragActivator?.attributes}
          {...dragActivator?.listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function SortableConfigRow<T extends ScadaConfigTableRow>({
  row,
  index,
  sortId,
  typeOptions,
  idPlaceholder,
  namePlaceholder,
  onOpenSettings,
  onUpdate,
  onRemove,
}: {
  row: T;
  index: number;
  sortId: string;
  typeOptions: { value: string; label: string }[];
  idPlaceholder: string;
  namePlaceholder: string;
  onOpenSettings?: (index: number, row: T) => void;
  onUpdate: (patch: Partial<T>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: sortId });

  const style = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("relative bg-background", isDragging && "z-0 opacity-40")}
    >
      <ConfigRowCells
        row={row}
        index={index}
        typeOptions={typeOptions}
        idPlaceholder={idPlaceholder}
        namePlaceholder={namePlaceholder}
        onOpenSettings={onOpenSettings}
        onUpdate={onUpdate}
        onRemove={onRemove}
        dragActivator={{ setActivatorNodeRef, attributes, listeners }}
        className={isDragging ? "border-transparent" : undefined}
      />
    </div>
  );
}

type ScadaSymbolConfigTableProps<T extends ScadaConfigTableRow> = {
  rows: T[];
  onChange: (rows: T[]) => void;
  typeOptions: { value: string; label: string }[];
  addLabel: string;
  createRow: () => T;
  idPlaceholder?: string;
  namePlaceholder?: string;
  /** When set, gear opens settings for that row. */
  onOpenSettings?: (index: number, row: T) => void;
  /** When set, Add button opens dialog instead of appending inline. */
  onAdd?: () => void;
};

export function ScadaSymbolConfigTable<T extends ScadaConfigTableRow>({
  rows,
  onChange,
  typeOptions,
  addLabel,
  createRow,
  idPlaceholder = "id",
  namePlaceholder = "{i18n:scada.symbol.example}",
  onOpenSettings,
  onAdd,
}: ScadaSymbolConfigTableProps<T>) {
  const [activeSortId, setActiveSortId] = useState<string | null>(null);
  const [overlayWidth, setOverlayWidth] = useState<number | null>(null);
  const tableBodyRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const sortIds = useMemo(() => buildSortIds(rows), [rows]);

  const activeIndex = activeSortId != null ? sortIds.indexOf(activeSortId) : -1;
  const activeRow = activeIndex >= 0 ? rows[activeIndex] : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveSortId(String(event.active.id));
    setOverlayWidth(tableBodyRef.current?.clientWidth ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveSortId(null);
    setOverlayWidth(null);
    if (!over || active.id === over.id) return;
    const oldIndex = sortIds.indexOf(String(active.id));
    const newIndex = sortIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(rows, oldIndex, newIndex));
  };

  const handleDragCancel = () => {
    setActiveSortId(null);
    setOverlayWidth(null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="overflow-hidden rounded-md border border-border">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(6.5rem,0.7fr)_auto] gap-2 border-b border-border bg-muted/30 px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Id</span>
          <span>Name</span>
          <span>Type</span>
          <span className="min-w-[5.75rem] text-right">Actions</span>
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={sortIds} strategy={verticalListSortingStrategy}>
            <div ref={tableBodyRef} className="max-h-[min(28rem,55vh)] overflow-y-auto">
              {rows.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No items yet. Use the button below to add one.
                </p>
              ) : (
                rows.map((row, index) => (
                  <SortableConfigRow
                    key={sortIds[index]}
                    row={row}
                    index={index}
                    sortId={sortIds[index]}
                    typeOptions={typeOptions}
                    idPlaceholder={idPlaceholder}
                    namePlaceholder={namePlaceholder}
                    onOpenSettings={onOpenSettings}
                    onUpdate={(patch) => onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))}
                    onRemove={() => onChange(rows.filter((_, i) => i !== index))}
                  />
                ))
              )}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {activeRow && activeIndex >= 0 ? (
              <div
                className="rounded-md border border-border bg-background shadow-lg ring-1 ring-primary/20"
                style={overlayWidth ? { width: overlayWidth } : { width: "100%" }}
              >
                <ConfigRowCells
                  row={activeRow}
                  index={activeIndex}
                  typeOptions={typeOptions}
                  idPlaceholder={idPlaceholder}
                  namePlaceholder={namePlaceholder}
                  readOnly
                  className="border-b-0"
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("h-8 w-fit border-primary text-primary hover:bg-primary/5")}
        onClick={() => (onAdd ? onAdd() : onChange([...rows, createRow()]))}
      >
        {addLabel}
      </Button>
    </div>
  );
}
