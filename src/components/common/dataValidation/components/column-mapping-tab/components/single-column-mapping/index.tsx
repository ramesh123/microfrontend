// import React, { useState, useMemo } from 'react';
// import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
// import { Button } from '@/components/ui/button';
// import { Badge } from '@/components/ui/badge';
// import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
// import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
// import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
// import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
// import { useSortable } from '@dnd-kit/sortable';
// import { CSS } from '@dnd-kit/utilities';
// import { Check, ChevronsUpDown, X, GripVertical } from 'lucide-react';
// import { cn } from '@/lib/utils';
// import { Column } from '@/types/dataValidation';

// interface SingleColumnMappingProps {
//   allColumns: Column[];
//   selectedIds: string[];
//   onSelectionChange: (selectedColumns: Column[]) => void;
// }

// const SortableSingleItem: React.FC<{ column: Column; onRemove: () => void }> = ({ column, onRemove }) => {
//   const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id });
//   const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : 'auto' };

//   return (
//     <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-1.5 bg-background border rounded-md text-sm group">
//       <div {...attributes} {...listeners} className="cursor-grab p-1"><GripVertical className="h-4 w-4 text-muted-foreground" /></div>
//       <span className="font-medium truncate flex-1">{column.name}</span>
//       {column.type && <Badge variant="outline" className="text-[10px] py-0 px-1 h-4">{column.type}</Badge>}
//       <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={onRemove}>
//         <X className="h-3 w-3 text-red-500" />
//       </Button>
//     </div>
//   );
// };

// const SingleColumnMapping: React.FC<SingleColumnMappingProps> = ({ allColumns, selectedIds, onSelectionChange }) => {
//   const [open, setOpen] = useState(false);
//   const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

//   const handleSelectionChange = (newSelectedIds: string[]) => {
//     const selectedColumns = allColumns.filter(col => newSelectedIds.includes(col.id));
//     const orderedSelectedColumns = newSelectedIds.map(id => selectedColumns.find(c => c.id === id)!);
//     onSelectionChange(orderedSelectedColumns);
//   };

//   const handleSelect = (columnId: string) => {
//     const newSelectedIds = selectedIds.includes(columnId)
//       ? selectedIds.filter(id => id !== columnId)
//       : [...selectedIds, columnId];
//     handleSelectionChange(newSelectedIds);
//   };

//   const handleDragEnd = (event: DragEndEvent) => {
//     const { active, over } = event;
//     if (over && active.id !== over.id) {
//       const oldIndex = selectedIds.indexOf(active.id as string);
//       const newIndex = selectedIds.indexOf(over.id as string);
//       handleSelectionChange(arrayMove(selectedIds, oldIndex, newIndex));
//     }
//   };

//   const selectedColumns = useMemo(() => selectedIds.map(id => allColumns.find(col => col.id === id)!), [selectedIds, allColumns]);

//   return (
//     <Card className="p-2 gap-2">
//       <CardHeader className="p-2 gap-0">
//         <CardTitle className="text-sm font-medium">Select & Reorder Columns</CardTitle>
//       </CardHeader>
//       <CardContent className="p-2 pt-0 space-y-2">
//         <Popover open={open} onOpenChange={setOpen}>
//           <PopoverTrigger asChild>
//             <Button variant="outline" role="combobox" aria-expanded={open} className="w-full flex !justify-between">
//               <span className="truncate">
//                 {selectedColumns.length > 0 ? `${selectedColumns.length} columns selected` : "Select columns..."}
//               </span>
//               <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
//             </Button>
//           </PopoverTrigger>
//           <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
//             <Command>
//               <CommandInput placeholder="Search columns..." />
//               <CommandList>
//                 <CommandEmpty>No columns found.</CommandEmpty>
//                 <CommandGroup>
//                   {allColumns.map((option) => (
//                     <CommandItem key={option.id} value={`${option.name} ${option.type || ''}`}
//                       onSelect={() => handleSelect(option.id)}
//                       className="cursor-pointer">
//                       <Check className={cn("mr-2 h-4 w-4", selectedIds.includes(option.id) ? "opacity-100" : "opacity-0")} />
//                       <div className="flex items-center gap-2 flex-1">
//                         <span className="truncate">{option.name}</span>
//                         {option.type && <Badge variant="outline" className="text-xs">{option.type}</Badge>}
//                       </div>
//                     </CommandItem>
//                   ))}
//                 </CommandGroup>
//               </CommandList>
//             </Command>
//           </PopoverContent>
//         </Popover>

//         {selectedColumns.length > 0 && (
//           <div className="p-2 border rounded-lg bg-muted/50 dark:bg-muted/20">
//             <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
//               <SortableContext items={selectedIds} strategy={verticalListSortingStrategy}>
//                 <div className="space-y-1.5">
//                   {selectedColumns.map(col => (
//                     col && <SortableSingleItem key={col.id} column={col} onRemove={() => handleSelect(col.id)} />
//                   ))}
//                 </div>
//               </SortableContext>
//             </DndContext>
//           </div>
//         )}
//       </CardContent>
//     </Card>
//   );
// };

// export default SingleColumnMapping;
import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, ChevronsUpDown, X, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Column } from '@/types/dataValidation';

interface SingleColumnMappingProps {
  allColumns: Column[];
  selectedIds: string[];
  onSelectionChange: (selectedColumns: Column[]) => void;
}

const SortableSingleItem: React.FC<{ column: Column; onRemove: () => void }> = ({ column, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : 'auto' };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-1.5 bg-background border rounded-md text-sm group">
      <div {...attributes} {...listeners} className="cursor-grab p-1"><GripVertical className="h-4 w-4 text-muted-foreground" /></div>
      <span className="font-medium truncate flex-1">{column.name}</span>
      {column.type && <Badge variant="outline" className="text-[10px] py-0 px-1 h-4">{column.type}</Badge>}
      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={onRemove}>
        <X className="h-3 w-3 text-red-500" />
      </Button>
    </div>
  );
};

const SingleColumnMapping: React.FC<SingleColumnMappingProps> = ({ allColumns, selectedIds, onSelectionChange }) => {
  const [open, setOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const handleSelectionChange = (newSelectedIds: string[]) => {
    const selectedColumns = allColumns.filter(col => newSelectedIds.includes(col.id));
    const orderedSelectedColumns = newSelectedIds.map(id => selectedColumns.find(c => c.id === id)!);
    onSelectionChange(orderedSelectedColumns);
  };

  const handleSelect = (columnId: string) => {
    const newSelectedIds = selectedIds.includes(columnId)
      ? selectedIds.filter(id => id !== columnId)
      : [...selectedIds, columnId];
    handleSelectionChange(newSelectedIds);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = selectedIds.indexOf(active.id as string);
      const newIndex = selectedIds.indexOf(over.id as string);
      handleSelectionChange(arrayMove(selectedIds, oldIndex, newIndex));
    }
  };

  const selectedColumns = useMemo(() => selectedIds.map(id => allColumns.find(col => col.id === id)!), [selectedIds, allColumns]);

  return (
    <Card className="p-2 gap-2">
      <CardHeader className="p-2 gap-0">
        <CardTitle className="text-sm font-medium">Select & Reorder Columns</CardTitle>
      </CardHeader>
      <CardContent className="p-2 pt-0 space-y-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={open} className="w-full flex !justify-between">
              <span className="truncate">
                {selectedColumns.length > 0 ? `${selectedColumns.length} columns selected` : "Select columns..."}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search columns..." />
              <CommandList>
                <CommandEmpty>No columns found.</CommandEmpty>
                <CommandGroup>
                  {allColumns.map((option) => (
                    <CommandItem key={option.id} value={`${option.name} ${option.type || ''}`}
                      onSelect={() => handleSelect(option.id)}
                      className="cursor-pointer">
                      <Check className={cn("mr-2 h-4 w-4", selectedIds.includes(option.id) ? "opacity-100" : "opacity-0")} />
                      <div className="flex items-center gap-2 flex-1">
                        <span className="truncate">{option.name}</span>
                        {option.type && <Badge variant="outline" className="text-xs">{option.type}</Badge>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {selectedColumns.length > 0 && (
          <div className="p-2 border rounded-lg bg-muted/50 dark:bg-muted/20">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={selectedIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {selectedColumns.map(col => (
                    col && <SortableSingleItem key={col.id} column={col} onRemove={() => handleSelect(col.id)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SingleColumnMapping;
