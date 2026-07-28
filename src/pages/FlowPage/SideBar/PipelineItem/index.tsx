import React, { useCallback, useRef } from 'react';
import { Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';

export const WORKFLOW_PIPELINE_DATA_TYPE = 'workflowPipeline';

export interface PipelineItemType {
  id: string;
  name: string;
  flow_id?: string;
}

interface PipelineItemProps {
  item: PipelineItemType;
  onDragEnd?: () => void;
}

export const DraggablePipelineItem: React.FC<PipelineItemProps> = ({ item, onDragEnd }) => {
  const dragImageRef = useRef<HTMLElement | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const crt = e.currentTarget.cloneNode(true) as HTMLElement;
      crt.style.position = 'absolute';
      crt.style.top = '-1000px';
      crt.style.width = `${e.currentTarget.offsetWidth}px`;
      crt.style.backgroundColor = 'var(--card)';
      crt.style.padding = '8px';
      crt.style.borderRadius = '12px';
      crt.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
      crt.style.zIndex = '1000';
      document.body.appendChild(crt);
      dragImageRef.current = crt;
      e.dataTransfer.setDragImage(crt, 20, 20);

      const payload = {
        workflowId: String(item.id),
        name: item.name || String(item.id),
        flow_id: item.flow_id ?? undefined,
      };
      const payloadStr = JSON.stringify(payload);
      e.dataTransfer.setData(WORKFLOW_PIPELINE_DATA_TYPE, payloadStr);
      e.dataTransfer.setData('text/plain', payloadStr); // fallback so drop can be detected
      e.dataTransfer.effectAllowed = 'move';
    },
    [item]
  );

  const handleDragEnd = useCallback(() => {
    if (dragImageRef.current) {
      document.body.removeChild(dragImageRef.current);
      dragImageRef.current = null;
    }
    onDragEnd?.();
  }, [onDragEnd]);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        'group flex items-center gap-3 p-1 rounded-lg transition-colors ml-[-0.27rem]',
        'cursor-grab hover:bg-gray-200 hover:dark:bg-gray-800'
      )}
      title={item?.name}
    >
      <div className="w-8 h-8 bg-muted rounded-full flex-shrink-0 flex items-center justify-center">
        <Workflow className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <h3 className="text-xs font-medium text-foreground truncate">{item?.name}</h3>
      </div>
    </div>
  );
};
