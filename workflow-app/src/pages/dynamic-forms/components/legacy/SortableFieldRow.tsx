import { Eye, EyeOff, GripVertical, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FormBuilderField } from '../../types';
import { FieldTypeIcon } from '../fields/FieldTypeIcon';

interface SortableFieldRowProps {
  field: FormBuilderField;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string, visible: boolean) => void;
  onRemove: (id: string) => void;
}

export function SortableFieldRow({
  field,
  isSelected,
  onSelect,
  onToggleVisible,
  onRemove,
}: SortableFieldRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-lg border p-2 transition-colors',
        isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card',
        isDragging && 'opacity-70 shadow-md',
        !field.visible && 'opacity-60',
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 cursor-grab"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </Button>

      <button
        type="button"
        onClick={() => onSelect(field.id)}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <FieldTypeIcon type={field.type} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{field.displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{field.name}</p>
        </div>
      </button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => onToggleVisible(field.id, !field.visible)}
        title={field.visible ? 'Hide field' : 'Show field'}
      >
        {field.visible ? (
          <Eye className="h-4 w-4 text-muted-foreground" />
        ) : (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        )}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
        onClick={() => onRemove(field.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
