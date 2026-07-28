import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Clock, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Task } from './types';

interface TaskCardProps {
  task: Task;
  isOverlay?: boolean;
}

export function TaskCard({ task, isOverlay }: TaskCardProps) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'Task',
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="h-[140px] w-full rounded-xl border-2 border-dashed border-primary/20 bg-primary/5 opacity-50"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn("touch-none", isOverlay ? "cursor-grabbing" : "cursor-grab")}
    >
      <Card className={cn("mb-2 shadow-sm hover:shadow-md transition-shadow p-0", 
        task.isOverdue ? "border-l-red-500" : "border-l-transparent"
      )}>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className={cn("text-white text-[10px]", task.assignee.color)}>
                  {task.assignee.initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                    <Check className="w-3 h-3 text-blue-600" />
                    <span className="text-[10px] font-bold text-slate-700">{task.id}</span>
                </div>
                <span className="text-[9px] text-slate-400 leading-none">{task.timeAgo}</span>
              </div>
            </div>
          </div>

          <p className="text-xs font-medium text-slate-700 leading-snug whitespace-pre-line">
            {task.title}
            </p>
          {task.isOverdue && (
             <div className="flex items-center gap-1 text-red-500 bg-red-50 px-1.5 py-0.5 rounded text-[9px] w-fit">
                <Clock className="w-2.5 h-2.5" />
                <span>Overdue by {task.overdueTime}</span>
             </div>
          )}

          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[9px] text-slate-400">
                <span>0/0</span>
                <span>{task.progress}%</span>
            </div>
            {/* <Progress value={task.progress} className="h-1 bg-slate-100" /> */}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
