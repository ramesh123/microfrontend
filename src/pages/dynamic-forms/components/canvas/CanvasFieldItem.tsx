import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getFieldTypeBadge } from '../../lib/field/field-type-badge';
import type { FormBuilderField, FormFieldValue } from '../../types';
import { getDefaultFieldValue, fieldSupportsCanvasInteraction } from '../../lib/field/field.utils';
import { FieldTypeIcon } from '../fields/FieldTypeIcon';
import { FormFieldRenderer } from '../fields/FormFieldRenderer';

interface CanvasFieldItemProps {
  field: FormBuilderField;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export function CanvasFieldItem({
  field,
  isSelected,
  onSelect,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
}: CanvasFieldItemProps) {
  const badge = getFieldTypeBadge(field.type);
  const isDivider = field.type === 'section_divider';
  const fillsGridHeight = field.type === 'big_number';
  const isInteractiveOnCanvas = fieldSupportsCanvasInteraction(field.type);
  const [previewValue, setPreviewValue] = useState<FormFieldValue>(() => getDefaultFieldValue(field));

  useEffect(() => {
    setPreviewValue(getDefaultFieldValue(field));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset preview only when field identity/type changes
  }, [field.id, field.type]);

  const handlePreviewChange = (_name: string, value: FormFieldValue) => {
    if (isInteractiveOnCanvas) {
      setPreviewValue(value);
    }
  };

  return (
    <div
      className={cn(
        'group flex w-full flex-col justify-start rounded-lg border bg-gray-elevated transition-all duration-150',
        fillsGridHeight ? 'h-full min-h-0' : 'h-auto max-h-full',
        field.type === 'signature_pad' || field.type === 'google_maps_location' ? 'overflow-visible' : 'overflow-hidden',
        isSelected
          ? 'form-builder-field-selected border-primary/50'
          : 'border-gray-border/70 hover:border-primary/25',
        !field.visible && 'opacity-50',
      )}
      onClick={() => onSelect(field.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(field.id);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div
        className={cn(
          'flex shrink-0 items-center gap-1.5 border-b border-gray-border/60 px-2 py-1',
          isSelected ? 'bg-primary/5' : 'bg-gray-surface',
        )}
      >
        <span
          className="form-builder-grid-drag-handle flex cursor-grab items-center rounded p-0.5 text-gray-text-muted hover:bg-gray-surface-hover active:cursor-grabbing"
          title="Drag to move"
          onClick={(event) => event.stopPropagation()}
        >
          <GripVertical className="h-3 w-3" />
        </span>

        <FieldTypeIcon type={field.type} className="h-3 w-3 shrink-0 text-primary" />

        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-gray-text">
          {field.displayName}
        </span>

        <span className="shrink-0 rounded px-1 py-px font-mono text-[8px] font-medium text-gray-text-muted">
          {badge}
        </span>

        {field.required && !isDivider && (
          <span className="text-[10px] font-semibold text-destructive" title="Required">
            *
          </span>
        )}

        <div
          className={cn(
            'flex items-center transition-opacity',
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          {onMoveUp && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              title="Move up"
              disabled={!canMoveUp}
              onClick={(event) => {
                event.stopPropagation();
                onMoveUp(field.id);
              }}
            >
              <ArrowUp className="h-2.5 w-2.5" />
            </Button>
          )}
          {onMoveDown && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              title="Move down"
              disabled={!canMoveDown}
              onClick={(event) => {
                event.stopPropagation();
                onMoveDown(field.id);
              }}
            >
              <ArrowDown className="h-2.5 w-2.5" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-destructive hover:text-destructive"
            title="Delete field"
            onClick={(event) => {
              event.stopPropagation();
              onRemove(field.id);
            }}
          >
            <Trash2 className="h-2.5 w-2.5" />
          </Button>
        </div>
      </div>

      <div
        className={cn(
          fillsGridHeight ? 'min-h-0 flex-1' : 'shrink-0',
          isInteractiveOnCanvas ? 'pointer-events-auto' : 'pointer-events-none',
          isDivider ? 'px-2 py-1' : fillsGridHeight ? 'px-2 py-1.5' : 'px-2.5 py-1.5',
        )}
        onClick={(event) => {
          if (isInteractiveOnCanvas) {
            event.stopPropagation();
          }
        }}
        onPointerDown={(event) => {
          if (isInteractiveOnCanvas) {
            event.stopPropagation();
          }
        }}
      >
        <FormFieldRenderer
          field={field}
          value={previewValue}
          interactive={isInteractiveOnCanvas}
          onChange={handlePreviewChange}
          variant="canvas"
          fillHeight={fillsGridHeight}
        />
      </div>
    </div>
  );
}
