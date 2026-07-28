import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TaskCard } from './Taskcard';

import { cn } from '@/lib/utils';
import { ColumnType, Task, TaskStatus } from './types';

interface ColumnProps {
  column: ColumnType;
  tasks: Task[];
  onAddTask?: (status: TaskStatus) => void;
}

export function Column({ column, tasks, onAddTask }: ColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  return (
    <div className="flex flex-col w-[260px] min-w-[260px] h-[85vh] bg-background rounded-xl p-2 border border-slate-200/60">
      <div className="flex items-center justify-between p-1 mb-1 shrink-0 border-b">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wide">
            {column.title}
          </h3>
          <Badge variant="secondary" className="bg-slate-200 text-slate-600 hover:bg-slate-300 rounded-full px-1.5 h-5 text-[10px] min-w-[1.25rem] justify-center">
            {tasks.length}
          </Badge>
        </div>
        {column.id !== 'total' && onAddTask && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-slate-400 hover:text-slate-700"
            onClick={() => onAddTask(column.id)}
            aria-label={`Add task to ${column.title}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div 
        ref={setNodeRef} 
        className={cn(
          "flex-1 overflow-y-auto p-1 rounded-lg transition-colors scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent",
          tasks.length === 0 ? "bg-slate-100/50 border-2 border-dashed border-slate-200" : ""
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}
