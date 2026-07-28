import React from 'react';
import { FlowJob } from '@/types/jobs';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { GitBranch, Dot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatTimeAgo, getJobStatusColor, formatJobStatusLabel } from '@/utils/formatters';

interface FlowRowProps {
  job: FlowJob;
  onRowClick: (flow: FlowJob) => void;
}

export const FlowRow: React.FC<FlowRowProps> = ({ job, onRowClick }) => {
  return ( 
    <div onClick={() => onRowClick(job)} className="cursor-pointer hover:bg-muted/50 transition-colors border-b last:border-b-0">
      <ResizablePanelGroup direction="horizontal" className="min-w-full text-sm items-center">
        <ResizablePanel defaultSize={30} minSize={20}>
          <div className="flex items-center gap-3 p-1">
            <GitBranch className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div className="truncate">
              <div className="font-medium text-foreground truncate">{job.flow_name}</div>
              <div className="text-xs text-muted-foreground truncate">{job.deployment_name}</div>
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={40} minSize={20}>
          <div className="p-1 text-muted-foreground truncate">
            <span className="font-mono text-xs">{job.flow_run_id}</span>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={15} minSize={10}>
          <div className="p-1">
            <Badge variant="outline" className={cn("text-xs whitespace-normal leading-tight", getJobStatusColor(job.job_status))}>
              <Dot className="-ml-1 h-5 w-5 shrink-0" />
              {formatJobStatusLabel(job.job_status)}
            </Badge>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={15} minSize={10}>
          <div className="p-1 text-muted-foreground">{formatTimeAgo(job.updated_at)}</div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};
