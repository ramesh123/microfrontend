import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building, CaseSensitive, AppWindow, GitBranch, Database, Table, FileText } from 'lucide-react';
import { OrchestrationItemType } from '@/types/orchestration';

const icons: Record<OrchestrationItemType, React.ElementType> = {
  organization: Building,
  businessUnit: CaseSensitive,
  application: AppWindow,
  businessProcess: GitBranch,
  transaction: FileText,
  table: Table,
  project: Database,
};

export const HierarchyNode = memo(({ data }: NodeProps<{ label: string, type: OrchestrationItemType, color: string } | any>) => {
  const Icon = icons[data.type] || GitBranch;

  return ( 
    <Card className="w-56 relative" >
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ background: '#555', top: -6, left: '50%', transform: 'translateX(-50%)' }} 
      />
      <CardHeader className="p-3">
        <CardTitle className="text-sm flex items-center gap-2">
            <Icon className="h-4 w-4" style={{ color: data.color }} />
            {data.label}
        </CardTitle>
      </CardHeader>
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ background: '#555', bottom: -6, left: '50%', transform: 'translateX(-50%)' }} 
      />
    </Card>
  );
});
