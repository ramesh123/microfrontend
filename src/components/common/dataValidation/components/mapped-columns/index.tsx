// import React from 'react';
// import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
// import { Button } from '@/components/ui/button';
// import { Badge } from '@/components/ui/badge';
// import {
//   DndContext,
//   closestCenter,
//   KeyboardSensor,
//   PointerSensor,
//   useSensor,
//   useSensors,
//   DragEndEvent
// } from '@dnd-kit/core';
// import {
//   arrayMove,
//   SortableContext,
//   sortableKeyboardCoordinates,
//   verticalListSortingStrategy,
// } from '@dnd-kit/sortable';
// import {
//   useSortable,
// } from '@dnd-kit/sortable';
// import { CSS } from '@dnd-kit/utilities';
// import { GripVertical, X, Plus } from 'lucide-react';

// export interface Column {
//   id: string;
//   name: string;
//   type?: string;
// }

// export interface ColumnMapping {
//   id: string;
//   sourceColumn: Column;
//   targetColumn: Column;
//   colorIndex: number;
// }

// interface MappedColumnsProps {
//   mappings: ColumnMapping[];
//   onReorderMappings: (reorderedMappings: ColumnMapping[]) => void;
//   onRemoveMapping: (mappingId: string) => void;
// }

// // Color palette for mapped columns (light colors)
// const MAPPING_COLORS = [
//   'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800',
//   'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800',
//   'bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800',
//   'bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800',
//   'bg-pink-50 border-pink-200 dark:bg-pink-950/20 dark:border-pink-800',
//   'bg-cyan-50 border-cyan-200 dark:bg-cyan-950/20 dark:border-cyan-800',
//   'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800',
//   'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-800',
//   'bg-teal-50 border-teal-200 dark:bg-teal-950/20 dark:border-teal-800',
//   'bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-800'
// ];

// const HOVER_COLORS = [
//   'hover:bg-blue-100 dark:hover:bg-blue-900/30',
//   'hover:bg-green-100 dark:hover:bg-green-900/30',
//   'hover:bg-purple-100 dark:hover:bg-purple-900/30',
//   'hover:bg-orange-100 dark:hover:bg-orange-900/30',
//   'hover:bg-pink-100 dark:hover:bg-pink-900/30',
//   'hover:bg-cyan-100 dark:hover:bg-cyan-900/30',
//   'hover:bg-yellow-100 dark:hover:bg-yellow-900/30',
//   'hover:bg-indigo-100 dark:hover:bg-indigo-900/30',
//   'hover:bg-teal-100 dark:hover:bg-teal-900/30',
//   'hover:bg-rose-100 dark:hover:bg-rose-900/30'
// ];

// // Sortable item component for mapped columns
// const SortableColumnMapping: React.FC<{
//   mapping: ColumnMapping;
//   onRemove: (id: string) => void;
// }> = ({ mapping, onRemove }) => {
//   const {
//     attributes,
//     listeners,
//     setNodeRef,
//     transform,
//     transition,
//     isDragging,
//   } = useSortable({ id: mapping.id });

//   const style = {
//     transform: CSS.Transform.toString(transform),
//     transition,
//     opacity: isDragging ? 0.5 : 1,
//   };

//   const colorClass = MAPPING_COLORS[mapping.colorIndex % MAPPING_COLORS.length];
//   const hoverColorClass = HOVER_COLORS[mapping.colorIndex % HOVER_COLORS.length];

//   return (
//     <div
//       ref={setNodeRef}
//       style={style}
//       className={`flex items-center gap-3 p-4 border rounded-lg group transition-all duration-200 ${colorClass} ${hoverColorClass}`}
//     >
//       <div
//         {...attributes}
//         {...listeners}
//         className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
//       >
//         <GripVertical className="h-5 w-5" />
//       </div>

//       <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
//         <div className="flex items-center gap-2">
//           <Badge variant="outline" className="text-xs font-medium">
//             {mapping.sourceColumn.name}
//           </Badge>
//           {mapping.sourceColumn.type && (
//             <Badge variant="secondary" className="text-xs">
//               {mapping.sourceColumn.type}
//             </Badge>
//           )}
//         </div>
//         <div className="hidden md:flex justify-center">
//           <span className="text-gray-400 text-sm font-medium">→</span>
//         </div>
//         <div className="flex items-center gap-2">
//           <Badge variant="outline" className="text-xs font-medium">
//             {mapping.targetColumn.name}
//           </Badge>
//           {mapping.targetColumn.type && (
//             <Badge variant="secondary" className="text-xs">
//               {mapping.targetColumn.type}
//             </Badge>
//           )}
//         </div>
//       </div>

//       <Button
//         variant="ghost"
//         size="sm"
//         onClick={() => onRemove(mapping.id)}
//         className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
//       >
//         <X className="h-4 w-4" />
//       </Button>
//     </div>
//   );
// };

// const MappedColumns: React.FC<MappedColumnsProps> = ({
//   mappings,
//   onReorderMappings,
//   onRemoveMapping
// }) => {
//   const sensors = useSensors(
//     useSensor(PointerSensor),
//     useSensor(KeyboardSensor, {
//       coordinateGetter: sortableKeyboardCoordinates,
//     })
//   );

//   const handleDragEnd = (event: DragEndEvent) => {
//     const { active, over } = event;

//     if (over && active.id !== over.id) {
//       const oldIndex = mappings.findIndex(m => m.id === active.id);
//       const newIndex = mappings.findIndex(m => m.id === over.id);

//       const reorderedMappings = arrayMove(mappings, oldIndex, newIndex);
//       // Reassign color indices based on new order
//       const recoloredMappings = reorderedMappings.map((mapping, index) => ({
//         ...mapping,
//         colorIndex: index % MAPPING_COLORS.length
//       }));

//       onReorderMappings(recoloredMappings);
//     }
//   };

//   return (
//     <div className="space-y-6">
//       {/* Header */}
//       <div className="text-center">
//         <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
//           Mapped Columns
//         </h2>
//         <p className="text-gray-600 dark:text-gray-400">
//           View, reorder, and manage your column mappings
//         </p>
//       </div>

//       {/* Mapped Columns Section */}
//       <Card>
//         <CardHeader>
//           <CardTitle className="flex items-center gap-2 text-lg">
//             Column Mappings
//             <Badge variant="secondary" className="text-xs">
//               {mappings.length} mapped
//             </Badge>
//           </CardTitle>
//           {mappings.length > 0 && (
//             <p className="text-sm text-gray-600 dark:text-gray-400">
//               Drag and drop to reorder mappings. Each mapping has a unique color for easy identification.
//             </p>
//           )}
//         </CardHeader>
//         <CardContent>
//           {mappings.length === 0 ? (
//             <div className="text-center py-12 text-gray-500 dark:text-gray-400">
//               <div className="mb-4">
//                 <Plus className="h-12 w-12 mx-auto opacity-30" />
//               </div>
//               <p className="text-lg font-medium mb-2">No column mappings yet</p>
//               <p className="text-sm">Add some column mappings to see them here</p>
//             </div>
//           ) : (
//             <DndContext
//               sensors={sensors}
//               collisionDetection={closestCenter}
//               onDragEnd={handleDragEnd}
//             >
//               <SortableContext
//                 items={mappings.map(m => m.id)}
//                 strategy={verticalListSortingStrategy}
//               >
//                 <div className="space-y-3">
//                   {mappings.map((mapping) => (
//                     <SortableColumnMapping
//                       key={mapping.id}
//                       mapping={mapping}
//                       onRemove={onRemoveMapping}
//                     />
//                   ))}
//                 </div>
//               </SortableContext>
//             </DndContext>
//           )}
//         </CardContent>
//       </Card>
//     </div>
//   );
// };

// export default MappedColumns;
