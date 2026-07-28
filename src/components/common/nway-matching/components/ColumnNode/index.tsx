import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { ShieldCheck, KeyRound, Sigma } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface ColumnNodeData {
  id: string;
  position: { x: number; y: number };
  data: {
    label: string;
    isKey: boolean;
    isValidation: boolean;
    isAggregation: boolean;
  };
}
export const ColumnNode = memo((props: NodeProps<ColumnNodeData>) => {
  const { data, selected } = props;

 const getIcon = () => {
  if (data.isKey)
    return <KeyRound className="w-4 h-4 text-yellow-600 stroke-[3]" />;
  if (data.isValidation)
    return <ShieldCheck className="w-4 h-4 text-green-600 stroke-[3]" />;
  if (data.isAggregation)
    return <Sigma className="w-4 h-4 text-blue-600 stroke-[3]" />;
  return null;
};


  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center h-12 w-60 px-3 bg-background rounded-lg shadow-sm border transition-all duration-150',
              selected
                ? 'border-blue-500 shadow-md'
                : 'border-slate-200 hover:border-slate-300',
              'dark:border-slate-700 dark:hover:border-slate-600',
              selected && 'dark:border-blue-400'
            )}
          >
            <Handle
              type="target"
              position={Position.Left}
              className="!w-3 !h-3 !rounded-full !bg-background !border-2 !border-slate-400"
            />

            <span className="flex-grow font-medium text-foreground truncate px-3">{data.label}</span>

            <div className="flex items-center gap-3 flex-shrink-0">
              {getIcon()}
              <Handle
                type="source"
                position={Position.Right}
                className="!w-3 !h-3 !rounded-full !bg-background !border-2 !border-slate-400"
              />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{data.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

ColumnNode.displayName = 'ColumnNode';
