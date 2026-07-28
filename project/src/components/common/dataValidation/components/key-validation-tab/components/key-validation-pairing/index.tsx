import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, ChevronsUpDown, GripVertical, AlertCircle, Plus, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Column } from '@/types/dataValidation';

interface KeyValidationPairingProps {
  /** Union of key + validation pools; used when key/validation options are omitted. */
  allColumns: Column[];
  /** When set, key combobox and lookups use this list only (e.g. source columns). */
  keyColumnOptions?: Column[];
  /** When set, validation combobox and lookups use this list only (e.g. target columns). */
  validationColumnOptions?: Column[];
  initialKeyIds: string[];
  initialValidationIds: string[];
  onPair: (keyOrder: string[], validationOrder: string[]) => void;
  isEditing: boolean;
}

const MultiSelectCombobox: React.FC<{
  options: Column[], selectedIds: string[], onSelectionChange: (ids: string[]) => void, placeholder: string
}> = ({ options, selectedIds, onSelectionChange, placeholder }) => {
  const [open, setOpen] = useState(false);

  const handleSelect = (columnId: string) => {
    const newSelectedIds = selectedIds.includes(columnId)
      ? selectedIds.filter(id => id !== columnId)
      : [...selectedIds, columnId];
    onSelectionChange(newSelectedIds);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full !justify-between">
          <span className="truncate">
            {selectedIds.length > 0 ? (
              `${selectedIds.length} column${selectedIds.length > 1 ? 's' : ''} selected`
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Search columns..." />
          <CommandList>
            <CommandEmpty>No columns found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem key={option.id} value={option.name} onSelect={() => handleSelect(option.id)} className="cursor-pointer">
                  <Check className={cn("mr-2 h-4 w-4", selectedIds.includes(option.id) ? "opacity-100" : "opacity-0")} />
                  <span>{option.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const SortableItem: React.FC<{ column: Column }> = ({ column }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : 'auto' };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-1.5 bg-background border rounded-md text-sm">
      <div {...attributes} {...listeners} className="cursor-grab p-1"><GripVertical className="h-4 w-4 text-muted-foreground" /></div>
      <span className="font-medium truncate">{column.name}</span>
      {column.type && <Badge variant="outline" className="text-[10px] py-0 px-1 h-4">{column.type}</Badge>}
    </div>
  );
};

const KeyValidationPairing: React.FC<KeyValidationPairingProps> = ({
  allColumns,
  keyColumnOptions,
  validationColumnOptions,
  onPair,
  isEditing,
  initialKeyIds,
  initialValidationIds,
}) => {
  const keyOpts = keyColumnOptions ?? allColumns;
  const valOpts = validationColumnOptions ?? allColumns;

  const [selectedKeyIds, setSelectedKeyIds] = useState<string[]>(initialKeyIds);
  const [selectedValidationIds, setSelectedValidationIds] = useState<string[]>(initialValidationIds);

  useEffect(() => {
    setSelectedKeyIds(initialKeyIds);
    setSelectedValidationIds(initialValidationIds);
  }, [initialKeyIds, initialValidationIds]);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const handleDragEnd = (event: DragEndEvent, listType: 'key' | 'validation') => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const setter = listType === 'key' ? setSelectedKeyIds : setSelectedValidationIds;
      const items = listType === 'key' ? selectedKeyIds : selectedValidationIds;
      const oldIndex = items.indexOf(active.id as string);
      const newIndex = items.indexOf(over.id as string);
      setter(arrayMove(items, oldIndex, newIndex));
    }
  };

  const selectedKeyCols = useMemo(
    () => selectedKeyIds.map((id) => keyOpts.find((c) => c.id === id)).filter((c): c is Column => c != null),
    [selectedKeyIds, keyOpts],
  );
  const selectedValidationCols = useMemo(
    () => selectedValidationIds.map((id) => valOpts.find((c) => c.id === id)).filter((c): c is Column => c != null),
    [selectedValidationIds, valOpts],
  );

  const canPair = selectedKeyIds.length > 0 && selectedKeyIds.length === selectedValidationIds.length;
  const validationError = selectedKeyIds.length !== selectedValidationIds.length && (selectedKeyIds.length > 0 || selectedValidationIds.length > 0);

  const handlePair = () => {
    if (canPair) {
      onPair(selectedKeyIds, selectedValidationIds);
    }
  };

  return (
    <div className="space-y-3 p-3 border border-dashed rounded-lg bg-slate-50 dark:bg-slate-800/20">
      <h3 className="text-sm font-semibold text-center">{isEditing ? 'Edit Key & Validation Pairs' : 'Create New Pairs'}</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="gap-0 p-2">
          <CardHeader className="p-2"><CardTitle className="text-sm font-medium">1. Select Key Columns</CardTitle></CardHeader>
          <CardContent className="p-2 pt-0">
            <MultiSelectCombobox options={keyOpts} selectedIds={selectedKeyIds} onSelectionChange={setSelectedKeyIds} placeholder="Select key columns..." />
          </CardContent>
        </Card>
        <Card className="gap-0 p-2">
          <CardHeader className="p-2"><CardTitle className="text-sm font-medium">2. Select Validation Columns</CardTitle></CardHeader>
          <CardContent className="p-2 pt-0">
            <MultiSelectCombobox options={valOpts} selectedIds={selectedValidationIds} onSelectionChange={setSelectedValidationIds} placeholder="Select validation columns..." />
          </CardContent>
        </Card>
      </div>

      {validationError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Count Mismatch</AlertTitle>
          <AlertDescription className="flex">
            Key and Validation must have the same number of columns.
            Current: <b>Key ({selectedKeyIds.length})</b>, <b>Validation ({selectedValidationIds.length})</b>.
          </AlertDescription>
        </Alert>
      )}

      {(selectedKeyIds.length > 0 || selectedValidationIds.length > 0) && (
        <Card>
          <CardHeader className="p-3"><CardTitle className="text-sm font-medium">3. Reorder to Align Pairs</CardTitle></CardHeader>
          <CardContent className="p-3 pt-0 grid grid-cols-1 md:grid-cols-2 gap-3 bg-muted/50 dark:bg-muted/10">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, 'key')}>
              <SortableContext items={selectedKeyIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5 p-2 border rounded-md min-h-[50px] bg-background">
                  {selectedKeyCols.map(col => col && <SortableItem key={col.id} column={col} />)}
                </div>
              </SortableContext>
            </DndContext>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, 'validation')}>
              <SortableContext items={selectedValidationIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5 p-2 border rounded-md min-h-[50px] bg-background">
                  {selectedValidationCols.map(col => col && <SortableItem key={col.id} column={col} />)}
                </div>
              </SortableContext>
            </DndContext>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-center">
        <Button onClick={handlePair} disabled={!canPair}>
          {isEditing ? <Edit className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
          {isEditing ? `Update ${selectedKeyIds.length > 0 ? selectedKeyIds.length : ''} Pairs` : `Create ${selectedKeyIds.length > 0 ? selectedKeyIds.length : ''} Pairs`}
        </Button>
      </div>

    </div>
  );
};

export default KeyValidationPairing;
