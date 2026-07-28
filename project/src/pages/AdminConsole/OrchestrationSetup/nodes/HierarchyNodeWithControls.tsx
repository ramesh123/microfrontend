import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Building, CaseSensitive, AppWindow, GitBranch, Database, Table, FileText, MoreHorizontal, X } from 'lucide-react';
import { OrchestrationItemType } from '@/types/orchestration';
import { cn } from '@/lib/utils';

const nodeConfig: Record<OrchestrationItemType, { icon: React.ElementType, category: string, categoryColor: string }> = {
  organization: { icon: Building, category: 'SETUP', categoryColor: 'bg-purple-600' },
  businessUnit: { icon: CaseSensitive, category: 'STRUCTURE', categoryColor: 'bg-blue-600' },
  application: { icon: AppWindow, category: 'SYSTEM', categoryColor: 'bg-cyan-600' },
  businessProcess: { icon: GitBranch, category: 'PROCESS', categoryColor: 'bg-green-600' },
  transaction: { icon: FileText, category: 'DATA', categoryColor: 'bg-yellow-600' },
  table: { icon: Table, category: 'DATA', categoryColor: 'bg-orange-600' },
  project: { icon: Database, category: 'EXECUTION', categoryColor: 'bg-red-600' },
};

export interface HierarchyNodeData {
  label: string;
  type: OrchestrationItemType;
  color?: string;
  children?: HierarchyNodeData[];
  fullData?: Record<string, any>;
  onEdit?: () => void;
  onDelete?: () => void;
  isReadOnly?: boolean;
}

type HierarchyNodeProps = NodeProps & {
  data: HierarchyNodeData;
};

const handleStyle = "!w-3 !h-3 border-2 !bg-white rounded-full !border-slate-400 hover:border-primary hover:bg-primary/20 transition-all";

export const HierarchyNodeWithControls = memo(({ data, selected }: HierarchyNodeProps) => {
  const config = nodeConfig[data.type] || { icon: GitBranch, category: 'NODE', categoryColor: 'bg-gray-500' };
  const Icon = config.icon;
  const isOrgNode = data.type === 'organization';

  return (
    <div className="relative pt-3">
      <div
        className={cn(
          "group w-72 rounded-xl border bg-background shadow-sm transition-all duration-200 relative",
          selected ? "border-2 border-purple-500 shadow-lg" : "border-border"
        )}
      >
        {!data.isReadOnly && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete?.();
            }}
            className="absolute -top-2 -right-2 z-50 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:bg-destructive hover:text-destructive-foreground transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
            title="Delete Node"
          >
            <X className="h-3 w-3" />
          </button>
        )}

        <div className={`absolute -top-3 left-4 px-2 py-0.5 text-xs font-semibold text-white rounded-md ${config.categoryColor}`}>
          {config.category}
        </div>

        <Handle 
          type="target" 
          position={Position.Top} 
          className={cn(handleStyle)} 
          isConnectable={!data.isReadOnly}
          style={{ top: -6, left: '50%', transform: 'translateX(-50%)' }}
        />

        <div className="p-3 flex flex-row items-center justify-between gap-3">
          <div className="p-3 border rounded-lg bg-muted/50">
            <Icon className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="flex-grow overflow-hidden">
            <p className="text-base font-semibold truncate">{data.label}</p>
            <p className="text-xs text-muted-foreground uppercase">{data.type.replace(/([A-Z])/g, ' $1').trim()}</p>
          </div>

          {!data.isReadOnly && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={data.onEdit}>Edit</DropdownMenuItem>
                {!isOrgNode && <DropdownMenuItem onClick={data.onDelete} className="text-destructive focus:bg-destructive/10 focus:text-destructive">Delete</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <Handle 
          type="source" 
          position={Position.Bottom} 
          className={cn(handleStyle)} 
          isConnectable={!data.isReadOnly}
          style={{ bottom: -6, left: '50%', transform: 'translateX(-50%)' }}
        />
      </div>
    </div>
  );
});
