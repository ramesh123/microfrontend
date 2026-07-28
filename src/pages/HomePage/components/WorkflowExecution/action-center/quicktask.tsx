import { useState } from 'react';
import { Plus, ChevronDown, ChevronUp, Clock, Check, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { QuickTask, QuickTaskCategory } from './types';
import { cn } from '@/lib/utils';

interface QuickTasksProps {
  tasks: QuickTask[];
  onAddTask?: (category: QuickTaskCategory) => void;
}

const SECTIONS: { category: QuickTaskCategory; label: string }[] = [
  { category: 'open', label: 'Open' },
  { category: 'completed', label: 'Completed' },
  { category: 'accepted', label: 'Accepted' },
];

function QuickTaskCard({ task }: { task: QuickTask }) {
  return (
    <Card
      className={cn(
        'shadow-sm border-l-[3px] hover:shadow-md transition-all p-0',
        task.category === 'completed' && 'border-l-green-500 bg-slate-50/50',
        task.category === 'accepted' && 'border-l-blue-500',
        task.category === 'open' && 'border-l-transparent',
      )}
    >
      <CardContent className="p-2 space-y-1.5">
        <div className="flex items-center gap-2">
          <Avatar className="h-5 w-5">
            <AvatarFallback className={cn('text-white text-[9px]', task.assignee.color)}>
              {task.assignee.initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-1">
              {task.isCompleted ? (
                <CheckCircle2 className="w-3 h-3 text-green-600" />
              ) : (
                <Check className="w-3 h-3 text-blue-600" />
              )}
              <span
                className={cn(
                  'text-[10px] font-bold text-slate-700',
                  task.isCompleted && 'line-through decoration-slate-400',
                )}
              >
                {task.id}
              </span>
            </div>
            <div className="text-[9px] text-slate-400">{task.timeAgo}</div>
          </div>
        </div>
        <p className="text-xs font-medium text-slate-700 leading-snug whitespace-pre-line">
          {task.title}
        </p>
        {task.isOverdue && (
          <div className="flex items-center gap-1 text-slate-500 text-[9px] pt-1 border-t mt-1">
            <Clock className="w-2.5 h-2.5" />
            <span>Overdue by {task.overdueTime}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function QuickTasks({ tasks, onAddTask }: QuickTasksProps) {
  const [openSections, setOpenSections] = useState<Record<QuickTaskCategory, boolean>>({
    open: true,
    completed: false,
    accepted: false,
  });

  const toggleSection = (category: QuickTaskCategory) => {
    setOpenSections((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  return (
    <div className="w-[260px] min-w-[260px] flex-shrink-0 flex flex-col bg-background border rounded-xl overflow-hidden overflow-y-auto h-[85vh]">
      <div className="p-2 flex items-center justify-between border-b bg-green-50/50 rounded-t-xl shrink-0">
        <h3 className="font-bold text-slate-800 text-xs uppercase">Quick Tasks</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => onAddTask?.('open')}
          aria-label="Add quick task"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        {SECTIONS.map(({ category, label }, index) => {
          const sectionTasks = tasks.filter((t) => t.category === category);
          const isOpen = openSections[category];

          return (
            <Collapsible
              key={category}
              open={isOpen}
              onOpenChange={() => toggleSection(category)}
              className={cn('space-y-2', index > 0 && 'border-t pt-2')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-700 uppercase">{label}</span>
                  <Badge variant="secondary" className="text-[9px] h-4 px-1">
                    {sectionTasks.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-0.5">
                  {onAddTask && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={() => onAddTask(category)}
                      aria-label={`Add ${label.toLowerCase()} quick task`}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  )}
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                      {isOpen ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </div>

              <CollapsibleContent className="space-y-2 pt-1">
                {sectionTasks.length === 0 ? (
                  <p className="text-[10px] text-slate-400 text-center py-2">No tasks</p>
                ) : (
                  sectionTasks.map((task) => <QuickTaskCard key={task.id} task={task} />)
                )}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
