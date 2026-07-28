import { memo } from "react";
import { cn } from "@/lib/utils";

type Status = 'online' | 'offline' | 'warning' | 'error' | 'idle' | 'loading' | 'success';

interface NodeStatusProps {
  status?: Status;
  className?: string;
}

const statusColors = {
  online: 'bg-green-500',
  offline: 'bg-muted-foreground/30',
  warning: 'bg-yellow-400',
  error: 'bg-destructive',
  idle: 'bg-blue-400',
  loading: 'bg-blue-400 animate-pulse',
  success: 'bg-green-500',
} as const;

const NodeStatus = memo(({ status = 'offline', className }: NodeStatusProps) => {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          statusColors[status] || 'bg-muted-foreground/30',
        )}
        aria-hidden="true"
      />
      <span className="sr-only">{status} status</span>
    </div>
  );
});

NodeStatus.displayName = 'NodeStatus';

export default NodeStatus;