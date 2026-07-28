import { useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { FormBuilderTableColumn } from '../../../types';
import { normalizeTableColumns } from '../../../lib/table/form-table.utils';

interface TableColumnMappingRowsProps {
  columns: FormBuilderTableColumn[];
  onChange: (columns: FormBuilderTableColumn[]) => void;
  compact?: boolean;
}

function SortableColumnRow({
  column,
  index,
  compact,
  canRemove,
  onUpdate,
  onRemove,
}: {
  column: FormBuilderTableColumn;
  index: number;
  compact?: boolean;
  canRemove: boolean;
  onUpdate: (updates: Partial<FormBuilderTableColumn>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2 rounded-md',
        isDragging && 'z-10 bg-background opacity-90 shadow-md ring-1 ring-primary/30',
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 cursor-grab active:cursor-grabbing touch-none"
        title="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
      <Input
        value={column.label}
        onChange={(e) => onUpdate({ label: e.target.value })}
        className={compact ? '!h-7 !text-xs' : 'h-7 !text-xs'}
        placeholder={`Column ${index + 1} header`}
      />
      <Input
        value={column.responseKey ?? ''}
        onChange={(e) => onUpdate({ responseKey: e.target.value })}
        className={compact ? '!h-7 !text-xs font-mono' : 'h-7 !text-xs font-mono'}
        placeholder="e.g. bcu_number or node.payload.name"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
        disabled={!canRemove}
        title="Remove column"
        onClick={onRemove}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function TableColumnMappingRows({ columns, onChange, compact = false }: TableColumnMappingRowsProps) {
  const normalizedColumns = normalizeTableColumns(columns);
  const [activeId, setActiveId] = useState<string | null>(null);
  const columnIds = useMemo(() => normalizedColumns.map((column) => column.id), [normalizedColumns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const updateColumn = (columnId: string, updates: Partial<FormBuilderTableColumn>) => {
    onChange(
      normalizedColumns.map((column) => (column.id === columnId ? { ...column, ...updates } : column)),
    );
  };

  const addColumn = () => {
    const id = `col_${crypto.randomUUID().slice(0, 8)}`;
    onChange([...normalizedColumns, { id, label: `Column ${normalizedColumns.length + 1}` }]);
  };

  const removeColumn = (columnId: string) => {
    if (normalizedColumns.length <= 1) return;
    onChange(normalizedColumns.filter((column) => column.id !== columnId));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = normalizedColumns.findIndex((column) => column.id === active.id);
    const newIndex = normalizedColumns.findIndex((column) => column.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(normalizedColumns, oldIndex, newIndex));
  };

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-2 px-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-text-muted">
        <span className="w-7 text-center" title="Drag to reorder">
          ···
        </span>
        <span>Column header</span>
        <span>JSON key</span>
        <span className="w-7" />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(event) => setActiveId(String(event.active.id))}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <SortableContext items={columnIds} strategy={verticalListSortingStrategy}>
          <div className={cn('space-y-1.5', activeId && 'cursor-grabbing')}>
            {normalizedColumns.map((column, index) => (
              <SortableColumnRow
                key={column.id}
                column={column}
                index={index}
                compact={compact}
                canRemove={normalizedColumns.length > 1}
                onUpdate={(updates) => updateColumn(column.id, updates)}
                onRemove={() => removeColumn(column.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 px-2 text-[10px]"
        onClick={addColumn}
      >
        <Plus className="h-3 w-3" />
        Add column
      </Button>
    </div>
  );
}
