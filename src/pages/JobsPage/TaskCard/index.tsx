import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Task } from '@/types/jobs';
import { cn } from '@/lib/utils';
import { formatDateTime, formatDuration, getTaskStateColorClass, normalizeTaskStateForUi, truncate } from '@/utils/formatters';
import { Clock, ArrowRight, ArrowLeft, Play, Square, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface TaskCardProps {
  task: any;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  const rawState =
    task?.task_state ??
    task?.task_status ??
    (typeof task?.status === "string" ? task.status : undefined) ??
    "";
  const tone = getTaskStateColorClass(rawState);
  const stateKey = normalizeTaskStateForUi(rawState);
  const badgeLabel = rawState
    ? String(rawState)
        .replace(/_/g, " ")
        .split(" ")
        .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ""))
        .join(" ")
    : "Unknown";
  const titleText = task.task_name
    ? task.task_name.charAt(0).toUpperCase() + task.task_name.slice(1).toLowerCase()
    : "—";

  return (
<Card className={cn('overflow-hidden w-full p-2 min-h-[7rem] gap-[0.65rem] transition-all hover:shadow-md', tone.border)}>
  <CardHeader className="p-0 gap-0 pb-1">
    <div className="flex min-w-0 items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <CardTitle className="line-clamp-1 cursor-default text-left text-sm font-medium leading-tight p-0">
              {titleText}
            </CardTitle>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-sm break-words">
            {task.task_name || "—"}
          </TooltipContent>
        </Tooltip>
      </div>
      <Badge
        variant="outline"
        className={cn(
          "shrink-0 border-border capitalize text-xs font-medium whitespace-nowrap shadow-sm",
          tone.bg,
          tone.text,
          stateKey ? "border" : "border-dashed"
        )}
      >
        {badgeLabel}
      </Badge>
    </div>
    <p className="text-xs text-muted-foreground font-mono pt-0.5 line-clamp-1">{truncate(task.task_id, 40)}</p>
  </CardHeader>
  <CardContent className="p-0 pt-0 text-sm text-muted-foreground">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
      {/* Input/Output Records */}
      {/* <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1">
          <ArrowLeft className="h-3 w-3 text-blue-400" />
          <span>{task.input_records_count} in</span>
        </div>
        <div className="flex items-center gap-1">
          <span>{task.output_records_count} out</span>
          <ArrowRight className="h-3 w-3 text-green-400"/>
        </div>
      </div> */}
      
      {/* Duration */}
      <div className="flex items-center gap-1.5">
        <Clock className="h-3 w-3" />
        <span>{task.duration ? formatDuration(task.duration) : 'Running...'}</span>
      </div>
      
      {/* Start Time */}
      <div className="flex items-center gap-1.5 line-clamp-1">
        <Play className="h-3 w-3 text-green-500" />
        <span className="truncate">{formatDateTime(task.start_time)}</span>
      </div>
      
      {/* End Time */}
      <div className="flex items-center gap-1.5 line-clamp-1">
        <Square className="h-3 w-3 text-red-500" />
        <span className="truncate">{task.end_time ? formatDateTime(task.end_time) : 'In progress'}</span>
      </div>
    
      
      {/* <div className="flex items-center gap-1.5">
        <Hash className="h-3 w-3" />
        <span>{task.execution_number || 'N/A'}</span>
      </div>
      
      <div className="flex items-center gap-1.5 line-clamp-1">
        <Rocket className="h-3 w-3" />
        <span className="truncate">{task.deployment_name || 'No deployment'}</span>
      </div> */}
      
      {/* Error Message (only if exists) */}
      {task.error_msg && (
        <div className="flex items-center gap-1.5 line-clamp-1 col-span-1 sm:col-span-2">
          <AlertCircle className="h-3 w-3 text-red-500" />
          <span className="truncate text-red-600">{task.error_msg}</span>
        </div>
      )}
    </div>
  </CardContent>
</Card>
  );
};
